import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const webDirectory = fileURLToPath(new URL('..', import.meta.url));
const envFile = fileURLToPath(new URL('../.env', import.meta.url));

if (!existsSync(envFile)) {
  throw new Error('Missing apps/web/.env. Copy apps/web/.env.example and add scoped Cloudflare credentials.');
}
loadEnvFile(envFile);

for (const name of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']) {
  if (!process.env[name]?.trim()) throw new Error(`${name} is required in apps/web/.env.`);
}

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

export function runWrangler(command) {
  const result = spawnSync(pnpm, ['exec', 'wrangler', command], {
    cwd: webDirectory,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
