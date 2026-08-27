import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hashText, parseProjectConfig, parseTemplateMetadata, serializeProjectConfig, type TemplateRecord, type TemplateRepository, type TemplateMetadataV1 } from '@systemsextant/core';
import { parse, stringify } from 'yaml';

const METADATA_FILE = 'template.yaml';
const PROJECT_FILE = 'project.yaml';

function safeSegment(value: string): string { return value.replace(/[^a-zA-Z0-9_-]/g, '-'); }

export class FileTemplateRepository implements TemplateRepository {
  readonly templatesDirectory: string;

  constructor(readonly dataDirectory: string) { this.templatesDirectory = path.join(dataDirectory, 'templates'); }

  async create(record: TemplateRecord): Promise<void> {
    await this.prepare();
    const duplicate = (await this.list()).find(
      (template) => template.projectConfigHash === record.metadata.projectConfigHash,
    );
    if (duplicate) {
      throw new Error(`This configuration is already saved as “${duplicate.title}”.`);
    }
    if (await this.find(record.metadata.id)) throw new Error(`Template already exists: ${record.metadata.id}`);
    const staging = await mkdtemp(path.join(this.templatesDirectory, `.staging-${safeSegment(record.metadata.id)}-`));
    const destination = path.join(this.templatesDirectory, safeSegment(record.metadata.id));
    try {
      await Promise.all([
        writeFile(path.join(staging, METADATA_FILE), stringify(record.metadata, { lineWidth: 0, sortMapEntries: true }), { encoding: 'utf8', mode: 0o600, flush: true }),
        writeFile(path.join(staging, PROJECT_FILE), serializeProjectConfig(record.config), { encoding: 'utf8', mode: 0o600, flush: true }),
      ]);
      await rename(staging, destination);
    } catch (error) { await rm(staging, { recursive: true, force: true }); throw error; }
  }

  async list(): Promise<readonly TemplateMetadataV1[]> {
    await this.prepare();
    const entries = await readdir(this.templatesDirectory, { withFileTypes: true });
    const all = await Promise.all(entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map(async (entry) => {
      try { return parseTemplateMetadata(parse(await readFile(path.join(this.templatesDirectory, entry.name, METADATA_FILE), 'utf8'))); } catch { return undefined; }
    }));
    return all.filter((item): item is TemplateMetadataV1 => item !== undefined).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async get(templateId: string): Promise<TemplateRecord | undefined> {
    const directory = await this.find(templateId); if (!directory) return undefined;
    const [metadataText, projectText] = await Promise.all([readFile(path.join(directory, METADATA_FILE), 'utf8'), readFile(path.join(directory, PROJECT_FILE), 'utf8')]);
    const metadata = parseTemplateMetadata(parse(metadataText));
    if (hashText(projectText) !== metadata.projectConfigHash) throw new Error(`Template integrity check failed: ${templateId}`);
    return { metadata, config: parseProjectConfig(parse(projectText)) };
  }

  async update(record: TemplateRecord): Promise<void> {
    const directory = await this.find(record.metadata.id); if (!directory) throw new Error(`Template not found: ${record.metadata.id}`);
    const staging = await mkdtemp(path.join(this.templatesDirectory, `.staging-${safeSegment(record.metadata.id)}-`));
    try {
      await Promise.all([
        writeFile(path.join(staging, METADATA_FILE), stringify(record.metadata, { lineWidth: 0, sortMapEntries: true }), { encoding: 'utf8', mode: 0o600, flush: true }),
        writeFile(path.join(staging, PROJECT_FILE), serializeProjectConfig(record.config), { encoding: 'utf8', mode: 0o600, flush: true }),
      ]);
      const backup = `${directory}.previous`;
      await rm(backup, { recursive: true, force: true });
      await rename(directory, backup);
      await rename(staging, directory);
      await rm(backup, { recursive: true, force: true });
    } catch (error) { await rm(staging, { recursive: true, force: true }); throw error; }
  }

  async delete(templateId: string): Promise<void> { const directory = await this.find(templateId); if (directory) await rm(directory, { recursive: true, force: false }); }

  private async prepare(): Promise<void> { await mkdir(this.templatesDirectory, { recursive: true, mode: 0o700 }); }
  private async find(id: string): Promise<string | undefined> {
    await this.prepare(); const entries = await readdir(this.templatesDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const directory = path.join(this.templatesDirectory, entry.name);
      try { if (parseTemplateMetadata(parse(await readFile(path.join(directory, METADATA_FILE), 'utf8'))).id === id) return directory; } catch { /* Ignore malformed local entries. */ }
    }
    return undefined;
  }
}
