#!/usr/bin/env node

import { run } from '../index.js';

run().catch((error: unknown) => {
  process.stderr.write(
    `SystemSextant: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
