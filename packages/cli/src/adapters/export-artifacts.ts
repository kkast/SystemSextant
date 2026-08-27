import { access, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SessionRecord } from '@systemsextant/core';

export type ExportSelection = 'prompt' | 'yaml' | 'both';

export class ExportConflictError extends Error {
  constructor(readonly conflictingPaths: readonly string[]) {
    super(`Export would overwrite: ${conflictingPaths.join(', ')}`);
    this.name = 'ExportConflictError';
  }
}

interface ExportFile {
  readonly name: string;
  readonly content: string;
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function selectedFiles(record: SessionRecord, selection: ExportSelection): ExportFile[] {
  const files: ExportFile[] = [];
  if (selection === 'yaml' || selection === 'both') {
    files.push({ name: 'project.yaml', content: record.artifacts.projectYaml });
  }
  if (selection === 'prompt' || selection === 'both') {
    files.push({ name: 'AGENT_PROMPT.md', content: record.artifacts.agentPrompt });
  }
  return files;
}

export async function exportSessionArtifacts(
  record: SessionRecord,
  selection: ExportSelection,
  destinationDirectory: string,
  overwrite: boolean,
): Promise<readonly string[]> {
  const files = selectedFiles(record, selection);
  await mkdir(destinationDirectory, { recursive: true });
  const targets = files.map((file) => path.join(destinationDirectory, file.name));
  const conflicts = (
    await Promise.all(targets.map(async (target) => ((await exists(target)) ? target : undefined)))
  ).filter((target): target is string => target !== undefined);
  if (conflicts.length > 0 && !overwrite) throw new ExportConflictError(conflicts);

  const stagingDirectory = await mkdtemp(path.join(destinationDirectory, '.systemsextant-export-'));
  const backups = new Map<string, string>();
  const committed: string[] = [];

  try {
    await Promise.all(
      files.map((file) =>
        writeFile(path.join(stagingDirectory, file.name), file.content, {
          encoding: 'utf8',
          mode: 0o600,
          flush: true,
        }),
      ),
    );

    for (const target of conflicts) {
      const backup = path.join(stagingDirectory, `backup-${path.basename(target)}`);
      await rename(target, backup);
      backups.set(target, backup);
    }

    for (const file of files) {
      const target = path.join(destinationDirectory, file.name);
      await rename(path.join(stagingDirectory, file.name), target);
      committed.push(target);
    }

    await rm(stagingDirectory, { recursive: true, force: true });
    return targets;
  } catch (error) {
    await Promise.all(committed.map((target) => rm(target, { force: true })));
    for (const [target, backup] of backups) {
      if (await exists(backup)) await rename(backup, target);
    }
    await rm(stagingDirectory, { recursive: true, force: true });
    throw error;
  }
}
