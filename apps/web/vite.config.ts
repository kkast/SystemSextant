import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { defineConfig, type Plugin } from 'vite';

/**
 * Emits pre-compressed `.br` and `.gz` siblings for every built asset.
 *
 * Cloudflare Workers Static Assets serves these pre-compressed files as-is when
 * the browser's Accept-Encoding allows it, which avoids recompressing on each
 * request and beats on-the-fly gzip because Brotli can run at max level here.
 */
function precompressAssets(outDir = 'dist'): Plugin {
  const compressFile = (file: string) => {
    const source = readFileSync(file);
    // Brotli defaults to maximum quality; gzip gets explicit level 9.
    writeFileSync(`${file}.br`, brotliCompressSync(source));
    writeFileSync(`${file}.gz`, gzipSync(source, { level: 9 }));
  };
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(join(directory, entry.name));
      } else if (entry.isFile() && !entry.name.endsWith('.br') && !entry.name.endsWith('.gz')) {
        compressFile(join(directory, entry.name));
      }
    }
  };
  return {
    name: 'systemsextant:precompress-assets',
    apply: 'build',
    enforce: 'post',
    closeBundle() {
      walk(outDir);
    },
  };
}

export default defineConfig({
  build: {
    target: 'es2023',
  },
  plugins: [precompressAssets()],
});
