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

export function normalizeProjectConfig(input: QuestionnaireAnswers): ProjectConfigV1 {
  const answers = parseQuestionnaireAnswers(input);
  const capabilities = normalizeCapabilities(answers.capabilities);
  const components: Component[] = [];
  const resources: Resource[] = [];
  const connections: Connection[] = [];
  const contracts: Contract[] = [];
  const decisions: Decision[] = [];
  const useUpstash = answers.managedServicePreference === 'upstash';
  const tools = useUpstash
    ? toolCatalog.filter((tool) => capabilities.includes(tool.challenge)).map((tool) => tool.id)
    : [];

  switch (answers.architecture) {
    case 'nextjs':
      components.push({
        id: 'web-app',
        name: 'Web application',
        kind: 'nextjs-app',
        technology: 'Next.js',
        responsibilities: ['User interface', 'Application entry point'],
        capabilities: [],
      });
      break;
    case 'nextjs-express':
      components.push(
        {
          id: 'web-app',
          name: 'Web application',
          kind: 'nextjs-app',
          technology: 'Next.js',
          responsibilities: ['User interface', 'Client-facing web experience'],
          capabilities: [],
        },
        {
          id: 'api-service',
          name: 'API service',
          kind: 'express-service',
          technology: 'Express',
          responsibilities: ['Application API', 'Server-side business operations'],
          capabilities: [],
        },
      );
      connections.push({
        id: 'web-to-api',
        from: 'web-app',
        to: 'api-service',
        protocol: 'http',
        purpose: 'Application API requests',
      });
      contracts.push({
        id: 'application-api',
        name: 'Application API',
        kind: 'http-api',
        description: 'Stable contract between the web application and API service.',
        participants: ['web-app', 'api-service'],
      });
      break;
    case 'typescript-cli':
      components.push({
        id: 'cli-app',
        name: 'CLI application',
        kind: 'typescript-cli',
        technology: 'TypeScript CLI',
        responsibilities: ['Command-line user experience', 'Application orchestration'],
        capabilities: [],
      });
      break;
    case 'custom-typescript':
      components.push({
        id: 'typescript-system',
        name: 'TypeScript system',
        kind: 'custom-typescript',
        technology: 'TypeScript',
        responsibilities: ['Deliver the described product outcome'],
        capabilities: [],
      });
      break;
  }

  const serverOwner =
    components.find((component) => component.id === 'api-service') ?? components[0];
  if (!serverOwner) throw new Error('Architecture did not produce a component.');

  const addCapability = (componentId: string, capability: (typeof capabilities)[number]): void => {
    const component = components.find((candidate) => candidate.id === componentId);
    if (component && !component.capabilities.includes(capability)) {
      component.capabilities.push(capability);
    }
  };

  if (capabilities.includes('database')) {
    const databaseTechnology =
      answers.databaseType === 'postgresql' ? 'PostgreSQL' : 'Document / NoSQL database';
    resources.push({
      id: 'primary-database',
      name: 'Primary database',
      kind: 'database',
      technology: databaseTechnology,
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
      description: 'Keep application logic independent from database-specific types and clients.',
      participants: [serverOwner.id],
    });
    addCapability(serverOwner.id, 'database');
  }

  if (capabilities.includes('authentication')) {
    addCapability(serverOwner.id, 'authentication');
    if (components.some((component) => component.id === 'web-app')) {
      addCapability('web-app', 'authentication');
    }
  }

  if (capabilities.includes('real-time')) {
    const protocol = answers.realtimeDirection === 'one-way' ? 'sse' : 'websocket';
    addCapability(serverOwner.id, 'real-time');
    if (
      serverOwner.id !== 'web-app' &&
      components.some((component) => component.id === 'web-app')
    ) {
      addCapability('web-app', 'real-time');
      connections.push({
        id: 'real-time-events',
        from: 'web-app',
        to: serverOwner.id,
        protocol,
        purpose:
          protocol === 'sse'
            ? 'Receive server-sent application events'
            : 'Exchange bidirectional application events',
      });
    }
    contracts.push({
      id: 'real-time-event-contract',
      name: 'Real-time event contract',
      kind: 'event',
      description: 'Versioned event names and payloads independent from the selected transport.',
      participants: serverOwner.id === 'web-app' ? [serverOwner.id] : ['web-app', serverOwner.id],
    });
  }

  if (capabilities.includes('background-jobs')) {
    components.push({
      id: 'background-worker',
      name: 'Background worker',
      kind: 'background-worker',
      technology: useUpstash ? 'TypeScript HTTP job handler' : 'TypeScript worker',
      responsibilities: ['Execute asynchronous, retried, or scheduled work'],
      capabilities: ['background-jobs'],
    });
    resources.push({
      id: 'job-queue',
      name: 'Job queue',
      kind: 'queue',
      technology: useUpstash ? 'Upstash QStash' : 'Provider-neutral queue / event system',
      purpose: 'Reliable delivery, retry, and scheduling of background work',
      ownerComponentId: serverOwner.id,
    });
    connections.push(
      {
        id: `${serverOwner.id}-to-job-queue`,
        from: serverOwner.id,
        to: 'job-queue',
        protocol: 'queue',
        purpose: 'Enqueue background work',
      },
      {
        id: 'job-queue-to-background-worker',
        from: 'job-queue',
        to: 'background-worker',
        protocol: 'queue',
        purpose: 'Deliver background work to its handler',
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

  if (capabilities.includes('file-storage')) {
    resources.push({
      id: 'object-storage',
      name: 'Object storage',
      kind: 'object-storage',
      technology: 'S3-compatible object storage',
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

  if (capabilities.includes('caching')) {
    resources.push({
      id: 'application-cache',
      name: 'Application cache',
      kind: 'cache',
      technology: useUpstash ? 'Upstash Redis' : 'Provider-neutral Redis-compatible cache',
      purpose: 'Reduce latency and repeated work for explicitly selected data and operations',
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

  if (capabilities.includes('rate-limiting')) {
    resources.push({
      id: 'rate-limit-store',
      name: 'Rate-limit state',
      kind: 'rate-limit-store',
      technology: useUpstash
        ? 'Upstash Redis with @upstash/ratelimit'
        : 'Provider-neutral distributed rate limiter',
      purpose: 'Coordinate request or operation limits across runtime instances',
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

  decisions.push(
    {
      key: 'architecture.starter',
      value: answers.architecture,
      source: 'user',
      status: 'confirmed',
    },
    {
      key: 'capabilities',
      value: capabilities,
      source: 'user',
      status: 'confirmed',
    },
  );

  if (answers.databaseType) {
    decisions.push({
      key: 'database.type',
      value: answers.databaseType,
      source: 'user',
      status: 'confirmed',
    });
  }
  if (answers.realtimeDirection) {
    decisions.push({
      key: 'realtime.direction',
      value: answers.realtimeDirection,
      source: 'user',
      status: 'confirmed',
    });
  }
  if (answers.managedServicePreference) {
    decisions.push({
      key: 'managed-services.preference',
      value: answers.managedServicePreference,
      source: 'user',
      status: 'confirmed',
      rationale:
        answers.managedServicePreference === 'upstash'
          ? 'Map each selected challenge to the purpose-built Upstash product.'
          : 'Keep challenge boundaries stable without selecting a managed vendor.',
    });
  }

  decisions.push(
    {
      key: 'agent.mode',
      value: answers.agentMode,
      source: 'user',
      status: 'confirmed',
    },
    {
      key: 'agent.question-policy',
      value: 'blocking-only',
      source: 'default',
      status: 'confirmed',
      rationale: 'Ask only when a consequential decision cannot be resolved safely.',
    },
  );

  return ProjectConfigV1Schema.parse({
    schemaVersion: 1,
    name: answers.projectName.trim(),
    language: 'typescript',
    product: {
      summary: answers.productSummary.trim(),
      goals: [],
      constraints: [],
    },
    architectureStarter: answers.architecture,
    capabilities,
    tools,
    components,
    resources,
    connections,
    contracts,
    decisions,
    agentPreferences: {
      mode: answers.agentMode,
      questionPolicy: 'blocking-only',
    },
  });
}
