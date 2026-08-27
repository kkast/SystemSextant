import { parseProjectConfig, type ProjectConfig } from '../schema/project-config.js';
import { defaultPromptBlocks, type PromptBlock } from './blocks.js';

export interface CompiledPrompt {
  readonly content: string;
  readonly blockIds: readonly string[];
}

export function compilePrompt(
  input: ProjectConfig,
  blocks: readonly PromptBlock[] = defaultPromptBlocks,
): CompiledPrompt {
  const config = parseProjectConfig(input);
  // Duplicate IDs make stored block selections ambiguous, so fail before applicability checks.
  const ids = new Set<string>();
  for (const block of blocks) {
    if (ids.has(block.id)) throw new Error(`Duplicate prompt block ID: ${block.id}`);
    ids.add(block.id);
  }

  // Stable numeric order plus ID tie-breaking makes registry insertion deterministic. Unselected
  // blocks never render, which is what keeps unrelated existing prompts byte-identical.
  const selected = blocks
    .filter((block) => block.applies(config))
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));

  return {
    content: `${selected.map((block) => block.render(config)).join('\n\n')}\n`,
    blockIds: selected.map((block) => block.id),
  };
}

export function compileAgentPrompt(input: ProjectConfig): string {
  return compilePrompt(input).content;
}

export { defaultPromptBlocks } from './blocks.js';
export type { PromptBlock } from './blocks.js';
