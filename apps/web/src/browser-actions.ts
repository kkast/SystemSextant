import type { ArtifactBundle } from '@systemsextant/core';

function safeBaseName(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'systemsextant-project'
  );
}

export async function copyText(value: string): Promise<void> {
  if (!navigator.clipboard) throw new Error('Clipboard access is unavailable in this browser.');
  await navigator.clipboard.writeText(value);
}

export function downloadText(
  filename: string,
  value: string,
  type = 'text/plain;charset=utf-8',
): void {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadArtifacts(title: string, artifacts: ArtifactBundle): void {
  const base = safeBaseName(title);
  downloadText(`${base}-project.yaml`, artifacts.projectYaml, 'application/yaml;charset=utf-8');
  downloadText(`${base}-agent-prompt.md`, artifacts.agentPrompt, 'text/markdown;charset=utf-8');
}
