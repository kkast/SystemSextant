import { useState } from 'react';
import type { ArtifactBundle, ProjectConfigV2 } from '@systemsextant/core';
import { copyText, downloadArtifacts, downloadText } from './browser-actions.js';

export function ArtifactView({
  title,
  artifacts,
  config,
  onBack,
  onSaveSession,
  onSaveTemplate,
}: {
  title: string;
  artifacts: ArtifactBundle;
  config?: ProjectConfigV2;
  onBack: () => void;
  onSaveSession: () => Promise<void>;
  onSaveTemplate: (config: ProjectConfigV2) => Promise<void>;
}) {
  const [tab, setTab] = useState<'yaml' | 'prompt'>('yaml');
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const content = tab === 'yaml' ? artifacts.projectYaml : artifacts.agentPrompt;
  const filename = tab === 'yaml' ? 'project.yaml' : 'AGENT_PROMPT.md';
  const act = async (action: () => Promise<void>, message: string) => {
    setBusy(true);
    setNotice(undefined);
    try {
      await action();
      setNotice(message);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="artifact-workspace">
      <header className="artifact-header">
        <div>
          <button className="back-link" onClick={onBack}>
            ← Back to {config ? 'architecture' : 'library'}
          </button>
          <p className="eyebrow">Generated artifacts</p>
          <h1>{title}</h1>
        </div>
        <div className="artifact-primary-actions">
          {config && (
            <button
              className="secondary-action"
              disabled={busy}
              onClick={() => void act(() => onSaveTemplate(config), 'Template saved locally.')}
            >
              Save as template
            </button>
          )}
          {config && (
            <button
              className="primary-action compact"
              disabled={busy}
              onClick={() =>
                void act(
                  onSaveSession,
                  'Session YAML saved locally. The prompt will be regenerated when opened.',
                )
              }
            >
              Save session
            </button>
          )}
          <button
            className="primary-action compact coral"
            onClick={() => downloadArtifacts(title, artifacts)}
          >
            Download both
          </button>
        </div>
      </header>
      {notice && (
        <div className="message" role="status">
          {notice}
        </div>
      )}
      <div className="artifact-panel">
        <div className="artifact-toolbar">
          <div className="tab-list" role="tablist" aria-label="Artifacts">
            <button
              role="tab"
              aria-selected={tab === 'yaml'}
              className={tab === 'yaml' ? 'active' : ''}
              onClick={() => setTab('yaml')}
            >
              project.yaml
            </button>
            <button
              role="tab"
              aria-selected={tab === 'prompt'}
              className={tab === 'prompt' ? 'active' : ''}
              onClick={() => setTab('prompt')}
            >
              AGENT_PROMPT.md
            </button>
          </div>
          <div>
            <button
              className="text-action"
              onClick={() => void act(() => copyText(content), `${filename} copied.`)}
            >
              Copy
            </button>
            <button
              className="text-action"
              onClick={() =>
                downloadText(
                  filename,
                  content,
                  tab === 'yaml' ? 'application/yaml;charset=utf-8' : 'text/markdown;charset=utf-8',
                )
              }
            >
              Download
            </button>
          </div>
        </div>
        <pre tabIndex={0}>
          <code>{content}</code>
        </pre>
      </div>
    </section>
  );
}
