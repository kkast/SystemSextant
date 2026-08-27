import { generateArtifacts, type ArtifactBundle } from '../artifacts/index.js';
import { parseProjectConfig, type ProjectConfigV1 } from '../schema/project-config.js';
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
  input: ProjectConfigV1,
  dependencies: PrepareSessionDependencies,
): SessionRecord {
  const config = parseProjectConfig(input);
  const artifacts = generateArtifacts(config);
  const timestamp = dependencies.clock.now().toISOString();
  const metadata = SessionMetadataV1Schema.parse({
    schemaVersion: 1,
    id: dependencies.ids.createSessionId(),
    title: config.name,
    createdAt: timestamp,
    updatedAt: timestamp,
    generatorVersion: dependencies.generatorVersion,
    frontend: config.frontend,
    backend: config.backend,
    projectConfigHash: artifacts.projectConfigHash,
    agentPromptHash: artifacts.agentPromptHash,
    promptBlockIds: artifacts.promptBlockIds,
  });
  return { metadata, artifacts };
}

export async function createCompletedSession(
  repository: SessionRepository,
  input: ProjectConfigV1,
  dependencies: PrepareSessionDependencies,
): Promise<SessionRecord> {
  const record = prepareCompletedSession(input, dependencies);
  await repository.create(record);
  return record;
}
