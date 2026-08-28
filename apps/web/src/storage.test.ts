import { indexedDB } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import {
  architectureDraftFromConfig,
  createArchitectureDraft,
  createNamedTemplate,
  normalizeArchitectureDraft,
  prepareCompletedSession,
  prepareTemplate,
  type TemplateRecord,
  type TemplateRepository,
} from '@systemsextant/core';
import {
  BrowserDraftRepository,
  BrowserSessionRepository,
  BrowserTemplateRepository,
  type DraftRecord,
} from './storage.js';

function databaseName(): string {
  return `systemsextant-test-${crypto.randomUUID()}`;
}

async function rawStoredValue(name: string, storeName: string, id: string): Promise<unknown> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name);
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error));
  });
  const transaction = database.transaction(storeName, 'readonly');
  const value = await new Promise<unknown>((resolve, reject) => {
    const request = transaction.objectStore(storeName).get(id);
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error));
  });
  database.close();
  return value;
}

function completedDraft() {
  return {
    ...createArchitectureDraft(),
    projectName: 'Browser project',
    productSummary: 'A deterministic browser architecture.',
    uis: [
      {
        id: 'ui-1',
        name: 'Web app',
        role: 'user-client' as const,
        runtime: 'vite-vanilla' as const,
        deployment: 'cloudflare' as const,
        description: 'The browser interface.',
      },
    ],
  };
}

describe('browser repositories', () => {
  it('stores, orders, loads, and deletes autosaved drafts', async () => {
    const repository = new BrowserDraftRepository(indexedDB, databaseName());
    const earlier: DraftRecord = {
      id: 'draft-1',
      draft: createArchitectureDraft(),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const later: DraftRecord = {
      id: 'draft-2',
      draft: completedDraft(),
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };
    await repository.put(earlier);
    await repository.put(later);

    expect((await repository.list()).map((record) => record.id)).toEqual(['draft-2', 'draft-1']);
    expect((await repository.get('draft-2'))?.draft.projectName).toBe('Browser project');

    await repository.delete('draft-2');
    expect(await repository.get('draft-2')).toBeUndefined();
  });

  it('implements the session repository contract with integrity verification', async () => {
    const name = databaseName();
    const repository = new BrowserSessionRepository(indexedDB, name);
    const config = normalizeArchitectureDraft(completedDraft());
    const record = prepareCompletedSession(config, {
      clock: { now: () => new Date('2026-01-02T00:00:00.000Z') },
      ids: { createSessionId: () => 'session-1' },
      generatorVersion: 'test',
    });
    await repository.create(record);

    const stored = (await rawStoredValue(name, 'sessions', 'session-1')) as {
      value: Record<string, unknown>;
    };
    // Browser sessions persist only metadata and project YAML; the prompt is compiled on demand.
    expect(Object.keys(stored.value).sort()).toEqual(['metadata', 'projectYaml']);

    expect((await repository.list())[0]?.title).toBe('Browser project');
    expect((await repository.get('session-1'))?.artifacts.projectYaml).toBe(
      record.artifacts.projectYaml,
    );

    await repository.delete('session-1');
    expect(await repository.get('session-1')).toBeUndefined();
  });

  it('implements the template repository contract with integrity verification', async () => {
    const repository = new BrowserTemplateRepository(indexedDB, databaseName());
    const config = normalizeArchitectureDraft(completedDraft());
    const record = prepareTemplate(config, {
      id: 'template-1',
      title: 'Browser template',
      description: 'Reusable in the browser.',
      now: new Date('2026-01-02T00:00:00.000Z'),
    });
    await repository.create(record);

    expect((await repository.list())[0]?.title).toBe('Browser template');
    expect((await repository.get('template-1'))?.config).toEqual(config);

    await repository.delete('template-1');
    expect(await repository.get('template-1')).toBeUndefined();
  });

  it('rejects saving a duplicate configuration as a named template', async () => {
    const repository = new BrowserTemplateRepository(indexedDB, databaseName());
    const config = normalizeArchitectureDraft(completedDraft());
    const dependencies = {
      title: 'Browser template',
      now: new Date('2026-01-02T00:00:00.000Z'),
    };

    await createNamedTemplate(repository, config, dependencies);
    await expect(
      createNamedTemplate(repository, config, { ...dependencies, title: 'Second try' }),
    ).rejects.toThrow(/already saved as “Browser template”/);
    expect((await repository.list())).toHaveLength(1);
  });

  it('atomically prevents concurrent duplicate template saves', async () => {
    const repository = new BrowserTemplateRepository(indexedDB, databaseName());
    const config = normalizeArchitectureDraft(completedDraft());
    const now = new Date('2026-01-02T00:00:00.000Z');
    const results = await Promise.allSettled([
      createNamedTemplate(repository, config, { title: 'First', now }),
      createNamedTemplate(repository, config, { title: 'Second', now }),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect(await repository.list()).toHaveLength(1);
  });

  it('restores grouped connections when importing a generated V2 configuration', () => {
    const draft = completedDraft();
    const config = normalizeArchitectureDraft({
      ...draft,
      services: [
        {
          id: 'service-1',
          name: 'API',
          runtime: 'cloudflare-workers',
          deployment: 'cloudflare',
          description: 'Primary API.',
        },
        {
          id: 'service-2',
          name: 'Jobs',
          runtime: 'cloudflare-workers',
          deployment: 'cloudflare',
          description: 'Background work.',
        },
      ],
      uiServices: [{ uiId: 'ui-1', serviceIds: ['service-1', 'service-2'] }],
    });

    expect(architectureDraftFromConfig(config).uiServices).toEqual([
      { uiId: 'ui-1', serviceIds: ['service-1', 'service-2'] },
    ]);
  });
});
