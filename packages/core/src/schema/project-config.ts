import { z } from 'zod';

export const ArchitectureStarterSchema = z.enum([
  'nextjs',
  'nextjs-express',
  'typescript-cli',
  'custom-typescript',
]);
export type ArchitectureStarter = z.infer<typeof ArchitectureStarterSchema>;

export const CapabilitySchema = z.enum([
  'database',
  'authentication',
  'real-time',
  'background-jobs',
  'file-storage',
  'caching',
  'rate-limiting',
]);
export type Capability = z.infer<typeof CapabilitySchema>;

export const AgentModeSchema = z.enum(['plan-only', 'plan-then-build', 'direct-build']);
export type AgentMode = z.infer<typeof AgentModeSchema>;

export const ToolIdSchema = z.enum(['upstash-redis-cache', 'upstash-ratelimit', 'upstash-qstash']);
export type ToolId = z.infer<typeof ToolIdSchema>;

export const ComponentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum([
    'nextjs-app',
    'express-service',
    'typescript-cli',
    'custom-typescript',
    'background-worker',
  ]),
  technology: z.string().min(1),
  responsibilities: z.array(z.string().min(1)),
  capabilities: z.array(CapabilitySchema),
});
export type Component = z.infer<typeof ComponentSchema>;

export const ResourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['database', 'queue', 'object-storage', 'cache', 'rate-limit-store']),
  technology: z.string().min(1),
  purpose: z.string().min(1),
  ownerComponentId: z.string().min(1),
});
export type Resource = z.infer<typeof ResourceSchema>;

export const ConnectionSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  protocol: z.enum([
    'http',
    'database',
    'sse',
    'websocket',
    'queue',
    'object-storage',
    'cache',
    'rate-limit',
  ]),
  purpose: z.string().min(1),
});
export type Connection = z.infer<typeof ConnectionSchema>;

export const ContractSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['http-api', 'event', 'repository', 'storage', 'cache', 'rate-limit']),
  description: z.string().min(1),
  participants: z.array(z.string().min(1)).min(1),
});
export type Contract = z.infer<typeof ContractSchema>;

export const DecisionSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.array(z.string())]),
  source: z.enum(['default', 'user']),
  status: z.literal('confirmed'),
  rationale: z.string().min(1).optional(),
});
export type Decision = z.infer<typeof DecisionSchema>;

export const ProjectConfigV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.string().min(1).max(100),
    language: z.literal('typescript'),
    product: z.object({
      summary: z.string().min(1).max(2_000),
      goals: z.array(z.string()),
      constraints: z.array(z.string()),
    }),
    architectureStarter: ArchitectureStarterSchema,
    capabilities: z.array(CapabilitySchema),
    tools: z.array(ToolIdSchema).refine((items) => new Set(items).size === items.length),
    components: z.array(ComponentSchema).min(1),
    resources: z.array(ResourceSchema),
    connections: z.array(ConnectionSchema),
    contracts: z.array(ContractSchema),
    decisions: z.array(DecisionSchema),
    agentPreferences: z.object({
      mode: AgentModeSchema,
      questionPolicy: z.literal('blocking-only'),
    }),
  })
  .superRefine((config, context) => {
    const nodeIds = new Set<string>();
    for (const component of config.components) {
      if (nodeIds.has(component.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate component or resource ID: ${component.id}`,
          path: ['components'],
        });
      }
      nodeIds.add(component.id);
    }

    for (const resource of config.resources) {
      if (nodeIds.has(resource.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate component or resource ID: ${resource.id}`,
          path: ['resources'],
        });
      }
      nodeIds.add(resource.id);

      if (!config.components.some((component) => component.id === resource.ownerComponentId)) {
        context.addIssue({
          code: 'custom',
          message: `Unknown resource owner: ${resource.ownerComponentId}`,
          path: ['resources'],
        });
      }
    }

    const connectionIds = new Set<string>();
    for (const connection of config.connections) {
      if (connectionIds.has(connection.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate connection ID: ${connection.id}`,
          path: ['connections'],
        });
      }
      connectionIds.add(connection.id);

      if (!nodeIds.has(connection.from) || !nodeIds.has(connection.to)) {
        context.addIssue({
          code: 'custom',
          message: `Dangling connection: ${connection.id}`,
          path: ['connections'],
        });
      }

      if (connection.from === connection.to) {
        context.addIssue({
          code: 'custom',
          message: `Self-connection is not allowed: ${connection.id}`,
          path: ['connections'],
        });
      }
    }

    const decisionKeys = new Set<string>();
    for (const decision of config.decisions) {
      if (decisionKeys.has(decision.key)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate decision key: ${decision.key}`,
          path: ['decisions'],
        });
      }
      decisionKeys.add(decision.key);
    }
  });

export type ProjectConfigV1 = z.infer<typeof ProjectConfigV1Schema>;

export function parseProjectConfig(input: unknown): ProjectConfigV1 {
  return ProjectConfigV1Schema.parse(input);
}
