import { z } from 'zod';
import { normalizeCapabilities } from '../catalog/index.js';
import {
  AgentModeSchema,
  BackendSchema,
  DeploymentTargetSchema,
  FrontendSchema,
  ProjectConfigV2Schema,
  UiRoleSchema,
  type ProjectConfigV2,
} from '../schema/project-config.js';

const IdSchema = z.string().regex(/^[a-z][a-z0-9-]*$/, 'Use lowercase letters, numbers, and hyphens.');
const DescriptionSchema = z.string().trim().max(2_000);

export const UiDraftSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(100),
  role: UiRoleSchema,
  runtime: FrontendSchema.exclude(['none']),
  deployment: DeploymentTargetSchema,
  description: DescriptionSchema,
});
export type UiDraft = z.infer<typeof UiDraftSchema>;

export const ServiceDraftSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(100),
  runtime: BackendSchema.exclude(['none']),
  hostUiId: IdSchema.optional(),
  deployment: DeploymentTargetSchema.optional(),
  description: DescriptionSchema,
});
export type ServiceDraft = z.infer<typeof ServiceDraftSchema>;

const ResourceUsersSchema = z.object({ ownerComponentId: IdSchema, consumerComponentIds: z.array(IdSchema).min(1) });

export const ArchitectureDraftSchema = z.object({
  projectName: z.string().trim().min(1).max(100),
  productSummary: z.string().trim().max(2_000),
  uis: z.array(UiDraftSchema),
  services: z.array(ServiceDraftSchema),
  /** A UI can call no service (for example, a standalone landing page). */
  uiServices: z.array(z.object({ uiId: IdSchema, serviceIds: z.array(IdSchema) })),
  serviceDependencies: z.array(z.object({ serviceId: IdSchema, dependencyIds: z.array(IdSchema) })),
  database: z
    .object({
      type: z.enum(['postgresql', 'mongodb', 'cloudflare-d1']),
      provider: z.enum(['supabase', 'neon', 'mongodb-atlas', 'cloudflare']),
      dataAccess: z.enum(['prisma', 'drizzle', 'native-driver']),
      users: ResourceUsersSchema,
    })
    .optional(),
  cache: z.object({ provider: z.enum(['upstash', 'cloudflare']), users: ResourceUsersSchema }).optional(),
  rateLimit: z.object({ provider: z.enum(['upstash', 'cloudflare']), users: ResourceUsersSchema }).optional(),
  queue: z.object({ provider: z.enum(['upstash', 'cloudflare']), users: ResourceUsersSchema }).optional(),
  scheduledJobs: z.boolean().default(false),
  fileStorage: z
    .object({ provider: z.enum(['supabase-storage', 'cloudflare-r2']), users: ResourceUsersSchema })
    .optional(),
  realtimeModes: z.array(z.enum(['sse', 'websocket'])).default([]),
  authService: z.enum(['none', 'supabase-auth', 'authjs', 'privy']).default('none'),
  loginMethods: z.array(z.enum(['github', 'email-password', 'magic-link', 'wallet'])).default([]),
  agentMode: AgentModeSchema,
});
export type ArchitectureDraft = z.infer<typeof ArchitectureDraftSchema>;

export function createArchitectureDraft(): ArchitectureDraft {
  return {
    projectName: '', productSummary: '', uis: [], services: [], uiServices: [], serviceDependencies: [], realtimeModes: [], scheduledJobs: false, authService: 'none', loginMethods: [], agentMode: 'plan-then-build',
  };
}

function validateDraft(draft: ArchitectureDraft): ArchitectureDraft {
  const parsed = ArchitectureDraftSchema.parse(draft);
  const ids = [...parsed.uis, ...parsed.services].map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error('UI and service IDs must be unique.');
  if (ids.length === 0) throw new Error('Add at least one UI or service.');
  const componentIds = new Set(ids);
  for (const relation of parsed.uiServices) {
    if (!parsed.uis.some((ui) => ui.id === relation.uiId)) throw new Error(`Unknown UI: ${relation.uiId}`);
    for (const serviceId of relation.serviceIds) if (!parsed.services.some((service) => service.id === serviceId)) throw new Error(`Unknown service: ${serviceId}`);
  }
  for (const relation of parsed.serviceDependencies) {
    if (!parsed.services.some((service) => service.id === relation.serviceId)) throw new Error(`Unknown service: ${relation.serviceId}`);
    for (const dependencyId of relation.dependencyIds) {
      if (!parsed.services.some((service) => service.id === dependencyId) || dependencyId === relation.serviceId)
        throw new Error(`Invalid service dependency: ${dependencyId}`);
    }
  }
  for (const resource of [parsed.database, parsed.cache, parsed.rateLimit, parsed.queue, parsed.fileStorage]) {
    if (!resource) continue;
    if (!componentIds.has(resource.users.ownerComponentId)) throw new Error('A resource owner must be a UI or service.');
    for (const consumerId of resource.users.consumerComponentIds)
      if (!componentIds.has(consumerId)) throw new Error(`Unknown resource consumer: ${consumerId}`);
  }
  for (const service of parsed.services) {
    if (service.runtime === 'nextjs') {
      const host = parsed.uis.find((ui) => ui.id === service.hostUiId);
      if (!host || host.runtime !== 'nextjs') throw new Error('Next.js service features require a Next.js UI host.');
    } else if (!service.deployment) throw new Error('An independent service requires a deployment target.');
  }
  const hasCloudflareWorker = parsed.services.some((service) => service.runtime === 'cloudflare-workers');
  if (parsed.database) {
    const compatible = {
      postgresql: { providers: ['supabase', 'neon'], access: ['prisma', 'drizzle'] },
      mongodb: { providers: ['mongodb-atlas'], access: ['prisma', 'native-driver'] },
      'cloudflare-d1': { providers: ['cloudflare'], access: ['drizzle', 'native-driver'] },
    } as const;
    const allowed = compatible[parsed.database.type];
    if (!(allowed.providers as readonly string[]).includes(parsed.database.provider) || !(allowed.access as readonly string[]).includes(parsed.database.dataAccess))
      throw new Error('Choose a database provider and data-access option compatible with the database.');
    if (parsed.database.type === 'cloudflare-d1' && !hasCloudflareWorker)
      throw new Error('Cloudflare D1 requires a Cloudflare Workers service.');
  }
  if ([parsed.cache, parsed.rateLimit, parsed.queue].some((resource) => resource?.provider === 'cloudflare') && !hasCloudflareWorker)
    throw new Error('Cloudflare-native infrastructure requires a Cloudflare Workers service.');
  if (parsed.scheduledJobs && !hasCloudflareWorker)
    throw new Error('Scheduled jobs require a Cloudflare Workers service.');
  if (parsed.realtimeModes.length > 0 && parsed.services.length === 0)
    throw new Error('Real-time communication requires a service.');
  if (parsed.realtimeModes.includes('websocket') && !parsed.services.some((service) => service.runtime === 'express'))
    throw new Error('WebSockets require an Express service in the current product.');
  const authService = parsed.authService;
  if (authService !== 'none') {
    if (parsed.loginMethods.length === 0) throw new Error('Choose at least one login method.');
    const compatibleMethods = {
      'supabase-auth': ['github', 'email-password', 'magic-link'],
      authjs: ['github', 'magic-link'],
      privy: ['github', 'magic-link', 'wallet'],
    } as const;
    if (parsed.loginMethods.some((method) => !(compatibleMethods[authService] as readonly string[]).includes(method)))
      throw new Error('Choose login methods supported by the authentication service.');
  }
  return parsed;
}

const databaseTechnology = {
  supabase: 'Supabase PostgreSQL', neon: 'Neon PostgreSQL', 'mongodb-atlas': 'MongoDB Atlas', cloudflare: 'Cloudflare D1',
} as const;
const accessTechnology = { prisma: 'Prisma ORM', drizzle: 'Drizzle ORM', 'native-driver': 'native driver / binding API' } as const;

export function normalizeArchitectureDraft(input: ArchitectureDraft): ProjectConfigV2 {
  const draft = validateDraft(input);
  const components = [
    ...draft.uis.map((ui) => ({
      id: ui.id, name: ui.name, kind: 'ui' as const, role: ui.role, runtime: ui.runtime, deployment: ui.deployment,
      description: ui.description, responsibilities: ['Browser user interface'], capabilities: [] as ProjectConfigV2['capabilities'],
    })),
    ...draft.services.map((service) => ({
      id: service.id, name: service.name, kind: 'service' as const, runtime: service.runtime,
      ...(service.hostUiId ? { hostUiId: service.hostUiId } : {}),
      ...(service.runtime === 'nextjs' ? {} : { deployment: service.deployment }),
      description: service.description, responsibilities: ['Business operations and integration boundary'], capabilities: [] as ProjectConfigV2['capabilities'],
    })),
  ];
  const connections: ProjectConfigV2['connections'] = [];
  const contracts: ProjectConfigV2['contracts'] = [];
  for (const relation of draft.uiServices) for (const serviceId of relation.serviceIds) {
    connections.push({ id: `${relation.uiId}-to-${serviceId}`, from: relation.uiId, to: serviceId, protocol: 'http', purpose: 'UI application API requests' });
    contracts.push({ id: `${relation.uiId}-${serviceId}-api`, name: `${relation.uiId} to ${serviceId} API`, kind: 'http-api', description: 'Stable contract between a UI and service.', participants: [relation.uiId, serviceId] });
  }
  for (const relation of draft.serviceDependencies) for (const dependencyId of relation.dependencyIds) {
    connections.push({ id: `${relation.serviceId}-to-${dependencyId}`, from: relation.serviceId, to: dependencyId, protocol: 'http', purpose: 'Service-to-service operation' });
    contracts.push({ id: `${relation.serviceId}-${dependencyId}-api`, name: `${relation.serviceId} to ${dependencyId} API`, kind: 'http-api', description: 'Stable service-to-service contract.', participants: [relation.serviceId, dependencyId] });
  }
  const resources: ProjectConfigV2['resources'] = [];
  const connectResource = (id: string, protocol: 'database' | 'cache' | 'rate-limit' | 'queue' | 'object-storage', purpose: string, users: z.infer<typeof ResourceUsersSchema>) => {
    for (const consumerId of users.consumerComponentIds) connections.push({ id: `${consumerId}-to-${id}`, from: consumerId, to: id, protocol, purpose });
  };
  if (draft.database) {
    const { users } = draft.database;
    resources.push({ id: 'primary-database', name: 'Primary database', kind: 'database', technology: `${databaseTechnology[draft.database.provider]} with ${accessTechnology[draft.database.dataAccess]}`, purpose: 'Persistent application data', ownerComponentId: users.ownerComponentId, consumerComponentIds: users.consumerComponentIds });
    connectResource('primary-database', 'database', 'Read and write persistent application data', users);
  }
  if (draft.cache) {
    const { users } = draft.cache;
    resources.push({ id: 'application-cache', name: 'Application cache', kind: 'cache', technology: draft.cache.provider === 'cloudflare' ? 'Cloudflare Workers Cache API / KV' : 'Upstash Redis', purpose: 'Reduce repeated work', ownerComponentId: users.ownerComponentId, consumerComponentIds: users.consumerComponentIds });
    connectResource('application-cache', 'cache', 'Read, populate, invalidate, and expire cached values', users);
  }
  if (draft.rateLimit) {
    const { users } = draft.rateLimit;
    resources.push({ id: 'rate-limit-store', name: 'Rate-limit state', kind: 'rate-limit-store', technology: draft.rateLimit.provider === 'cloudflare' ? 'Cloudflare Workers Rate Limiting' : 'Upstash Redis with @upstash/ratelimit', purpose: 'Coordinate limits across runtime instances', ownerComponentId: users.ownerComponentId, consumerComponentIds: users.consumerComponentIds });
    connectResource('rate-limit-store', 'rate-limit', 'Check and update distributed rate-limit state', users);
  }
  if (draft.queue) {
    const { users } = draft.queue;
    resources.push({ id: 'job-queue', name: 'Message queue', kind: 'queue', technology: draft.queue.provider === 'cloudflare' ? 'Cloudflare Queues' : 'Upstash QStash', purpose: 'Reliable delivery, retries, scheduling, and queueing', ownerComponentId: users.ownerComponentId, consumerComponentIds: users.consumerComponentIds });
    connectResource('job-queue', 'queue', 'Publish and consume background work', users);
  }
  if (draft.fileStorage) {
    const { users } = draft.fileStorage;
    resources.push({ id: 'object-storage', name: 'Object storage', kind: 'object-storage', technology: draft.fileStorage.provider === 'cloudflare-r2' ? 'Cloudflare R2' : 'Supabase Storage', purpose: 'Store user and application files', ownerComponentId: users.ownerComponentId, consumerComponentIds: users.consumerComponentIds });
    connectResource('object-storage', 'object-storage', 'Store and retrieve files', users);
  }
  const selectedCapabilities = normalizeCapabilities([
    ...(draft.database ? ['database' as const] : []), ...(draft.cache ? ['caching' as const] : []), ...(draft.rateLimit ? ['rate-limiting' as const] : []), ...(draft.queue ? ['background-jobs' as const] : []), ...(draft.scheduledJobs ? ['scheduled-jobs' as const] : []), ...(draft.fileStorage ? ['file-storage' as const] : []), ...(draft.realtimeModes.length ? ['real-time' as const] : []), ...(draft.authService !== 'none' ? ['authentication' as const] : []),
  ]);
  const tools = [
    ...(draft.cache?.provider === 'upstash' ? ['upstash-redis-cache' as const] : []),
    ...(draft.cache?.provider === 'cloudflare' ? ['cloudflare-cache' as const] : []),
    ...(draft.rateLimit?.provider === 'upstash' ? ['upstash-ratelimit' as const] : []),
    ...(draft.rateLimit?.provider === 'cloudflare' ? ['cloudflare-ratelimit' as const] : []),
    ...(draft.queue?.provider === 'upstash' ? ['upstash-qstash' as const] : []),
    ...(draft.queue?.provider === 'cloudflare' ? ['cloudflare-queues' as const] : []),
    ...(draft.scheduledJobs ? ['cloudflare-cron' as const] : []),
  ];
  for (const component of components) {
    if (resources.some((resource) => resource.consumerComponentIds.includes(component.id))) component.capabilities.push(...selectedCapabilities.filter((capability) => capability === 'database' || capability === 'caching' || capability === 'rate-limiting' || capability === 'background-jobs' || capability === 'file-storage'));
    if (draft.realtimeModes.length && component.kind === 'service') component.capabilities.push('real-time');
    if (draft.scheduledJobs && component.kind === 'service' && component.runtime === 'cloudflare-workers')
      component.capabilities.push('scheduled-jobs');
    if (draft.authService !== 'none') component.capabilities.push('authentication');
  }
  return ProjectConfigV2Schema.parse({
    schemaVersion: 2, name: draft.projectName, language: 'typescript', product: { summary: draft.productSummary, goals: [], constraints: [] },
    capabilities: selectedCapabilities, tools, components, resources, connections, contracts,
    decisions: [
      { key: 'architecture.ui-count', value: String(draft.uis.length), source: 'user', status: 'confirmed' },
      { key: 'architecture.service-count', value: String(draft.services.length), source: 'user', status: 'confirmed' },
      { key: 'realtime.modes', value: draft.realtimeModes, source: 'user', status: 'confirmed' },
      { key: 'authentication.service', value: draft.authService, source: 'user', status: 'confirmed' },
      { key: 'authentication.login-methods', value: draft.loginMethods, source: 'user', status: 'confirmed' },
      { key: 'agent.mode', value: draft.agentMode, source: 'user', status: 'confirmed' },
      ...(draft.scheduledJobs ? [{ key: 'scheduled-jobs.provider', value: 'cloudflare', source: 'user' as const, status: 'confirmed' as const }] : []),
    ],
    agentPreferences: { mode: draft.agentMode, questionPolicy: 'blocking-only' },
  });
}

/** Converts a V2 configuration back into the editable questionnaire representation for templates. */
export function architectureDraftFromConfig(config: ProjectConfigV2): ArchitectureDraft {
  const database = config.resources.find((resource) => resource.kind === 'database');
  const cache = config.resources.find((resource) => resource.kind === 'cache');
  const rateLimit = config.resources.find((resource) => resource.kind === 'rate-limit-store');
  const queue = config.resources.find((resource) => resource.kind === 'queue');
  const fileStorage = config.resources.find((resource) => resource.kind === 'object-storage');
  const resourceUsers = (resource: typeof database) => resource ? { ownerComponentId: resource.ownerComponentId, consumerComponentIds: resource.consumerComponentIds } : undefined;
  const uiServices = new Map<string, string[]>();
  const serviceDependencies = new Map<string, string[]>();
  for (const connection of config.connections) {
    const source = config.components.find((component) => component.id === connection.from);
    const target = config.components.find((component) => component.id === connection.to);
    if (source?.kind === 'ui' && target?.kind === 'service')
      uiServices.set(source.id, [...(uiServices.get(source.id) ?? []), target.id]);
    if (source?.kind === 'service' && target?.kind === 'service')
      serviceDependencies.set(source.id, [...(serviceDependencies.get(source.id) ?? []), target.id]);
  }
  return ArchitectureDraftSchema.parse({
    projectName: config.name, productSummary: config.product.summary,
    uis: config.components.filter((component) => component.kind === 'ui').map((component) => ({ id: component.id, name: component.name, role: component.role, runtime: component.runtime, deployment: component.deployment, description: component.description })),
    services: config.components.filter((component) => component.kind === 'service').map((component) => ({ id: component.id, name: component.name, runtime: component.runtime, ...(component.hostUiId ? { hostUiId: component.hostUiId } : {}), ...(component.deployment ? { deployment: component.deployment } : {}), description: component.description })),
    uiServices: [...uiServices].map(([uiId, serviceIds]) => ({ uiId, serviceIds })),
    serviceDependencies: [...serviceDependencies].map(([serviceId, dependencyIds]) => ({ serviceId, dependencyIds })),
    ...(database ? { database: { type: database.technology.includes('MongoDB') ? 'mongodb' : database.technology.includes('D1') ? 'cloudflare-d1' : 'postgresql', provider: database.technology.includes('Neon') ? 'neon' : database.technology.includes('MongoDB') ? 'mongodb-atlas' : database.technology.includes('D1') ? 'cloudflare' : 'supabase', dataAccess: database.technology.includes('Prisma') ? 'prisma' : database.technology.includes('native driver') ? 'native-driver' : 'drizzle', users: resourceUsers(database)! } } : {}),
    ...(cache ? { cache: { provider: cache.technology.includes('Cloudflare') ? 'cloudflare' : 'upstash', users: resourceUsers(cache)! } } : {}),
    ...(rateLimit ? { rateLimit: { provider: rateLimit.technology.includes('Cloudflare') ? 'cloudflare' : 'upstash', users: resourceUsers(rateLimit)! } } : {}),
    ...(queue ? { queue: { provider: queue.technology.includes('Cloudflare') ? 'cloudflare' : 'upstash', users: resourceUsers(queue)! } } : {}),
    ...(fileStorage ? { fileStorage: { provider: fileStorage.technology.includes('R2') ? 'cloudflare-r2' : 'supabase-storage', users: resourceUsers(fileStorage)! } } : {}),
    realtimeModes: (config.decisions.find((decision) => decision.key === 'realtime.modes')?.value ?? []) as string[],
    scheduledJobs: config.tools.includes('cloudflare-cron'),
    authService: config.decisions.find((decision) => decision.key === 'authentication.service')?.value ?? 'none',
    loginMethods: (config.decisions.find((decision) => decision.key === 'authentication.login-methods')?.value ?? []) as string[],
    agentMode: config.agentPreferences.mode,
  });
}
