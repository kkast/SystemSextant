import type {
  AgentMode,
  ArchitectureStarter,
  Capability,
  ToolId,
} from '../schema/project-config.js';

export const architectureStarters: readonly ArchitectureStarter[] = [
  'nextjs',
  'nextjs-express',
  'typescript-cli',
  'custom-typescript',
];

export const architectureLabels: Record<ArchitectureStarter, string> = {
  nextjs: 'Next.js',
  'nextjs-express': 'Next.js + Express',
  'typescript-cli': 'TypeScript CLI',
  'custom-typescript': 'Custom TypeScript system',
};

export const capabilities: readonly Capability[] = [
  'database',
  'authentication',
  'real-time',
  'background-jobs',
  'file-storage',
  'caching',
  'rate-limiting',
];

export const capabilityLabels: Record<Capability, string> = {
  database: 'Database',
  authentication: 'Authentication',
  'real-time': 'Real-time communication',
  'background-jobs': 'Background jobs / reliable message delivery',
  'file-storage': 'File storage',
  caching: 'Reduce repeated work with caching',
  'rate-limiting': 'Protect operations with distributed rate limiting',
};

export const agentModes: readonly AgentMode[] = ['plan-only', 'plan-then-build', 'direct-build'];

export const agentModeLabels: Record<AgentMode, string> = {
  'plan-only': 'Plan only',
  'plan-then-build': 'Plan then build',
  'direct-build': 'Direct build',
};

export interface ToolDefinition {
  readonly id: ToolId;
  readonly label: string;
  readonly challenge: 'caching' | 'rate-limiting' | 'background-jobs';
  readonly promptBlockId: `tool.${string}`;
}

export const toolCatalog: readonly ToolDefinition[] = [
  {
    id: 'upstash-redis-cache',
    label: 'Upstash Redis for caching',
    challenge: 'caching',
    promptBlockId: 'tool.upstash.redis-cache',
  },
  {
    id: 'upstash-ratelimit',
    label: 'Upstash Ratelimit',
    challenge: 'rate-limiting',
    promptBlockId: 'tool.upstash.ratelimit',
  },
  {
    id: 'upstash-qstash',
    label: 'Upstash QStash',
    challenge: 'background-jobs',
    promptBlockId: 'tool.upstash.qstash',
  },
];

export function normalizeCapabilities(selected: readonly Capability[]): Capability[] {
  const selectedSet = new Set(selected);
  return capabilities.filter((capability) => selectedSet.has(capability));
}
