import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rm } from 'node:fs/promises';
import { build } from 'esbuild';

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.resolve(packageDirectory, 'dist');

await rm(outputDirectory, { recursive: true, force: true });

await build({
  absWorkingDir: packageDirectory,
  entryPoints: ['src/bin/systemsextant.ts'],
  outbase: 'src',
  outdir: outputDirectory,
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  alias: {
    '@systemsextant/core': path.resolve(packageDirectory, '../core/src/index.ts'),
  },
});
