import { access, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  deserializeProjectConfig,
  deserializeSessionMetadata,
  hashText,
  serializeSessionMetadata,
  type SessionMetadataV1,
  type SessionRecord,
  type SessionRepository,
} from '@systemsextant/core';

const SESSION_FILE = 'session.yaml';
const PROJECT_FILE = 'project.yaml';
const PROMPT_FILE = 'AGENT_PROMPT.md';

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function safeDirectorySegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export class FileSessionRepository implements SessionRepository {
  readonly sessionsDirectory: string;

  constructor(readonly dataDirectory: string) {
    this.sessionsDirectory = path.join(dataDirectory, 'sessions');
  }

  async create(record: SessionRecord): Promise<void> {
    await this.prepareDirectory();
    if (await this.findSessionDirectory(record.metadata.id)) {
      throw new Error(`Session already exists: ${record.metadata.id}`);
    }

    const stagingDirectory = await mkdtemp(
      path.join(this.sessionsDirectory, `.staging-${safeDirectorySegment(record.metadata.id)}-`),
    );
    const timestamp = record.metadata.createdAt.replace(/[:.]/g, '-');
    const destination = path.join(
      this.sessionsDirectory,
      `${timestamp}-${safeDirectorySegment(record.metadata.id)}`,
    );

    try {
      await Promise.all([
        writeFile(
          path.join(stagingDirectory, SESSION_FILE),
          serializeSessionMetadata(record.metadata),
          { encoding: 'utf8', mode: 0o600, flush: true },
        ),
        writeFile(path.join(stagingDirectory, PROJECT_FILE), record.artifacts.projectYaml, {
          encoding: 'utf8',
          mode: 0o600,
          flush: true,
        }),
        writeFile(path.join(stagingDirectory, PROMPT_FILE), record.artifacts.agentPrompt, {
          encoding: 'utf8',
          mode: 0o600,
          flush: true,
        }),
      ]);
      await rename(stagingDirectory, destination);
    } catch (error) {
      await rm(stagingDirectory, { recursive: true, force: true });
      throw error;
    }
  }

  async list(): Promise<readonly SessionMetadataV1[]> {
    await this.prepareDirectory();
    const entries = await readdir(this.sessionsDirectory, { withFileTypes: true });
    const metadata = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map(async (entry) => {
          try {
            const value = await readFile(
              path.join(this.sessionsDirectory, entry.name, SESSION_FILE),
              'utf8',
            );
            return deserializeSessionMetadata(value);
          } catch {
            return undefined;
          }
        }),
    );
    return metadata
      .filter((item): item is SessionMetadataV1 => item !== undefined)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async get(sessionId: string): Promise<SessionRecord | undefined> {
    await this.prepareDirectory();
    const directory = await this.findSessionDirectory(sessionId);
    if (!directory) return undefined;

    const [metadataValue, projectYaml, agentPrompt] = await Promise.all([
      readFile(path.join(directory, SESSION_FILE), 'utf8'),
      readFile(path.join(directory, PROJECT_FILE), 'utf8'),
      readFile(path.join(directory, PROMPT_FILE), 'utf8'),
    ]);
    const metadata = deserializeSessionMetadata(metadataValue);
    deserializeProjectConfig(projectYaml);

    const projectConfigHash = hashText(projectYaml);
    const agentPromptHash = hashText(agentPrompt);
    if (
      projectConfigHash !== metadata.projectConfigHash ||
      agentPromptHash !== metadata.agentPromptHash
    ) {
      throw new Error(`Session artifact integrity check failed: ${sessionId}`);
    }

    return {
      metadata,
      artifacts: {
        projectYaml,
        agentPrompt,
        projectConfigHash,
        agentPromptHash,
        promptBlockIds: metadata.promptBlockIds,
      },
    };
  }

  async delete(sessionId: string): Promise<void> {
    const directory = await this.findSessionDirectory(sessionId);
    if (!directory) return;
    await rm(directory, { recursive: true, force: false });
  }

  private async prepareDirectory(): Promise<void> {
    await mkdir(this.sessionsDirectory, { recursive: true, mode: 0o700 });
    const entries = await readdir(this.sessionsDirectory, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('.staging-'))
        .map((entry) =>
          rm(path.join(this.sessionsDirectory, entry.name), { recursive: true, force: true }),
        ),
    );
  }

  private async findSessionDirectory(sessionId: string): Promise<string | undefined> {
    await mkdir(this.sessionsDirectory, { recursive: true, mode: 0o700 });
    const entries = await readdir(this.sessionsDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const directory = path.join(this.sessionsDirectory, entry.name);
      try {
        const metadataValue = await readFile(path.join(directory, SESSION_FILE), 'utf8');
        if (deserializeSessionMetadata(metadataValue).id === sessionId) return directory;
      } catch {
        continue;
      }
    }
    return undefined;
  }
}
