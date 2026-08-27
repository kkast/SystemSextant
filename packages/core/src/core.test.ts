import { describe, expect, it } from 'vitest';
import {
  createCompletedSession,
  compilePrompt,
  defaultPromptBlocks,
  deserializeProjectConfig,
  generateArtifacts,
  getQuestionSequence,
  normalizeProjectConfig,
  ProjectConfigV1Schema,
  QuestionnaireAnswersSchema,
  renderSupportedStackCatalog,
  type QuestionnaireAnswers,
  type PromptBlock,
  type SessionRecord,
  type SessionRepository,
} from './index.js';

const baseAnswers: QuestionnaireAnswers = {
  projectName: 'Example platform',
  productSummary: 'A platform that helps teams coordinate technical projects.',
  frontend: 'nextjs',
  backend: 'express',
  frontendDeployment: 'vercel',
  backendDeployment: 'render',
  realtimeModes: ['sse', 'websocket'],
  database: 'postgresql',
  databaseProvider: 'supabase',
  dataAccess: 'drizzle',
  fileStorage: 'supabase-storage',
  infrastructure: [],
  authService: 'supabase-auth',
  loginMethods: ['github', 'magic-link'],
  agentMode: 'plan-then-build',
};

const infrastructureAnswers: QuestionnaireAnswers = {
  projectName: 'Infrastructure platform',
  productSummary: 'A platform that verifies managed infrastructure selections.',
  frontend: 'nextjs',
  backend: 'cloudflare-workers',
  frontendDeployment: 'cloudflare',
  backendDeployment: 'cloudflare',
  realtimeModes: [],
  database: 'none',
  fileStorage: 'none',
  infrastructure: ['caching', 'rate-limiting', 'background-jobs'],
  cacheProvider: 'upstash',
  rateLimitProvider: 'upstash',
  queueProvider: 'upstash',
  authService: 'none',
  loginMethods: [],
  agentMode: 'plan-then-build',
};

describe('questionnaire', () => {
  it('accepts an empty optional product description', () => {
    expect(
      QuestionnaireAnswersSchema.parse({ ...baseAnswers, productSummary: '   ' }).productSummary,
    ).toBe('');
    expect(normalizeProjectConfig({ ...baseAnswers, productSummary: '   ' }).product.summary).toBe('');
  });

  it('lists all current stack tools in the supported stack catalog', () => {
    const catalog = renderSupportedStackCatalog();
    expect(catalog).toContain('Upstash Redis');
    expect(catalog).toContain('Cloudflare Queues');
    expect(catalog).toContain('Potential additions to discuss');
  });

  it('explains each backend and only offers Next.js server features with Next.js', () => {
    const backendQuestion = getQuestionSequence({ frontend: 'nextjs' }).find(
      ({ id }) => id === 'backend',
    );
    const expressOption =
      backendQuestion?.kind === 'single'
        ? backendQuestion.options.find(({ value }) => value === 'express')
        : undefined;

    expect(expressOption?.description).toContain('WebSockets');
    expect(expressOption?.description).toContain('long-lived');
    expect(
      getQuestionSequence({ frontend: 'vite-vanilla' }).find(({ id }) => id === 'backend'),
    ).not.toMatchObject({
      options: expect.arrayContaining([expect.objectContaining({ value: 'nextjs' })]),
    });
  });

  it('asks only compatible deployment questions and explains their fit', () => {
    const expressQuestions = getQuestionSequence({ frontend: 'nextjs', backend: 'express' });
    const backendDeployment = expressQuestions.find(({ id }) => id === 'backendDeployment');
    expect(backendDeployment).toMatchObject({
      options: [
        expect.objectContaining({
          value: 'render',
          description: expect.stringContaining('Express'),
        }),
        expect.objectContaining({ value: 'vps' }),
        expect.objectContaining({ value: 'local-only' }),
      ],
    });
    const workerDeployment = getQuestionSequence({
      frontend: 'none',
      backend: 'cloudflare-workers',
    }).find(({ id }) => id === 'backendDeployment');
    expect(workerDeployment).toMatchObject({
      options: [
        expect.objectContaining({ value: 'cloudflare' }),
        expect.objectContaining({ value: 'local-only' }),
      ],
    });
  });

  it('keeps Vercel available for vanilla Vite static sites', () => {
    const question = getQuestionSequence({ frontend: 'vite-vanilla', backend: 'none' }).find(
      ({ id }) => id === 'frontendDeployment',
    );
    expect(question?.kind === 'single' ? question.options : []).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: 'vercel',
          description: expect.stringContaining('Vite production build'),
        }),
      ]),
    );
  });

  it('activates only relevant follow-up questions', () => {
    const withoutDatabase = getQuestionSequence({ database: 'none', authService: 'none' }).map(
      ({ id }) => id,
    );
    const withDatabaseAndAuth = getQuestionSequence({
      database: 'postgresql',
      authService: 'authjs',
    }).map(({ id }) => id);
    expect(withoutDatabase).not.toContain('databaseProvider');
    expect(withoutDatabase).not.toContain('loginMethods');
    expect(withDatabaseAndAuth).toContain('databaseProvider');
    expect(withDatabaseAndAuth).toContain('dataAccess');
    expect(withDatabaseAndAuth).toContain('loginMethods');
  });

  it('offers Cloudflare D1 only with Cloudflare Workers', () => {
    const databaseOptions = (backend: 'express' | 'cloudflare-workers') => {
      const question = getQuestionSequence({ frontend: 'nextjs', backend }).find(
        ({ id }) => id === 'database',
      );
      return question?.kind === 'single' ? question.options.map(({ value }) => value) : [];
    };

    expect(databaseOptions('express')).not.toContain('cloudflare-d1');
    expect(databaseOptions('cloudflare-workers')).toContain('cloudflare-d1');
  });

  it('allows Express projects to select SSE and WebSockets together', () => {
    const question = getQuestionSequence({ frontend: 'nextjs', backend: 'express' }).find(
      ({ id }) => id === 'realtimeModes',
    );

    expect(question).toMatchObject({
      kind: 'multi',
      options: [
        expect.objectContaining({ value: 'sse' }),
        expect.objectContaining({ value: 'websocket' }),
      ],
    });
  });

  it('allows multiple managed infrastructure needs and asks for each provider', () => {
    const questions = getQuestionSequence({
      frontend: 'nextjs',
      backend: 'express',
      infrastructure: ['caching', 'rate-limiting', 'background-jobs'],
    });

    expect(questions.find(({ id }) => id === 'infrastructure')).toMatchObject({
      kind: 'multi',
      help: expect.stringContaining('Space'),
    });
    expect(questions.map(({ id }) => id)).toEqual(
      expect.arrayContaining(['cacheProvider', 'rateLimitProvider', 'queueProvider']),
    );
  });
});

describe('configuration normalization', () => {
  it('expands starter answers into an explicit valid graph', () => {
    const config = normalizeProjectConfig(baseAnswers);

    expect(config.components.map(({ id }) => id)).toEqual(['web-app', 'api-service']);
    expect(
      config.connections
        .filter(({ protocol }) => protocol === 'sse' || protocol === 'websocket')
        .map(({ protocol }) => protocol),
    ).toEqual(['sse', 'websocket']);
    expect(config.deployment).toEqual({ frontend: 'vercel', backend: 'render' });
    expect(config.resources.map(({ id }) => id)).toEqual(['primary-database', 'object-storage']);
    expect(config.connections.map(({ protocol }) => protocol)).toEqual([
      'http',
      'database',
      'sse',
      'websocket',
      'object-storage',
    ]);
    expect(ProjectConfigV1Schema.parse(config)).toEqual(config);
  });

  it('rejects dangling graph connections', () => {
    const config = normalizeProjectConfig(baseAnswers);
    const invalid = {
      ...config,
      connections: [
        ...config.connections,
        {
          id: 'dangling',
          from: 'missing',
          to: 'api-service',
          protocol: 'http',
          purpose: 'Invalid connection',
        },
      ],
    };

    expect(() => ProjectConfigV1Schema.parse(invalid)).toThrow(/Dangling connection/);
  });

  it('rejects an incompatible deployment target', () => {
    expect(() =>
      ProjectConfigV1Schema.parse({
        ...normalizeProjectConfig(baseAnswers),
        deployment: { frontend: 'vercel', backend: 'cloudflare' },
      }),
    ).toThrow(/Express deployment target is incompatible/);
  });

  it('maps selected challenges to purpose-built Upstash products', () => {
    const config = normalizeProjectConfig(infrastructureAnswers);

    expect(config.resources.map(({ technology }) => technology)).toEqual([
      'Upstash QStash',
      'Upstash Redis',
      'Upstash Redis with @upstash/ratelimit',
    ]);
    expect(config.tools).toEqual(['upstash-redis-cache', 'upstash-ratelimit', 'upstash-qstash']);
    expect(
      config.connections.find(({ id }) => id === 'job-queue-to-background-worker'),
    ).toMatchObject({
      from: 'job-queue',
      to: 'background-worker',
    });
  });

  it('maps each Cloudflare Workers infrastructure need to its native tool', () => {
    const config = normalizeProjectConfig({
      ...infrastructureAnswers,
      cacheProvider: 'cloudflare',
      rateLimitProvider: 'cloudflare',
      queueProvider: 'cloudflare',
    });

    expect(config.tools).toEqual(['cloudflare-cache', 'cloudflare-ratelimit', 'cloudflare-queues']);
    expect(config.resources.map(({ technology }) => technology)).toEqual([
      'Cloudflare Queues',
      'Cloudflare Workers Cache API / KV',
      'Cloudflare Workers Rate Limiting',
    ]);
    expect(compilePrompt(config).blockIds).toEqual(
      expect.arrayContaining([
        'tool.cloudflare.cache',
        'tool.cloudflare.ratelimit',
        'tool.cloudflare.queues',
      ]),
    );
  });
});

describe('artifact generation', () => {
  it('is byte-identical for identical normalized answers', () => {
    const first = generateArtifacts(normalizeProjectConfig(baseAnswers));
    const second = generateArtifacts(normalizeProjectConfig({ ...baseAnswers }));

    expect(second).toEqual(first);
    expect(deserializeProjectConfig(first.projectYaml)).toEqual(
      normalizeProjectConfig(baseAnswers),
    );
    expect(first.projectYaml).not.toContain('createdAt');
    expect(first.agentPrompt).toContain('SYSTEM_ARCHITECTURE.md');
    expect(first.agentPrompt).toContain('If a root `AGENTS.md` exists');
    expect(first.agentPrompt).toMatchSnapshot();
    expect(first.projectYaml).toMatchSnapshot();
  });

  it.each(['plan-only', 'plan-then-build', 'direct-build'] as const)(
    'renders %s agent-mode guidance',
    (agentMode) => {
      const artifacts = generateArtifacts(normalizeProjectConfig({ ...baseAnswers, agentMode }));
      expect(artifacts.agentPrompt).toContain(agentMode);
      expect(artifacts.agentPrompt).toMatchSnapshot();
    },
  );

  it('selects independent challenge and tool blocks', () => {
    const config = normalizeProjectConfig(infrastructureAnswers);
    const compiled = compilePrompt(config);

    expect(compiled.blockIds).toEqual(
      expect.arrayContaining([
        'capability.caching',
        'capability.rate-limiting',
        'capability.background-jobs',
        'tool.upstash.redis-cache',
        'tool.upstash.ratelimit',
        'tool.upstash.qstash',
      ]),
    );
    expect(compiled.content).toContain('@upstash/redis');
    expect(compiled.content).toContain('@upstash/ratelimit');
    expect(compiled.content).toContain('Upstash QStash');
    expect(compiled.content).toMatchSnapshot();
  });

  it('records the selected frontend, backend, database, ORM, storage, and auth choices', () => {
    const config = normalizeProjectConfig(baseAnswers);
    const compiled = compilePrompt(config);
    expect(compiled.content).toContain('Supabase PostgreSQL with Drizzle ORM');
    expect(compiled.content).toContain('Supabase Storage');
    expect(compiled.content).toContain('authentication.service**: supabase-auth');
    expect(compiled.content).toContain('authentication.login-methods**: github, magic-link');
    expect(compiled.content).toContain('Backend — Render');
  });

  it('does not change an existing prompt when an unrelated tool block is registered', () => {
    const config = normalizeProjectConfig(baseAnswers);
    const existing = compilePrompt(config);
    const unrelatedBlock: PromptBlock = {
      id: 'tool.future.unselected',
      order: 1_250,
      applies: () => false,
      render: () => 'This must never be rendered.',
    };

    expect(compilePrompt(config, [...defaultPromptBlocks, unrelatedBlock])).toEqual(existing);
  });

  it('rejects duplicate prompt block IDs', () => {
    const config = normalizeProjectConfig(baseAnswers);
    const firstBlock = defaultPromptBlocks[0];
    if (!firstBlock) throw new Error('Expected at least one default prompt block.');

    expect(() => compilePrompt(config, [...defaultPromptBlocks, firstBlock])).toThrow(
      /Duplicate prompt block ID/,
    );
  });
});

describe('session use cases', () => {
  it('prepares and persists a completed session through the repository port', async () => {
    const records = new Map<string, SessionRecord>();
    const repository: SessionRepository = {
      async create(record) {
        records.set(record.metadata.id, record);
      },
      async list() {
        return [...records.values()].map(({ metadata }) => metadata);
      },
      async get(sessionId) {
        return records.get(sessionId);
      },
      async delete(sessionId) {
        records.delete(sessionId);
      },
    };

    const record = await createCompletedSession(repository, normalizeProjectConfig(baseAnswers), {
      clock: { now: () => new Date('2026-08-27T12:00:00.000Z') },
      ids: { createSessionId: () => 'session-1' },
      generatorVersion: '0.1.0',
    });

    expect(record.metadata).toMatchObject({
      id: 'session-1',
      title: 'Example platform',
      createdAt: '2026-08-27T12:00:00.000Z',
    });
    expect(record.metadata.promptBlockIds).toEqual(record.artifacts.promptBlockIds);
    await expect(repository.get('session-1')).resolves.toEqual(record);
  });
});
