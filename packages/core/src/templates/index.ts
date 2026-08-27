import { z } from 'zod';
import { generateArtifacts, type ArtifactBundle } from '../artifacts/index.js';
import { parseProjectConfig, type ProjectConfig } from '../schema/project-config.js';

export const TemplateMetadataV1Schema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  title: z.string().min(1).max(100),
  description: z.string().max(2_000),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  projectConfigHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type TemplateMetadataV1 = z.infer<typeof TemplateMetadataV1Schema>;

export function parseTemplateMetadata(input: unknown): TemplateMetadataV1 {
  return TemplateMetadataV1Schema.parse(input);
}

export interface TemplateRecord {
  readonly metadata: TemplateMetadataV1;
  readonly config: ProjectConfig;
}

export interface TemplateRepository {
  create(record: TemplateRecord): Promise<void>;
  list(): Promise<readonly TemplateMetadataV1[]>;
  get(templateId: string): Promise<TemplateRecord | undefined>;
  update(record: TemplateRecord): Promise<void>;
  delete(templateId: string): Promise<void>;
}

export function prepareTemplate(
  input: ProjectConfig,
  dependencies: { readonly id: string; readonly title: string; readonly description: string; readonly now: Date },
): TemplateRecord {
  const config = parseProjectConfig(input);
  const artifacts: ArtifactBundle = generateArtifacts(config);
  const timestamp = dependencies.now.toISOString();
  return {
    metadata: TemplateMetadataV1Schema.parse({
      schemaVersion: 1, id: dependencies.id, title: dependencies.title.trim(), description: dependencies.description.trim(),
      createdAt: timestamp, updatedAt: timestamp, projectConfigHash: artifacts.projectConfigHash,
    }),
    config,
  };
}
