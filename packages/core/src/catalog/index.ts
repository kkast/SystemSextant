import type {
  AgentMode,
  Backend,
  Capability,
  DeploymentTarget,
  Frontend,
  ToolId,
} from '../schema/project-config.js';

export const frontendLabels: Record<Frontend, string> = {
  nextjs: 'Next.js',
  'vite-vanilla': 'Vanilla TypeScript with Create Vite',
  none: 'No frontend',
};

export const backendLabels: Record<Backend, string> = {
  nextjs: 'Next.js server features',
  express: 'Express server',
  'cloudflare-workers': 'Cloudflare Workers',
  none: 'No backend',
};

export const deploymentTargetLabels: Record<DeploymentTarget, string> = {
  vercel: 'Vercel',
  render: 'Render',
  'local-only': 'Local only',
  vps: 'Self-managed VPS',
  cloudflare: 'Cloudflare',
};

export const capabilities: readonly Capability[] = [
  'database',
  'authentication',
  'real-time',
  'background-jobs',
  'scheduled-jobs',
  'file-storage',
  'caching',
  'rate-limiting',
];

export const capabilityLabels: Record<Capability, string> = {
  database: 'Database',
  authentication: 'Authentication',
  'real-time': 'Real-time communication',
  'background-jobs': 'Background jobs / reliable message delivery',
  'scheduled-jobs': 'Periodic scheduled execution',
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
  readonly challenge: 'caching' | 'rate-limiting' | 'background-jobs' | 'scheduled-jobs';
  readonly provider: 'upstash' | 'cloudflare';
  readonly promptBlockId: `tool.${string}`;
}

export const toolCatalog: readonly ToolDefinition[] = [
  {
    id: 'upstash-redis-cache',
    label: 'Upstash Redis for caching',
    challenge: 'caching',
    provider: 'upstash',
    promptBlockId: 'tool.upstash.redis-cache',
  },
  {
    id: 'upstash-ratelimit',
    label: 'Upstash Ratelimit',
    challenge: 'rate-limiting',
    provider: 'upstash',
    promptBlockId: 'tool.upstash.ratelimit',
  },
  {
    id: 'upstash-qstash',
    label: 'Upstash QStash',
    challenge: 'background-jobs',
    provider: 'upstash',
    promptBlockId: 'tool.upstash.qstash',
  },
  {
    id: 'cloudflare-cache',
    label: 'Cloudflare Workers Cache API and KV',
    challenge: 'caching',
    provider: 'cloudflare',
    promptBlockId: 'tool.cloudflare.cache',
  },
  {
    id: 'cloudflare-ratelimit',
    label: 'Cloudflare Workers Rate Limiting',
    challenge: 'rate-limiting',
    provider: 'cloudflare',
    promptBlockId: 'tool.cloudflare.ratelimit',
  },
  {
    id: 'cloudflare-queues',
    label: 'Cloudflare Queues',
    challenge: 'background-jobs',
    provider: 'cloudflare',
    promptBlockId: 'tool.cloudflare.queues',
  },
  {
    id: 'cloudflare-cron',
    label: 'Cloudflare Workers Cron Triggers',
    challenge: 'scheduled-jobs',
    provider: 'cloudflare',
    promptBlockId: 'tool.cloudflare.cron',
  },
];

export function normalizeCapabilities(selected: readonly Capability[]): Capability[] {
  const selectedSet = new Set(selected);
  return capabilities.filter((capability) => selectedSet.has(capability));
}

export function renderSupportedStackCatalog(): string {
  const toolLines = toolCatalog
    .map(
      (tool) =>
        `- ${tool.label} — ${tool.challenge}; ${tool.provider === 'cloudflare' ? 'Cloudflare Workers only.' : 'works with every backend.'}`,
    )
    .join('\n');

  return `# Supported stacks and tools

Everything below is selectable in the current questionnaire unless marked as a constraint.

## Frontend
- Next.js
- Vanilla TypeScript with Create Vite
- No frontend

## Backend
- Next.js server features — requires a Next.js frontend.
- Express server — supports WebSockets and long-lived server processes.
- Cloudflare Workers — short-lived edge operations; use queues for asynchronous work and Cron Triggers for periodic execution.
- No backend

## Deployment
- Vercel — best fit for Next.js and also hosts static Vite frontends.
- Render — managed hosting for Express servers and static frontends, with a free option.
- Cloudflare — Workers for edge backends and Pages/Workers for Next.js or static frontends.
- Self-managed VPS — full runtime control for Next.js, Express, or static files.
- Local only — development, private tools, or software that should not be hosted.

## Database and data access
- PostgreSQL: Supabase or Neon; Prisma or Drizzle.
- MongoDB: MongoDB Atlas; MongoDB driver or Prisma.
- Cloudflare D1: Cloudflare Workers only; Drizzle or the D1 binding API.

## File storage
- Supabase Storage
- Cloudflare R2 — requires a backend.
- No file storage

## Authentication
- Supabase Auth: GitHub, email/password, or magic link.
- Auth.js: GitHub or magic link.
- Privy: GitHub, email, or crypto wallet.
- No authentication

## Infrastructure tools
${toolLines}

## Potential additions to discuss
- Google Cloud Firestore — document database with a free quota.
- AWS DynamoDB — key-value and document database with a free tier.
- Cloudflare Workers KV — key-value storage with a free Workers allowance.
- Additional database, storage, authentication, cache, rate-limit, and queue providers.
- Additional frontend and backend runtimes.

Ask the coding agent to compare an option or add a new provider boundary before selecting an unsupported tool.`;
}
