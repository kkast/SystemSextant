import { z } from 'zod';
import { ArchitectureStarterSchema } from './project-config.js';

export const SessionMetadataV1Schema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  title: z.string().min(1).max(100),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  generatorVersion: z.string().min(1),
  architectureStarter: ArchitectureStarterSchema,
  projectConfigHash: z.string().regex(/^[a-f0-9]{64}$/),
  agentPromptHash: z.string().regex(/^[a-f0-9]{64}$/),
  promptBlockIds: z.array(z.string().min(1)),
});
export type SessionMetadataV1 = z.infer<typeof SessionMetadataV1Schema>;

export function parseSessionMetadata(input: unknown): SessionMetadataV1 {
  return SessionMetadataV1Schema.parse(input);
}
