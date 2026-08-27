import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  normalizeProjectConfig,
  prepareCompletedSession,
  type QuestionnaireAnswers,
} from '@systemsextant/core';
import { ExportConflictError, exportSessionArtifacts } from './export-artifacts.js';
import { FileSessionRepository } from './file-session-repository.js';
import { sanitizeTerminalText } from './sanitize.js';

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'systemsextant-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

const answers: QuestionnaireAnswers = {
  projectName: 'Stored session',
  productSummary: 'A deterministic session used to verify local persistence.',
  frontend: 'vite-vanilla',
  backend: 'none',
  frontendDeployment: 'cloudflare',
  realtimeModes: [],
  database: 'none',
  fileStorage: 'none',
  infrastructure: [],
  authService: 'none',
  loginMethods: [],
  agentMode: 'plan-only',
};

function record() {
  return prepareCompletedSession(normalizeProjectConfig(answers), {
    clock: { now: () => new Date('2026-08-27T12:00:00.000Z') },
    ids: { createSessionId: () => 'session-1' },
    generatorVersion: '0.1.0',
  });
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('FileSessionRepository', () => {
  it('atomically persists, lists, loads, and deletes a session', async () => {
    const dataDirectory = await temporaryDirectory();
    const repository = new FileSessionRepository(dataDirectory);
    const expected = record();

    await repository.create(expected);

    await expect(repository.list()).resolves.toEqual([expected.metadata]);
    await expect(repository.get(expected.metadata.id)).resolves.toEqual(expected);
    expect(
      (await readdir(repository.sessionsDirectory)).some((name) => name.startsWith('.staging-')),
    ).toBe(false);

    await repository.delete(expected.metadata.id);
    await expect(repository.list()).resolves.toEqual([]);
  });

  it('rejects artifacts that no longer match session hashes', async () => {
    const dataDirectory = await temporaryDirectory();
    const repository = new FileSessionRepository(dataDirectory);
    const expected = record();
    await repository.create(expected);
    const [sessionDirectory] = await readdir(repository.sessionsDirectory);
    if (!sessionDirectory) throw new Error('Expected a stored session directory.');
    await writeFile(
      path.join(repository.sessionsDirectory, sessionDirectory, 'AGENT_PROMPT.md'),
      'tampered',
    );

    await expect(repository.get(expected.metadata.id)).rejects.toThrow(/integrity check failed/);
  });
});

describe('artifact export', () => {
  it('exports selected artifacts and protects existing files', async () => {
    const destination = await temporaryDirectory();
    const expected = record();

    await exportSessionArtifacts(expected, 'both', destination, false);
    await expect(readFile(path.join(destination, 'project.yaml'), 'utf8')).resolves.toBe(
      expected.artifacts.projectYaml,
    );
    await expect(readFile(path.join(destination, 'AGENT_PROMPT.md'), 'utf8')).resolves.toBe(
      expected.artifacts.agentPrompt,
    );

    await expect(
      exportSessionArtifacts(expected, 'both', destination, false),
    ).rejects.toBeInstanceOf(ExportConflictError);

    await writeFile(path.join(destination, 'project.yaml'), 'old');
    await exportSessionArtifacts(expected, 'yaml', destination, true);
    await expect(readFile(path.join(destination, 'project.yaml'), 'utf8')).resolves.toBe(
      expected.artifacts.projectYaml,
    );
  });
});

describe('terminal sanitization', () => {
  it('removes ANSI and control sequences while preserving Unicode and newlines', () => {
    expect(sanitizeTerminalText('\u001B[31mhello\u001B[0m\nБеларусь\u0007')).toBe(
      'hello\nБеларусь',
    );
  });
});
