import { z } from 'zod';

export const FrontendSchema = z.enum(['nextjs', 'vite-vanilla', 'none']);
export type Frontend = z.infer<typeof FrontendSchema>;

export const BackendSchema = z.enum(['nextjs', 'express', 'cloudflare-workers', 'none']);
export type Backend = z.infer<typeof BackendSchema>;

export const DeploymentTargetSchema = z.enum([
  'vercel',
  'render',
  'local-only',
  'vps',
  'cloudflare',
]);
export type DeploymentTarget = z.infer<typeof DeploymentTargetSchema>;

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

export const ToolIdSchema = z.enum([
  'upstash-redis-cache',
  'upstash-ratelimit',
  'upstash-qstash',
  'cloudflare-cache',
  'cloudflare-ratelimit',
  'cloudflare-queues',
]);
export type ToolId = z.infer<typeof ToolIdSchema>;

export const ComponentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum([
    'nextjs-app',
    'vite-vanilla-app',
    'express-service',
    'cloudflare-worker',
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
      summary: z.string().max(2_000),
      goals: z.array(z.string()),
      constraints: z.array(z.string()),
    }),
    frontend: FrontendSchema,
    backend: BackendSchema,
    deployment: z.object({
      frontend: DeploymentTargetSchema.optional(),
      backend: DeploymentTargetSchema.optional(),
    }),
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
    if (config.frontend !== 'none' && !config.deployment.frontend) {
      context.addIssue({
        code: 'custom',
        message: 'Frontend deployment target is required.',
        path: ['deployment', 'frontend'],
      });
    }
    if (config.frontend === 'none' && config.deployment.frontend) {
      context.addIssue({
        code: 'custom',
        message: 'A project without a frontend cannot have a frontend deployment target.',
        path: ['deployment', 'frontend'],
      });
    }
    if (config.backend !== 'none' && config.backend !== 'nextjs' && !config.deployment.backend) {
      context.addIssue({
        code: 'custom',
        message: 'Backend deployment target is required.',
        path: ['deployment', 'backend'],
      });
    }
    if ((config.backend === 'none' || config.backend === 'nextjs') && config.deployment.backend) {
      context.addIssue({
        code: 'custom',
        message: 'This backend does not use an independent deployment target.',
        path: ['deployment', 'backend'],
      });
    }
    if (
      config.backend === 'express' &&
      config.deployment.backend &&
      !['render', 'local-only', 'vps'].includes(config.deployment.backend)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Express deployment target is incompatible.',
        path: ['deployment', 'backend'],
      });
    }
    if (
      config.backend === 'cloudflare-workers' &&
      config.deployment.backend &&
      !['cloudflare', 'local-only'].includes(config.deployment.backend)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Cloudflare Workers deployment target is incompatible.',
        path: ['deployment', 'backend'],
      });
    }
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

/**
 * V2 models the deployable system directly.  `frontend` and `backend` were useful
 * shortcuts for V1, but become ambiguous once a project has more than one UI or
 * independently deployed service.
 */
export const UiRoleSchema = z.enum([
  'admin',
  'business-client',
  'user-client',
  'landing-page',
  'custom',
]);
export type UiRole = z.infer<typeof UiRoleSchema>;

const V2UiComponentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  kind: z.literal('ui'),
  role: UiRoleSchema,
  runtime: FrontendSchema.exclude(['none']),
  deployment: DeploymentTargetSchema,
  description: z.string().max(2_000),
  responsibilities: z.array(z.string().min(1)).default([]),
  capabilities: z.array(CapabilitySchema).default([]),
});

const V2ServiceComponentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  kind: z.literal('service'),
  runtime: BackendSchema.exclude(['none']),
  /** Next.js service features are deployed with the selected Next.js UI. */
  hostUiId: z.string().min(1).optional(),
  deployment: DeploymentTargetSchema.optional(),
  description: z.string().max(2_000),
  responsibilities: z.array(z.string().min(1)).default([]),
  capabilities: z.array(CapabilitySchema).default([]),
});

export const V2ComponentSchema = z.discriminatedUnion('kind', [
  V2UiComponentSchema,
  V2ServiceComponentSchema,
]);
export type V2Component = z.infer<typeof V2ComponentSchema>;

export const V2ResourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['database', 'cache', 'object-storage', 'queue', 'rate-limit-store']),
  technology: z.string().min(1),
  purpose: z.string().min(1),
  ownerComponentId: z.string().min(1),
  consumerComponentIds: z.array(z.string().min(1)).min(1),
});
export type V2Resource = z.infer<typeof V2ResourceSchema>;

export const ProjectConfigV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    name: z.string().min(1).max(100),
    language: z.literal('typescript'),
    product: z.object({
      summary: z.string().max(2_000),
      goals: z.array(z.string()),
      constraints: z.array(z.string()),
    }),
    capabilities: z.array(CapabilitySchema),
    tools: z.array(ToolIdSchema).refine((items) => new Set(items).size === items.length),
    components: z.array(V2ComponentSchema).min(1),
    resources: z.array(V2ResourceSchema),
    connections: z.array(ConnectionSchema),
    contracts: z.array(ContractSchema),
    decisions: z.array(DecisionSchema),
    agentPreferences: z.object({
      mode: AgentModeSchema,
      questionPolicy: z.literal('blocking-only'),
    }),
  })
  .superRefine((config, context) => {
    const ids = new Set<string>();
    for (const component of config.components) {
      if (ids.has(component.id))
        context.addIssue({ code: 'custom', message: `Duplicate component ID: ${component.id}`, path: ['components'] });
      ids.add(component.id);
      if (component.kind === 'ui' && component.runtime === 'nextjs' && component.deployment === 'local-only') continue;
      if (component.kind === 'service') {
        if (component.runtime === 'nextjs') {
          const host = config.components.find((candidate) => candidate.id === component.hostUiId);
          if (!component.hostUiId || !host || host.kind !== 'ui' || host.runtime !== 'nextjs')
            context.addIssue({ code: 'custom', message: 'Next.js service features require a Next.js host UI.', path: ['components'] });
          if (component.deployment)
            context.addIssue({ code: 'custom', message: 'Next.js service features share their host UI deployment.', path: ['components'] });
        } else if (!component.deployment) {
          context.addIssue({ code: 'custom', message: 'An independent service requires a deployment target.', path: ['components'] });
        } else if (component.runtime === 'express' && !['render', 'vps', 'local-only'].includes(component.deployment)) {
          context.addIssue({ code: 'custom', message: 'Express deployment target is incompatible.', path: ['components'] });
        } else if (component.runtime === 'cloudflare-workers' && !['cloudflare', 'local-only'].includes(component.deployment)) {
          context.addIssue({ code: 'custom', message: 'Cloudflare Workers deployment target is incompatible.', path: ['components'] });
        }
      }
    }
    const resourceKinds = new Set<string>();
    for (const resource of config.resources) {
      if (ids.has(resource.id))
        context.addIssue({ code: 'custom', message: `Duplicate component or resource ID: ${resource.id}`, path: ['resources'] });
      ids.add(resource.id);
      if (resourceKinds.has(resource.kind))
        context.addIssue({ code: 'custom', message: `Only one ${resource.kind} is supported currently.`, path: ['resources'] });
      resourceKinds.add(resource.kind);
      if (!config.components.some((component) => component.id === resource.ownerComponentId))
        context.addIssue({ code: 'custom', message: `Unknown resource owner: ${resource.ownerComponentId}`, path: ['resources'] });
      for (const consumerId of resource.consumerComponentIds) {
        if (!config.components.some((component) => component.id === consumerId))
          context.addIssue({ code: 'custom', message: `Unknown resource consumer: ${consumerId}`, path: ['resources'] });
      }
    }
    const connectionIds = new Set<string>();
    for (const connection of config.connections) {
      if (connectionIds.has(connection.id))
        context.addIssue({ code: 'custom', message: `Duplicate connection ID: ${connection.id}`, path: ['connections'] });
      connectionIds.add(connection.id);
      if (!ids.has(connection.from) || !ids.has(connection.to))
        context.addIssue({ code: 'custom', message: `Dangling connection: ${connection.id}`, path: ['connections'] });
      if (connection.from === connection.to)
        context.addIssue({ code: 'custom', message: `Self-connection is not allowed: ${connection.id}`, path: ['connections'] });
    }
  });
export type ProjectConfigV2 = z.infer<typeof ProjectConfigV2Schema>;

export const ProjectConfigSchema = z.union([ProjectConfigV1Schema, ProjectConfigV2Schema]);
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

export function isProjectConfigV2(config: ProjectConfig): config is ProjectConfigV2 {
  return config.schemaVersion === 2;
}

export function parseProjectConfig(input: unknown): ProjectConfig {
  return ProjectConfigSchema.parse(input);
}
