import { z } from 'zod';
import { agentModeLabels, agentModes, backendLabels, frontendLabels } from '../catalog/index.js';
import { AgentModeSchema, BackendSchema, FrontendSchema } from '../schema/project-config.js';

const InfrastructureSchema = z.enum(['caching', 'rate-limiting', 'background-jobs']);
const LoginMethodSchema = z.enum(['github', 'email-password', 'magic-link', 'wallet']);

export const QuestionnaireAnswersSchema = z
  .object({
    projectName: z.string().trim().min(1, 'Project name is required.').max(100),
    productSummary: z.string().trim().min(10).max(2_000),
    frontend: FrontendSchema,
    backend: BackendSchema,
    realtimeMode: z.enum(['none', 'sse', 'websocket']).default('none'),
    database: z.enum(['none', 'postgresql', 'mongodb', 'cloudflare-d1']),
    databaseProvider: z.enum(['supabase', 'neon', 'mongodb-atlas', 'cloudflare']).optional(),
    dataAccess: z.enum(['prisma', 'drizzle', 'native-driver']).optional(),
    fileStorage: z.enum(['none', 'supabase-storage', 'cloudflare-r2']),
    infrastructure: z
      .array(InfrastructureSchema)
      .refine((items) => new Set(items).size === items.length)
      .default([]),
    cacheProvider: z.enum(['upstash', 'cloudflare']).optional(),
    rateLimitProvider: z.enum(['upstash', 'cloudflare']).optional(),
    queueProvider: z.enum(['upstash', 'cloudflare']).optional(),
    authService: z.enum(['none', 'supabase-auth', 'authjs', 'privy']),
    loginMethods: z
      .array(LoginMethodSchema)
      .refine((items) => new Set(items).size === items.length)
      .default([]),
    agentMode: AgentModeSchema,
  })
  .superRefine((answers, context) => {
    if (answers.frontend !== 'nextjs' && answers.backend === 'nextjs') {
      context.addIssue({
        code: 'custom',
        message: 'Next.js server features require the Next.js frontend.',
        path: ['backend'],
      });
    }
    if (answers.frontend === 'none' && answers.backend === 'none') {
      context.addIssue({
        code: 'custom',
        message: 'Choose at least one frontend or backend.',
        path: ['backend'],
      });
    }
    if (answers.realtimeMode === 'websocket' && answers.backend !== 'express') {
      context.addIssue({
        code: 'custom',
        message: 'This MVP uses an Express server for WebSocket connections.',
        path: ['realtimeMode'],
      });
    }
    if (answers.database === 'cloudflare-d1' && answers.backend !== 'cloudflare-workers') {
      context.addIssue({
        code: 'custom',
        message: 'Cloudflare D1 requires the Cloudflare Workers backend in this MVP.',
        path: ['database'],
      });
    }
    if (answers.backend === 'none' && answers.infrastructure.length > 0) {
      context.addIssue({
        code: 'custom',
        message: 'Managed cache, rate limiting, and queues require a backend.',
        path: ['infrastructure'],
      });
    }
    const providerQuestions = [
      ['caching', 'cacheProvider'],
      ['rate-limiting', 'rateLimitProvider'],
      ['background-jobs', 'queueProvider'],
    ] as const;
    for (const [challenge, providerField] of providerQuestions) {
      if (answers.infrastructure.includes(challenge) && !answers[providerField]) {
        context.addIssue({
          code: 'custom',
          message: 'Choose an infrastructure provider.',
          path: [providerField],
        });
      }
      if (answers[providerField] === 'cloudflare' && answers.backend !== 'cloudflare-workers') {
        context.addIssue({
          code: 'custom',
          message: 'Cloudflare-native infrastructure requires the Cloudflare Workers backend.',
          path: [providerField],
        });
      }
    }
    if (answers.database !== 'none' && !answers.databaseProvider) {
      context.addIssue({
        code: 'custom',
        message: 'Choose a database provider.',
        path: ['databaseProvider'],
      });
    }
    if (answers.database !== 'none' && !answers.dataAccess) {
      context.addIssue({
        code: 'custom',
        message: 'Choose a data-access option.',
        path: ['dataAccess'],
      });
    }
    const databaseSelections = {
      postgresql: { providers: ['supabase', 'neon'], access: ['prisma', 'drizzle'] },
      mongodb: { providers: ['mongodb-atlas'], access: ['prisma', 'native-driver'] },
      'cloudflare-d1': { providers: ['cloudflare'], access: ['drizzle', 'native-driver'] },
    } as const;
    if (answers.database !== 'none') {
      const allowed = databaseSelections[answers.database];
      if (
        answers.databaseProvider &&
        !(allowed.providers as readonly string[]).includes(answers.databaseProvider)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Choose a provider compatible with the database.',
          path: ['databaseProvider'],
        });
      }
      if (
        answers.dataAccess &&
        !(allowed.access as readonly string[]).includes(answers.dataAccess)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Choose data access compatible with the database.',
          path: ['dataAccess'],
        });
      }
    }
    if (answers.authService !== 'none' && answers.loginMethods.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'Choose at least one login method.',
        path: ['loginMethods'],
      });
    }
    const authMethods = {
      'supabase-auth': ['github', 'email-password', 'magic-link'],
      authjs: ['github', 'magic-link'],
      privy: ['github', 'magic-link', 'wallet'],
    } as const;
    if (answers.authService !== 'none') {
      const allowed = authMethods[answers.authService] as readonly string[];
      if (answers.loginMethods.some((method) => !allowed.includes(method))) {
        context.addIssue({
          code: 'custom',
          message: 'Choose login methods supported by the authentication service.',
          path: ['loginMethods'],
        });
      }
    }
  });

export type QuestionnaireAnswers = z.infer<typeof QuestionnaireAnswersSchema>;
export type DraftQuestionnaireAnswers = Partial<QuestionnaireAnswers>;
export type QuestionId =
  | 'projectName'
  | 'productSummary'
  | 'frontend'
  | 'backend'
  | 'realtimeMode'
  | 'database'
  | 'databaseProvider'
  | 'dataAccess'
  | 'fileStorage'
  | 'infrastructure'
  | 'cacheProvider'
  | 'rateLimitProvider'
  | 'queueProvider'
  | 'authService'
  | 'loginMethods'
  | 'agentMode';

export interface QuestionOption {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
}
interface BaseQuestion {
  readonly id: QuestionId;
  readonly label: string;
  readonly help?: string;
}
export interface TextQuestion extends BaseQuestion {
  readonly kind: 'text';
  readonly placeholder?: string;
}
export interface SingleSelectQuestion extends BaseQuestion {
  readonly kind: 'single';
  readonly options: readonly QuestionOption[];
}
export interface MultiSelectQuestion extends BaseQuestion {
  readonly kind: 'multi';
  readonly options: readonly QuestionOption[];
}
export type Question = TextQuestion | SingleSelectQuestion | MultiSelectQuestion;

const frontendQuestion: SingleSelectQuestion = {
  id: 'frontend',
  kind: 'single',
  label: 'Frontend',
  options: [
    {
      value: 'nextjs',
      label: frontendLabels.nextjs,
      description: 'React UI with routing, rendering, and an integrated server option.',
    },
    {
      value: 'vite-vanilla',
      label: frontendLabels['vite-vanilla'],
      description: 'A lightweight browser UI without a frontend framework.',
    },
    {
      value: 'none',
      label: frontendLabels.none,
      description: 'Choose this for an API, worker, or backend-only product.',
    },
  ],
};

function backendQuestion(frontend: DraftQuestionnaireAnswers['frontend']): SingleSelectQuestion {
  const options: QuestionOption[] = [];
  if (frontend === 'nextjs')
    options.push({
      value: 'nextjs',
      label: backendLabels.nextjs,
      description: 'Use route handlers and Server Actions in the same Next.js application.',
    });
  options.push(
    {
      value: 'express',
      label: backendLabels.express,
      description:
        'Use for WebSockets, long-lived server processes, custom middleware, or independent APIs.',
    },
    {
      value: 'cloudflare-workers',
      label: backendLabels['cloudflare-workers'],
      description:
        'Use for globally distributed request handlers; background work must use queues, not long-running processes.',
    },
    {
      value: 'none',
      label: backendLabels.none,
      description: 'Use when the frontend has no private server operations.',
    },
  );
  return { id: 'backend', kind: 'single', label: 'Backend', options };
}

function realtimeQuestion(backend: QuestionnaireAnswers['backend']): SingleSelectQuestion {
  const options: QuestionOption[] = [
    { value: 'none', label: 'Not needed' },
    {
      value: 'sse',
      label: 'Server-Sent Events',
      description: 'One-way server-to-client updates over HTTP.',
    },
  ];
  if (backend === 'express')
    options.push({
      value: 'websocket',
      label: 'WebSockets',
      description: 'Bidirectional persistent connections handled by the long-lived Express server.',
    });
  return { id: 'realtimeMode', kind: 'single', label: 'Real-time communication', options };
}

function databaseQuestion(backend: DraftQuestionnaireAnswers['backend']): SingleSelectQuestion {
  const options: QuestionOption[] = [
    { value: 'none', label: 'No database' },
    {
      value: 'postgresql',
      label: 'PostgreSQL',
      description: 'Relational data, transactions, constraints, and SQL querying.',
    },
    {
      value: 'mongodb',
      label: 'MongoDB / NoSQL',
      description: 'Flexible document-shaped data with MongoDB Atlas.',
    },
  ];
  if (backend === 'cloudflare-workers') {
    options.push({
      value: 'cloudflare-d1',
      label: 'Cloudflare D1',
      description: 'Managed SQLite designed to run with Cloudflare Workers.',
    });
  }
  return { id: 'database', kind: 'single', label: 'Database', options };
}

function databaseProviderQuestion(
  database: QuestionnaireAnswers['database'],
): SingleSelectQuestion {
  const options: QuestionOption[] =
    database === 'postgresql'
      ? [
          {
            value: 'supabase',
            label: 'Supabase PostgreSQL',
            description: 'Free-tier Postgres integrated with Supabase Auth and Storage.',
          },
          {
            value: 'neon',
            label: 'Neon PostgreSQL',
            description: 'Free-tier serverless Postgres with scale-to-zero and branching.',
          },
        ]
      : database === 'mongodb'
        ? [
            {
              value: 'mongodb-atlas',
              label: 'MongoDB Atlas',
              description: 'Managed MongoDB with a free development cluster.',
            },
          ]
        : [
            {
              value: 'cloudflare',
              label: 'Cloudflare D1',
              description: 'SQLite storage colocated with Cloudflare Workers.',
            },
          ];
  return {
    id: 'databaseProvider',
    kind: 'single',
    label: 'Database provider',
    help: 'MVP choices prioritize providers with free tiers.',
    options,
  };
}

function dataAccessQuestion(database: QuestionnaireAnswers['database']): SingleSelectQuestion {
  const options: QuestionOption[] =
    database === 'postgresql'
      ? [
          {
            value: 'drizzle',
            label: 'Drizzle ORM',
            description: 'SQL-oriented, lightweight, and strongly typed.',
          },
          {
            value: 'prisma',
            label: 'Prisma ORM',
            description: 'Schema-driven ORM with migrations and a generated client.',
          },
        ]
      : database === 'mongodb'
        ? [
            {
              value: 'native-driver',
              label: 'MongoDB driver',
              description: 'Use MongoDB directly without an ORM abstraction.',
            },
            {
              value: 'prisma',
              label: 'Prisma ORM',
              description: 'Use Prisma models and its MongoDB connector.',
            },
          ]
        : [
            {
              value: 'drizzle',
              label: 'Drizzle ORM',
              description: 'Typed SQL and migrations for Cloudflare D1.',
            },
            {
              value: 'native-driver',
              label: 'D1 binding API',
              description: 'Use Cloudflare D1 prepared statements directly.',
            },
          ];
  return { id: 'dataAccess', kind: 'single', label: 'Data access', options };
}

function fileStorageQuestion(backend: DraftQuestionnaireAnswers['backend']): SingleSelectQuestion {
  const options: QuestionOption[] = [
    { value: 'none', label: 'Not needed' },
    {
      value: 'supabase-storage',
      label: 'Supabase Storage',
      description: 'Managed object storage integrated with Supabase access policies.',
    },
  ];
  if (backend !== 'none') {
    options.push({
      value: 'cloudflare-r2',
      label: 'Cloudflare R2',
      description: 'S3-compatible object storage with no internet egress fees.',
    });
  }
  return { id: 'fileStorage', kind: 'single', label: 'File storage', options };
}

const infrastructureQuestion: MultiSelectQuestion = {
  id: 'infrastructure',
  kind: 'multi',
  label: 'Managed infrastructure needs',
  help: 'For now these map to Upstash products; provider choice can be added later.',
  options: [
    {
      value: 'caching',
      label: 'Cache',
      description: 'Upstash Redis reduces repeated reads or computation.',
    },
    {
      value: 'rate-limiting',
      label: 'Rate limiting',
      description: 'Upstash Ratelimit coordinates limits across instances.',
    },
    {
      value: 'background-jobs',
      label: 'Message queue / background jobs',
      description: 'Upstash QStash provides delivery, retries, schedules, and queues.',
    },
  ],
};

function infrastructureProviderQuestion(
  challenge: 'caching' | 'rate-limiting' | 'background-jobs',
  backend: QuestionnaireAnswers['backend'],
): SingleSelectQuestion {
  const question = {
    caching: {
      id: 'cacheProvider' as const,
      label: 'Cache provider',
      upstash: 'Upstash Redis',
      cloudflare: 'Cloudflare Workers Cache API / KV',
    },
    'rate-limiting': {
      id: 'rateLimitProvider' as const,
      label: 'Rate-limiting provider',
      upstash: 'Upstash Ratelimit',
      cloudflare: 'Cloudflare Workers Rate Limiting',
    },
    'background-jobs': {
      id: 'queueProvider' as const,
      label: 'Queue provider',
      upstash: 'Upstash QStash',
      cloudflare: 'Cloudflare Queues',
    },
  }[challenge];
  const options: QuestionOption[] = [
    {
      value: 'upstash',
      label: question.upstash,
      description: 'Serverless managed infrastructure that works with every supported backend.',
    },
  ];
  if (backend === 'cloudflare-workers') {
    options.push({
      value: 'cloudflare',
      label: question.cloudflare,
      description: 'Cloudflare-native infrastructure colocated with the selected Workers backend.',
    });
  }
  return { id: question.id, kind: 'single', label: question.label, options };
}

const authQuestion: SingleSelectQuestion = {
  id: 'authService',
  kind: 'single',
  label: 'Authentication',
  options: [
    { value: 'none', label: 'No authentication' },
    {
      value: 'supabase-auth',
      label: 'Supabase Auth',
      description:
        'Managed auth that integrates especially well with Supabase PostgreSQL and Storage.',
    },
    {
      value: 'authjs',
      label: 'Auth.js',
      description: 'Free, open-source authentication hosted inside the application.',
    },
    {
      value: 'privy',
      label: 'Privy',
      description: 'Managed authentication with strong wallet and web3 onboarding support.',
    },
  ],
};

function loginMethodsQuestion(auth: QuestionnaireAnswers['authService']): MultiSelectQuestion {
  const options: QuestionOption[] = [
    { value: 'github', label: 'GitHub', description: 'OAuth login through a GitHub account.' },
  ];
  if (auth === 'supabase-auth')
    options.push(
      { value: 'email-password', label: 'Email and password' },
      { value: 'magic-link', label: 'Email magic link' },
    );
  else if (auth === 'authjs') options.push({ value: 'magic-link', label: 'Email magic link' });
  else if (auth === 'privy')
    options.push(
      { value: 'magic-link', label: 'Email login' },
      { value: 'wallet', label: 'Crypto wallet' },
    );
  return {
    id: 'loginMethods',
    kind: 'multi',
    label: 'Login methods',
    help: 'Select one or more methods.',
    options,
  };
}

const agentModeQuestion: SingleSelectQuestion = {
  id: 'agentMode',
  kind: 'single',
  label: 'How should the receiving coding agent work?',
  options: agentModes.map((value) => ({ value, label: agentModeLabels[value] })),
};

export function getQuestionSequence(answers: DraftQuestionnaireAnswers): Question[] {
  const questions: Question[] = [
    { id: 'projectName', kind: 'text', label: 'Project name', placeholder: 'My project' },
    {
      id: 'productSummary',
      kind: 'text',
      label: 'What are you building?',
      placeholder: 'Describe the product, users, and primary outcome',
    },
    frontendQuestion,
  ];
  if (answers.frontend) questions.push(backendQuestion(answers.frontend));
  if (answers.backend && answers.backend !== 'none')
    questions.push(realtimeQuestion(answers.backend));
  questions.push(databaseQuestion(answers.backend));
  if (answers.database && answers.database !== 'none')
    questions.push(
      databaseProviderQuestion(answers.database),
      dataAccessQuestion(answers.database),
    );
  questions.push(fileStorageQuestion(answers.backend));
  if (answers.backend && answers.backend !== 'none') {
    questions.push(infrastructureQuestion);
    for (const challenge of answers.infrastructure ?? []) {
      questions.push(infrastructureProviderQuestion(challenge, answers.backend));
    }
  }
  questions.push(authQuestion);
  if (answers.authService && answers.authService !== 'none')
    questions.push(loginMethodsQuestion(answers.authService));
  questions.push(agentModeQuestion);
  return questions;
}

export function parseQuestionnaireAnswers(input: unknown): QuestionnaireAnswers {
  return QuestionnaireAnswersSchema.parse(input);
}

export function formatAnswer(question: Question, answers: DraftQuestionnaireAnswers): string {
  const value = answers[question.id];
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    if (question.kind !== 'multi') return value.join(', ');
    return value
      .map((item) => question.options.find((option) => option.value === item)?.label ?? item)
      .join(', ');
  }
  if (!value) return 'Not answered';
  if (question.kind === 'single' || question.kind === 'multi')
    return question.options.find((option) => option.value === value)?.label ?? String(value);
  return String(value);
}
