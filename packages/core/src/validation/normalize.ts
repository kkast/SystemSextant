import { normalizeCapabilities, toolCatalog } from '../catalog/index.js';
import { parseQuestionnaireAnswers, type QuestionnaireAnswers } from '../questionnaire/index.js';
import {
  ProjectConfigV1Schema,
  type Component,
  type Connection,
  type Contract,
  type Decision,
  type ProjectConfigV1,
  type Resource,
} from '../schema/project-config.js';

const databaseNames = {
  supabase: 'Supabase PostgreSQL',
  neon: 'Neon PostgreSQL',
  'mongodb-atlas': 'MongoDB Atlas',
  cloudflare: 'Cloudflare D1',
} as const;

const dataAccessNames = {
  prisma: 'Prisma ORM',
  drizzle: 'Drizzle ORM',
  'native-driver': 'native driver / binding API',
} as const;
const authNames = { 'supabase-auth': 'Supabase Auth', authjs: 'Auth.js', privy: 'Privy' } as const;
const storageNames = {
  'supabase-storage': 'Supabase Storage',
  'cloudflare-r2': 'Cloudflare R2',
} as const;

export function normalizeProjectConfig(input: QuestionnaireAnswers): ProjectConfigV1 {
  const answers = parseQuestionnaireAnswers(input);
  const selectedCapabilities = [
    ...(answers.database === 'none' ? [] : (['database'] as const)),
    ...(answers.authService === 'none' ? [] : (['authentication'] as const)),
    ...(answers.realtimeModes.length === 0 ? [] : (['real-time'] as const)),
    ...(answers.fileStorage === 'none' ? [] : (['file-storage'] as const)),
    ...answers.infrastructure,
  ];
  const capabilities = normalizeCapabilities(selectedCapabilities);
  const infrastructureProviders = {
    caching: answers.cacheProvider,
    'rate-limiting': answers.rateLimitProvider,
    'background-jobs': answers.queueProvider,
    // Cron Triggers are the only scheduled-execution tool and are Cloudflare-native.
    'scheduled-jobs': answers.infrastructure.includes('scheduled-jobs') ? ('cloudflare' as const) : undefined,
  } as const;
  const tools = toolCatalog
    .filter(
      (tool) =>
        capabilities.includes(tool.challenge) &&
        infrastructureProviders[tool.challenge] === tool.provider,
    )
    .map((tool) => tool.id);
  const components: Component[] = [];
  const resources: Resource[] = [];
  const connections: Connection[] = [];
  const contracts: Contract[] = [];
  const decisions: Decision[] = [];

  if (answers.frontend === 'nextjs') {
    components.push({
      id: 'web-app',
      name: 'Web application',
      kind: 'nextjs-app',
      technology: 'Next.js',
      responsibilities: ['React user interface', 'Routing and rendering'],
      capabilities: [],
    });
  } else if (answers.frontend === 'vite-vanilla') {
    components.push({
      id: 'web-app',
      name: 'Web application',
      kind: 'vite-vanilla-app',
      technology: 'Create Vite with vanilla TypeScript',
      responsibilities: ['Browser user interface', 'Client-side application entry point'],
      capabilities: [],
    });
  }

  if (answers.backend === 'nextjs') {
    const webApp = components.find(({ id }) => id === 'web-app');
    if (!webApp) throw new Error('Next.js server features require a Next.js web application.');
    webApp.responsibilities.push(
      'Route handlers and Server Actions',
      'Server-side business operations',
    );
  } else if (answers.backend === 'express') {
    components.push({
      id: 'api-service',
      name: 'API service',
      kind: 'express-service',
      technology: 'Express',
      responsibilities: ['Application API', 'Long-lived server operations and custom middleware'],
      capabilities: [],
    });
  } else if (answers.backend === 'cloudflare-workers') {
    components.push({
      id: 'api-service',
      name: 'Edge API',
      kind: 'cloudflare-worker',
      technology: 'Cloudflare Workers',
      responsibilities: ['Globally distributed request handling', 'Short-lived edge operations'],
      capabilities: [],
    });
  }

  const webApp = components.find(({ id }) => id === 'web-app');
  const serverOwner = components.find(({ id }) => id === 'api-service') ?? webApp;
  if (!serverOwner) throw new Error('Architecture did not produce a component.');

  if (webApp && serverOwner.id !== webApp.id) {
    connections.push({
      id: 'web-to-api',
      from: webApp.id,
      to: serverOwner.id,
      protocol: 'http',
      purpose: 'Application API requests',
    });
    contracts.push({
      id: 'application-api',
      name: 'Application API',
      kind: 'http-api',
      description: 'Stable contract between the web application and backend service.',
      participants: [webApp.id, serverOwner.id],
    });
  }

  const addCapability = (componentId: string, capability: (typeof capabilities)[number]): void => {
    const component = components.find(({ id }) => id === componentId);
    if (component && !component.capabilities.includes(capability))
      component.capabilities.push(capability);
  };

  if (answers.database !== 'none' && answers.databaseProvider && answers.dataAccess) {
    const technology = `${databaseNames[answers.databaseProvider]} with ${dataAccessNames[answers.dataAccess]}`;
    resources.push({
      id: 'primary-database',
      name: 'Primary database',
      kind: 'database',
      technology,
      purpose: 'Persistent application data',
      ownerComponentId: serverOwner.id,
    });
    connections.push({
      id: `${serverOwner.id}-to-primary-database`,
      from: serverOwner.id,
      to: 'primary-database',
      protocol: 'database',
      purpose: 'Read and write persistent application data',
    });
    contracts.push({
      id: 'data-access-boundary',
      name: 'Data access boundary',
      kind: 'repository',
      description: 'Keep application logic independent from database and ORM-specific types.',
      participants: [serverOwner.id],
    });
    addCapability(serverOwner.id, 'database');
  }

  if (answers.authService !== 'none') {
    addCapability(serverOwner.id, 'authentication');
    if (webApp) addCapability(webApp.id, 'authentication');
  }

  if (answers.realtimeModes.length > 0) {
    addCapability(serverOwner.id, 'real-time');
    if (webApp) addCapability(webApp.id, 'real-time');
    if (webApp && webApp.id !== serverOwner.id) {
      for (const mode of answers.realtimeModes) {
        connections.push({
          id: `real-time-${mode}`,
          from: webApp.id,
          to: serverOwner.id,
          protocol: mode,
          purpose:
            mode === 'sse'
              ? 'Receive server-sent application events'
              : 'Exchange bidirectional application events',
        });
      }
    }
    contracts.push({
      id: 'real-time-event-contract',
      name: 'Real-time event contract',
      kind: 'event',
      description: 'Versioned event names and payloads independent from the transport.',
      participants:
        webApp && webApp.id !== serverOwner.id ? [webApp.id, serverOwner.id] : [serverOwner.id],
    });
  }

  if (answers.infrastructure.includes('background-jobs')) {
    components.push({
      id: 'background-worker',
      name: 'Background job handler',
      kind: 'background-worker',
      technology:
        answers.queueProvider === 'cloudflare'
          ? 'Cloudflare Queue consumer'
          : answers.backend === 'cloudflare-workers'
            ? 'Cloudflare Worker HTTP handler'
            : 'TypeScript HTTP job handler',
      responsibilities: ['Handle asynchronous, retried, or scheduled background deliveries'],
      capabilities: ['background-jobs'],
    });
    resources.push({
      id: 'job-queue',
      name: 'Message queue',
      kind: 'queue',
      technology: answers.queueProvider === 'cloudflare' ? 'Cloudflare Queues' : 'Upstash QStash',
      purpose: 'Reliable delivery, retries, scheduling, and queueing',
      ownerComponentId: serverOwner.id,
    });
    connections.push(
      {
        id: `${serverOwner.id}-to-job-queue`,
        from: serverOwner.id,
        to: 'job-queue',
        protocol: 'queue',
        purpose: 'Publish background work',
      },
      {
        id: 'job-queue-to-background-worker',
        from: 'job-queue',
        to: 'background-worker',
        protocol: 'queue',
        purpose: 'Deliver work to its HTTP handler',
      },
    );
    contracts.push({
      id: 'background-message-contract',
      name: 'Background message contract',
      kind: 'event',
      description:
        'Versioned job payloads and handler outcomes independent from the delivery provider.',
      participants: [serverOwner.id, 'background-worker'],
    });
    addCapability(serverOwner.id, 'background-jobs');
  }

  if (answers.infrastructure.includes('scheduled-jobs')) {
    // Cron Triggers are deployment configuration on the Worker itself, so no separate
    // resource, connection, or component is created; the capability carries the need.
    addCapability(serverOwner.id, 'scheduled-jobs');
  }

  if (answers.fileStorage !== 'none') {
    resources.push({
      id: 'object-storage',
      name: 'Object storage',
      kind: 'object-storage',
      technology: storageNames[answers.fileStorage],
      purpose: 'Store user or application files',
      ownerComponentId: serverOwner.id,
    });
    connections.push({
      id: `${serverOwner.id}-to-object-storage`,
      from: serverOwner.id,
      to: 'object-storage',
      protocol: 'object-storage',
      purpose: 'Store and retrieve files',
    });
    contracts.push({
      id: 'object-storage-boundary',
      name: 'Object storage boundary',
      kind: 'storage',
      description: 'Keep provider SDK types behind an application-owned storage interface.',
      participants: [serverOwner.id],
    });
    addCapability(serverOwner.id, 'file-storage');
  }

  if (answers.infrastructure.includes('caching')) {
    resources.push({
      id: 'application-cache',
      name: 'Application cache',
      kind: 'cache',
      technology:
        answers.cacheProvider === 'cloudflare'
          ? 'Cloudflare Workers Cache API / KV'
          : 'Upstash Redis',
      purpose: 'Reduce latency and repeated work for selected operations',
      ownerComponentId: serverOwner.id,
    });
    connections.push({
      id: `${serverOwner.id}-to-application-cache`,
      from: serverOwner.id,
      to: 'application-cache',
      protocol: 'cache',
      purpose: 'Read, populate, invalidate, and expire cached values',
    });
    contracts.push({
      id: 'cache-boundary',
      name: 'Cache boundary',
      kind: 'cache',
      description: 'Application-owned cache keys, TTLs, invalidation rules, and fallback behavior.',
      participants: [serverOwner.id],
    });
    addCapability(serverOwner.id, 'caching');
  }

  if (answers.infrastructure.includes('rate-limiting')) {
    resources.push({
      id: 'rate-limit-store',
      name: 'Rate-limit state',
      kind: 'rate-limit-store',
      technology:
        answers.rateLimitProvider === 'cloudflare'
          ? 'Cloudflare Workers Rate Limiting'
          : 'Upstash Redis with @upstash/ratelimit',
      purpose: 'Coordinate limits across runtime instances',
      ownerComponentId: serverOwner.id,
    });
    connections.push({
      id: `${serverOwner.id}-to-rate-limit-store`,
      from: serverOwner.id,
      to: 'rate-limit-store',
      protocol: 'rate-limit',
      purpose: 'Check and update distributed rate-limit state',
    });
    contracts.push({
      id: 'rate-limit-boundary',
      name: 'Rate-limit boundary',
      kind: 'rate-limit',
      description:
        'Application-owned identifiers, policies, failure behavior, and response metadata.',
      participants: [serverOwner.id],
    });
    addCapability(serverOwner.id, 'rate-limiting');
  }

  const userDecisions: Array<[string, string | string[]]> = [
    ['frontend', answers.frontend],
    ['backend', answers.backend],
    ['deployment.frontend', answers.frontendDeployment ?? 'none'],
    [
      'deployment.backend',
      answers.backend === 'nextjs'
        ? (answers.frontendDeployment ?? 'none')
        : (answers.backendDeployment ?? 'none'),
    ],
    ['realtime.modes', answers.realtimeModes],
    ['database.type', answers.database],
    ['file-storage.provider', answers.fileStorage],
    ['infrastructure', answers.infrastructure],
    ['authentication.service', answers.authService],
    ['authentication.login-methods', answers.loginMethods],
    ['capabilities', capabilities],
    ['agent.mode', answers.agentMode],
  ];
  if (answers.databaseProvider) userDecisions.push(['database.provider', answers.databaseProvider]);
  if (answers.dataAccess) userDecisions.push(['database.data-access', answers.dataAccess]);
  if (answers.cacheProvider) userDecisions.push(['cache.provider', answers.cacheProvider]);
  if (answers.rateLimitProvider)
    userDecisions.push(['rate-limiting.provider', answers.rateLimitProvider]);
  if (answers.queueProvider) userDecisions.push(['queue.provider', answers.queueProvider]);
  if (answers.infrastructure.includes('scheduled-jobs'))
    userDecisions.push(['scheduled-jobs.provider', 'cloudflare']);
  decisions.push(
    ...userDecisions.map(([key, value]) => ({
      key,
      value,
      source: 'user' as const,
      status: 'confirmed' as const,
    })),
  );
  if (answers.authService !== 'none')
    decisions.push({
      key: 'authentication.technology',
      value: authNames[answers.authService],
      source: 'default',
      status: 'confirmed',
    });
  decisions.push({
    key: 'agent.question-policy',
    value: 'blocking-only',
    source: 'default',
    status: 'confirmed',
    rationale: 'Ask only when a consequential decision cannot be resolved safely.',
  });

  return ProjectConfigV1Schema.parse({
    schemaVersion: 1,
    name: answers.projectName.trim(),
    language: 'typescript',
    product: { summary: answers.productSummary.trim(), goals: [], constraints: [] },
    frontend: answers.frontend,
    backend: answers.backend,
    deployment: {
      ...(answers.frontend !== 'none' && answers.frontendDeployment
        ? { frontend: answers.frontendDeployment }
        : {}),
      ...(answers.backend !== 'none' && answers.backend !== 'nextjs' && answers.backendDeployment
        ? { backend: answers.backendDeployment }
        : {}),
    },
    capabilities,
    tools,
    components,
    resources,
    connections,
    contracts,
    decisions,
    agentPreferences: { mode: answers.agentMode, questionPolicy: 'blocking-only' },
  });
}
