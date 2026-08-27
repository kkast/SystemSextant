import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { compilePrompt } from '../prompt/compile.js';
import { parseProjectConfig, type ProjectConfig } from '../schema/project-config.js';
import { parseSessionMetadata, type SessionMetadataV1 } from '../schema/session.js';

export interface ArtifactBundle {
  readonly projectYaml: string;
  readonly agentPrompt: string;
  readonly projectConfigHash: string;
  readonly agentPromptHash: string;
  readonly promptBlockIds: readonly string[];
}

export function hashText(value: string): string {
  return bytesToHex(sha256(utf8ToBytes(value)));
}

export function serializeProjectConfig(input: ProjectConfig): string {
  const config = parseProjectConfig(input);
  return stringifyYaml(config, {
    lineWidth: 0,
    sortMapEntries: true,
  });
}

export function deserializeProjectConfig(value: string): ProjectConfig {
  return parseProjectConfig(parseYaml(value));
}

export function serializeSessionMetadata(input: SessionMetadataV1): string {
  const metadata = parseSessionMetadata(input);
  return stringifyYaml(metadata, {
    lineWidth: 0,
    sortMapEntries: true,
  });
}

export function deserializeSessionMetadata(value: string): SessionMetadataV1 {
  return parseSessionMetadata(parseYaml(value));
}

export function generateArtifacts(input: ProjectConfig): ArtifactBundle {
  const config = parseProjectConfig(input);
  const projectYaml = serializeProjectConfig(config);
  const compiledPrompt = compilePrompt(config);
  const agentPrompt = compiledPrompt.content;
  return {
    projectYaml,
    agentPrompt,
    projectConfigHash: hashText(projectYaml),
    agentPromptHash: hashText(agentPrompt),
    promptBlockIds: compiledPrompt.blockIds,
  };
}
