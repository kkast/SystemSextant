import process from 'node:process';
import clipboard from 'clipboardy';
import { Command } from 'commander';
import { render } from 'ink';
import { App } from './app/app.js';
import { FileSessionRepository } from './adapters/file-session-repository.js';
import { FileTemplateRepository } from './adapters/file-template-repository.js';
import { getSystemSextantDataDirectory } from './adapters/paths.js';
import { systemClock, uuidGenerator } from './adapters/platform.js';

export const VERSION = '0.1.0';

export async function run(argv: readonly string[] = process.argv): Promise<void> {
  const program = new Command()
    .name('systemsextant')
    .description('Navigate decisions into an agent-ready architecture.')
    .version(VERSION)
    .option('--data-dir <directory>', 'override the platform application-data directory');

  program.parse(argv);
  const options = program.opts<{ dataDir?: string }>();

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('SystemSextant requires an interactive terminal.');
  }

  const dataDirectory = getSystemSextantDataDirectory(options.dataDir);
  const repository = new FileSessionRepository(dataDirectory);
  const templateRepository = new FileTemplateRepository(dataDirectory);
  const instance = render(
    <App
      repository={repository}
      templateRepository={templateRepository}
      clipboard={{ write: (value) => clipboard.write(value) }}
      clock={systemClock}
      ids={uuidGenerator}
      generatorVersion={VERSION}
      dataDirectory={dataDirectory}
    />,
  );
  await instance.waitUntilExit();
}

export { App } from './app/app.js';
export { exportSessionArtifacts, ExportConflictError } from './adapters/export-artifacts.js';
export { FileSessionRepository } from './adapters/file-session-repository.js';
export { FileTemplateRepository } from './adapters/file-template-repository.js';
export { getSystemSextantDataDirectory } from './adapters/paths.js';
