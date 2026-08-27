import os from 'node:os';
import path from 'node:path';
import envPaths from 'env-paths';

export function getSystemSextantDataDirectory(override?: string): string {
  const configured = override ?? process.env.SYSTEMSEXTANT_DATA_DIR;
  if (configured) return resolveUserPath(configured);
  return envPaths('systemsextant', { suffix: '' }).data;
}

export function resolveUserPath(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '~') return os.homedir();
  if (trimmed.startsWith(`~${path.sep}`)) {
    return path.resolve(os.homedir(), trimmed.slice(2));
  }
  return path.resolve(trimmed);
}
