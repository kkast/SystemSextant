import {
  deserializeProjectConfig,
  generateArtifacts,
  hashText,
  parseProjectConfig,
  parseSessionMetadata,
  parseTemplateMetadata,
  type ArchitectureDraft,
  type ArtifactBundle,
  type SessionMetadataV1,
  type SessionRecord,
  type SessionRepository,
  type TemplateMetadataV1,
  type TemplateRecord,
  type TemplateRepository,
} from '@systemsextant/core';

const DATABASE_VERSION = 2;
const DRAFT_STORE = 'drafts';
const SESSION_STORE = 'sessions';
const TEMPLATE_STORE = 'templates';

export interface DraftRecord {
  readonly id: string;
  readonly draft: ArchitectureDraft;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface StoredValue<T> {
  readonly id: string;
  readonly value: T;
}

interface StoredBrowserSession {
  readonly metadata: SessionMetadataV1;
  readonly projectYaml: string;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('Browser storage request failed.')),
    );
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve());
    transaction.addEventListener('abort', () =>
      reject(transaction.error ?? new Error('Browser storage transaction was aborted.')),
    );
    transaction.addEventListener('error', () =>
      reject(transaction.error ?? new Error('Browser storage transaction failed.')),
    );
  });
}

function openDatabase(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, DATABASE_VERSION);
    request.addEventListener('upgradeneeded', (event) => {
      const database = request.result;
      for (const store of [DRAFT_STORE, SESSION_STORE, TEMPLATE_STORE]) {
        if (!database.objectStoreNames.contains(store))
          database.createObjectStore(store, { keyPath: 'id' });
      }
      if ((event as IDBVersionChangeEvent).oldVersion < 2) {
        const store = request.transaction!.objectStore(SESSION_STORE);
        const cursorRequest = store.openCursor();
        cursorRequest.addEventListener('success', () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const entry = cursor.value as StoredValue<unknown>;
          if (
            isObject(entry?.value) &&
            isObject(entry.value.artifacts) &&
            typeof entry.value.artifacts.projectYaml === 'string'
          ) {
            cursor.update({
              id: entry.id,
              value: {
                metadata: entry.value.metadata,
                projectYaml: entry.value.artifacts.projectYaml,
              },
            });
          }
          cursor.continue();
        });
      }
    });
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('Could not open browser storage.')),
    );
  });
}

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}

function parseArtifacts(input: unknown): ArtifactBundle {
  if (!isObject(input)) throw new Error('Stored artifacts are invalid.');
  const { projectYaml, agentPrompt, projectConfigHash, agentPromptHash, promptBlockIds } = input;
  if (
    typeof projectYaml !== 'string' ||
    typeof agentPrompt !== 'string' ||
    typeof projectConfigHash !== 'string' ||
    typeof agentPromptHash !== 'string' ||
    !Array.isArray(promptBlockIds) ||
    promptBlockIds.some((value) => typeof value !== 'string')
  ) {
    throw new Error('Stored artifacts are invalid.');
  }
  deserializeProjectConfig(projectYaml);
  if (hashText(projectYaml) !== projectConfigHash || hashText(agentPrompt) !== agentPromptHash)
    throw new Error('Stored artifact integrity verification failed.');
  return { projectYaml, agentPrompt, projectConfigHash, agentPromptHash, promptBlockIds };
}

function parseSessionRecord(input: unknown): SessionRecord {
  if (!isObject(input)) throw new Error('Stored session is invalid.');
  const metadata = parseSessionMetadata(input.metadata);
  const artifacts = parseArtifacts(input.artifacts);
  if (
    metadata.projectConfigHash !== artifacts.projectConfigHash ||
    metadata.agentPromptHash !== artifacts.agentPromptHash ||
    metadata.promptBlockIds.join('\0') !== artifacts.promptBlockIds.join('\0')
  ) {
    throw new Error('Stored session metadata does not match its artifacts.');
  }
  return { metadata, artifacts };
}

function parseStoredBrowserSession(input: unknown): StoredBrowserSession {
  if (!isObject(input) || typeof input.projectYaml !== 'string')
    throw new Error('Stored browser session is invalid.');
  const metadata = parseSessionMetadata(input.metadata);
  deserializeProjectConfig(input.projectYaml);
  if (hashText(input.projectYaml) !== metadata.projectConfigHash)
    throw new Error('Stored project.yaml integrity verification failed.');
  return { metadata, projectYaml: input.projectYaml };
}

function parseTemplateRecord(input: unknown): TemplateRecord {
  if (!isObject(input)) throw new Error('Stored template is invalid.');
  const metadata = parseTemplateMetadata(input.metadata);
  const config = parseProjectConfig(input.config);
  if (generateArtifacts(config).projectConfigHash !== metadata.projectConfigHash)
    throw new Error('Stored template integrity verification failed.');
  return { metadata, config };
}

function parseDraftRecord(input: unknown): DraftRecord {
  if (
    !isObject(input) ||
    typeof input.id !== 'string' ||
    typeof input.createdAt !== 'string' ||
    typeof input.updatedAt !== 'string'
  )
    throw new Error('Stored draft is invalid.');
  const draft = input.draft;
  if (
    !isObject(draft) ||
    typeof draft.projectName !== 'string' ||
    typeof draft.productSummary !== 'string' ||
    !Array.isArray(draft.uis) ||
    !Array.isArray(draft.services) ||
    !Array.isArray(draft.uiServices) ||
    !Array.isArray(draft.serviceDependencies) ||
    typeof draft.agentMode !== 'string'
  ) {
    throw new Error('Stored draft is invalid.');
  }
  return input as unknown as DraftRecord;
}

abstract class BrowserRepository {
  private readonly database: Promise<IDBDatabase>;
  protected constructor(factory: IDBFactory, databaseName: string) {
    this.database = openDatabase(factory, databaseName);
  }

  protected async write<T>(
    storeName: string,
    method: 'add' | 'put',
    entry: StoredValue<T>,
  ): Promise<void> {
    const database = await this.database;
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName)[method](entry);
    await transactionComplete(transaction);
  }
  protected async values<T>(storeName: string): Promise<StoredValue<T>[]> {
    const database = await this.database;
    const transaction = database.transaction(storeName, 'readonly');
    const values = (await requestResult(
      transaction.objectStore(storeName).getAll(),
    )) as StoredValue<T>[];
    await transactionComplete(transaction);
    return values;
  }
  protected async value<T>(storeName: string, id: string): Promise<StoredValue<T> | undefined> {
    const database = await this.database;
    const transaction = database.transaction(storeName, 'readonly');
    const value = (await requestResult(transaction.objectStore(storeName).get(id))) as
      StoredValue<T> | undefined;
    await transactionComplete(transaction);
    return value;
  }
  protected async remove(storeName: string, id: string): Promise<void> {
    const database = await this.database;
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(id);
    await transactionComplete(transaction);
  }
}

export class BrowserDraftRepository extends BrowserRepository {
  constructor(factory: IDBFactory = indexedDB, databaseName = 'systemsextant') {
    super(factory, databaseName);
  }
  async put(record: DraftRecord): Promise<void> {
    await this.write(DRAFT_STORE, 'put', { id: record.id, value: record });
  }
  async list(): Promise<readonly DraftRecord[]> {
    return (await this.values<DraftRecord>(DRAFT_STORE))
      .map((entry) => parseDraftRecord(entry.value))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
  async get(id: string): Promise<DraftRecord | undefined> {
    const entry = await this.value<DraftRecord>(DRAFT_STORE, id);
    return entry ? parseDraftRecord(entry.value) : undefined;
  }
  async delete(id: string): Promise<void> {
    await this.remove(DRAFT_STORE, id);
  }
}

export class BrowserSessionRepository extends BrowserRepository implements SessionRepository {
  constructor(factory: IDBFactory = indexedDB, databaseName = 'systemsextant') {
    super(factory, databaseName);
  }
  async create(record: SessionRecord): Promise<void> {
    const parsed = parseSessionRecord(record);
    const stored: StoredBrowserSession = {
      metadata: parsed.metadata,
      projectYaml: parsed.artifacts.projectYaml,
    };
    await this.write(SESSION_STORE, 'add', { id: parsed.metadata.id, value: stored });
  }
  async list(): Promise<readonly SessionMetadataV1[]> {
    return (await this.values<StoredBrowserSession>(SESSION_STORE))
      .map((entry) => parseStoredBrowserSession(entry.value).metadata)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
  async get(sessionId: string): Promise<SessionRecord | undefined> {
    const entry = await this.value<StoredBrowserSession>(SESSION_STORE, sessionId);
    if (!entry) return undefined;
    const stored = parseStoredBrowserSession(entry.value);
    const artifacts = generateArtifacts(deserializeProjectConfig(stored.projectYaml));
    return {
      metadata: parseSessionMetadata({
        ...stored.metadata,
        agentPromptHash: artifacts.agentPromptHash,
        promptBlockIds: artifacts.promptBlockIds,
      }),
      artifacts,
    };
  }
  async delete(sessionId: string): Promise<void> {
    await this.remove(SESSION_STORE, sessionId);
  }
}

export class BrowserTemplateRepository extends BrowserRepository implements TemplateRepository {
  constructor(factory: IDBFactory = indexedDB, databaseName = 'systemsextant') {
    super(factory, databaseName);
  }
  async create(record: TemplateRecord): Promise<void> {
    const parsed = parseTemplateRecord(record);
    await this.write(TEMPLATE_STORE, 'add', { id: parsed.metadata.id, value: parsed });
  }
  async update(record: TemplateRecord): Promise<void> {
    const parsed = parseTemplateRecord(record);
    await this.write(TEMPLATE_STORE, 'put', { id: parsed.metadata.id, value: parsed });
  }
  async list(): Promise<readonly TemplateMetadataV1[]> {
    return (await this.values<TemplateRecord>(TEMPLATE_STORE))
      .map((entry) => parseTemplateRecord(entry.value).metadata)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
  async get(templateId: string): Promise<TemplateRecord | undefined> {
    const entry = await this.value<TemplateRecord>(TEMPLATE_STORE, templateId);
    return entry ? parseTemplateRecord(entry.value) : undefined;
  }
  async delete(templateId: string): Promise<void> {
    await this.remove(TEMPLATE_STORE, templateId);
  }
}
