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
  type QuestionnaireAnswers,
  type PromptBlock,
  type SessionRecord,
  type SessionRepository,
} from './index.js';

const baseAnswers: QuestionnaireAnswers = {
  projectName: 'Example platform',
  productSummary: 'A platform that helps teams coordinate technical projects.',
  architecture: 'nextjs-express',
  capabilities: ['database', 'authentication', 'real-time'],
  databaseType: 'postgresql',
  realtimeDirection: 'bidirectional',
  agentMode: 'plan-then-build',
};

describe('questionnaire', () => {
  it('explains when a separate Express server is useful', () => {
    const architectureQuestion = getQuestionSequence({}).find(({ id }) => id === 'architecture');
    const expressOption =
      architectureQuestion?.kind === 'single'
        ? architectureQuestion.options.find(({ value }) => value === 'nextjs-express')
        : undefined;

    expect(expressOption?.description).toContain('WebSockets');
    expect(expressOption?.description).toContain('long-running jobs');
  });

  it('activates only relevant follow-up questions', () => {
    const withoutCapabilities = getQuestionSequence({ capabilities: [] }).map(({ id }) => id);
    const withCapabilities = getQuestionSequence({
      capabilities: ['database', 'real-time'],
    }).map(({ id }) => id);

    expect(withoutCapabilities).not.toContain('databaseType');
    expect(withoutCapabilities).not.toContain('realtimeDirection');
    expect(withCapabilities).toContain('databaseType');
    expect(withCapabilities).toContain('realtimeDirection');
  });

  it('asks for the challenge solution only when an applicable challenge is selected', () => {
    expect(getQuestionSequence({ capabilities: ['database'] }).map(({ id }) => id)).not.toContain(
      'managedServicePreference',
    );
    expect(getQuestionSequence({ capabilities: ['caching'] }).map(({ id }) => id)).toContain(
      'managedServicePreference',
    );
    expect(getQuestionSequence({ capabilities: ['rate-limiting'] }).map(({ id }) => id)).toContain(
      'managedServicePreference',
    );
    expect(
      getQuestionSequence({ capabilities: ['background-jobs'] }).map(({ id }) => id),
    ).toContain('managedServicePreference');
  });
});

describe('configuration normalization', () => {
  it('expands starter answers into an explicit valid graph', () => {
    const config = normalizeProjectConfig(baseAnswers);

    expect(config.components.map(({ id }) => id)).toEqual(['web-app', 'api-service']);
    expect(config.resources.map(({ id }) => id)).toEqual(['primary-database']);
    expect(config.connections.map(({ protocol }) => protocol)).toEqual([
      'http',
      'database',
      'websocket',
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

  it('maps selected challenges to purpose-built Upstash products', () => {
    const config = normalizeProjectConfig({
      projectName: baseAnswers.projectName,
      productSummary: baseAnswers.productSummary,
      architecture: baseAnswers.architecture,
      capabilities: ['caching', 'rate-limiting', 'background-jobs'],
      managedServicePreference: 'upstash',
      agentMode: baseAnswers.agentMode,
    });

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
    const config = normalizeProjectConfig({
      projectName: baseAnswers.projectName,
      productSummary: baseAnswers.productSummary,
      architecture: baseAnswers.architecture,
      capabilities: ['caching', 'rate-limiting', 'background-jobs'],
      managedServicePreference: 'upstash',
      agentMode: baseAnswers.agentMode,
    });
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

  it('keeps challenge guidance without tool blocks for provider-neutral configurations', () => {
    const config = normalizeProjectConfig({
      projectName: 'Neutral cache',
      productSummary: 'A provider-neutral application cache for repeated reads.',
      architecture: 'nextjs',
      capabilities: ['caching'],
      managedServicePreference: 'provider-neutral',
      agentMode: 'plan-only',
    });
    const compiled = compilePrompt(config);

    expect(compiled.blockIds).toContain('capability.caching');
    expect(compiled.blockIds.some((id) => id.startsWith('tool.upstash.'))).toBe(false);
    expect(compiled.content).not.toContain('@upstash/redis');
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
