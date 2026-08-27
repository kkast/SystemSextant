import { generateArtifacts, type ArtifactBundle } from '../artifacts/index.js';
import { isProjectConfigV2, parseProjectConfig, type ProjectConfig } from '../schema/project-config.js';
import { SessionMetadataV1Schema, type SessionMetadataV1 } from '../schema/session.js';

export interface SessionRecord {
  readonly metadata: SessionMetadataV1;
  readonly artifacts: ArtifactBundle;
}

export interface SessionRepository {
  create(record: SessionRecord): Promise<void>;
  list(): Promise<readonly SessionMetadataV1[]>;
  get(sessionId: string): Promise<SessionRecord | undefined>;
  delete(sessionId: string): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  createSessionId(): string;
}

export interface PrepareSessionDependencies {
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly generatorVersion: string;
}

export function prepareCompletedSession(
  input: ProjectConfig,
  dependencies: PrepareSessionDependencies,
): SessionRecord {
  const config = parseProjectConfig(input);
  const artifacts = generateArtifacts(config);
  const timestamp = dependencies.clock.now().toISOString();
  const firstUi = isProjectConfigV2(config) ? config.components.find((component) => component.kind === 'ui') : undefined;
  const firstService = isProjectConfigV2(config) ? config.components.find((component) => component.kind === 'service') : undefined;
  const metadata = SessionMetadataV1Schema.parse({
    schemaVersion: 1,
    id: dependencies.ids.createSessionId(),
    title: config.name,
    createdAt: timestamp,
    updatedAt: timestamp,
    generatorVersion: dependencies.generatorVersion,
    frontend: isProjectConfigV2(config) ? (firstUi?.runtime ?? 'none') : config.frontend,
    backend: isProjectConfigV2(config) ? (firstService?.runtime ?? 'none') : config.backend,
    projectConfigHash: artifacts.projectConfigHash,
    agentPromptHash: artifacts.agentPromptHash,
    promptBlockIds: artifacts.promptBlockIds,
  });
  return { metadata, artifacts };
}

export async function createCompletedSession(
  repository: SessionRepository,
  input: ProjectConfig,
  dependencies: PrepareSessionDependencies,
): Promise<SessionRecord> {
  const record = prepareCompletedSession(input, dependencies);
  await repository.create(record);
  return record;
}

export async function ensureCompletedSession(
  repository: SessionRepository,
  input: ProjectConfig,
  dependencies: { readonly clock: Clock; readonly generatorVersion: string },
): Promise<{ readonly record: SessionRecord; readonly created: boolean }> {
  const config = parseProjectConfig(input);
  const artifacts = generateArtifacts(config);
  const existing = (await repository.list()).find(
    (session) => session.projectConfigHash === artifacts.projectConfigHash,
  );
  if (existing) {
    const record = await repository.get(existing.id);
    if (record) return { record, created: false };
  }

  const record = await createCompletedSession(repository, config, {
    clock: dependencies.clock,
    ids: { createSessionId: () => `session-${artifacts.projectConfigHash}` },
    generatorVersion: dependencies.generatorVersion,
  });
  return { record, created: true };
}
