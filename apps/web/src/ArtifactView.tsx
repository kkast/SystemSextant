import { useState } from 'react';
import type { ArtifactBundle, ProjectConfigV2 } from '@systemsextant/core';
import { copyText, downloadArtifacts, downloadText } from './browser-actions.js';

export function ArtifactView({
  title,
  artifacts,
  config,
  backLabel,
  onBack,
  onSaveTemplate,
}: {
  title: string;
  artifacts: ArtifactBundle;
  config?: ProjectConfigV2;
  backLabel: 'architecture' | 'library';
  onBack: () => void;
  onSaveTemplate: (config: ProjectConfigV2, name: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<'yaml' | 'prompt'>('yaml');
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
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
  const saveTemplate = async () => {
    if (!config || !templateName.trim() || busy) return;
    setBusy(true);
    setNotice(undefined);
    try {
      await onSaveTemplate(config, templateName);
      setTemplateOpen(false);
      setTemplateName('');
      setNotice('Template saved locally.');
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="container artifact-workspace stack" data-gap="l">
      <header className="artifact-header split">
        <div className="stack" data-gap="xs">
          <button className="button" data-variant="ghost" onClick={onBack}>
            ← Back to {backLabel}
          </button>
          <p className="eyebrow">Generated artifacts</p>
          <h1>{title}</h1>
          {config && <p className="text-muted">Saved automatically to your local sessions.</p>}
        </div>
        <div className="artifact-primary-actions toolbar">
          {config && (
            <button
              className="button"
              data-variant="secondary"
              disabled={busy}
              onClick={() => {
                setNotice(undefined);
                setTemplateOpen(true);
              }}
            >
              Save as template
            </button>
          )}
          <button className="button" disabled={busy} onClick={() => void downloadArtifacts(title, artifacts)}>
            Download both
          </button>
        </div>
      </header>
      {notice && (
        <div className="alert" role="status">
          {notice}
        </div>
      )}
      {templateOpen && config && (
        <form
          className="alert template-name-form stack"
          data-gap="m"
          onSubmit={(event) => {
            event.preventDefault();
            void saveTemplate();
          }}
        >
          <label className="field">
            <span className="field__label">Template name</span>
            <input
              autoFocus
              value={templateName}
              maxLength={100}
              placeholder="Name this reusable architecture"
              onChange={(event) => setTemplateName(event.target.value)}
            />
          </label>
          <div className="template-name-actions cluster">
            <button type="submit" className="button" disabled={busy || !templateName.trim()}>
              {busy ? 'Saving…' : 'Save template'}
            </button>
            <button
              type="button"
              className="button"
              data-variant="secondary"
              disabled={busy}
              onClick={() => {
                setTemplateOpen(false);
                setTemplateName('');
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <div className="code-panel">
        <div className="code-panel__toolbar">
          <div className="tabs" role="tablist" aria-label="Artifacts">
            <button
              role="tab"
              aria-selected={tab === 'yaml'}
              className="tab"
              onClick={() => setTab('yaml')}
            >
              project.yaml
            </button>
            <button
              role="tab"
              aria-selected={tab === 'prompt'}
              className="tab"
              onClick={() => setTab('prompt')}
            >
              AGENT_PROMPT.md
            </button>
          </div>
          <div>
            <button
              className="button"
              data-variant="ghost"
              onClick={() => void act(() => copyText(content), `${filename} copied.`)}
            >
              Copy
            </button>
            <button
              className="button"
              data-variant="ghost"
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
        <pre className="code-panel__content" tabIndex={0}>
          <code>{content}</code>
        </pre>
      </div>
    </section>
  );
}
