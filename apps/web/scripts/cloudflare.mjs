import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const webDirectory = fileURLToPath(new URL('..', import.meta.url));
const envFile = fileURLToPath(new URL('../.env', import.meta.url));

if (!existsSync(envFile)) {
  throw new Error('Missing apps/web/.env. Copy apps/web/.env.example and add scoped Cloudflare credentials.');
}
const fileEnvironment = parseEnv(readFileSync(envFile, 'utf8'));
const cloudflareEnvironment = {};
for (const name of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']) {
  const value = fileEnvironment[name]?.trim();
  if (!value) throw new Error(`${name} is required in apps/web/.env.`);
  cloudflareEnvironment[name] = value;
}

const commandEnvironment = {
  ...process.env,
  ...cloudflareEnvironment,
  WRANGLER_SEND_METRICS: 'false',
};
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

export function runWrangler(command) {
  const result = spawnSync(pnpm, ['exec', 'wrangler', command], {
    cwd: webDirectory,
    // The reviewed .env file wins over stale shell credentials on shared deploy machines.
    env: commandEnvironment,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
