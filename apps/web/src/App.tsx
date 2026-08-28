import {
  architectureDraftFromConfig,
  createArchitectureDraft,
  createNamedTemplate,
  ensureCompletedSession,
  deserializeProjectConfig,
  generateArtifacts,
  isProjectConfigV2,
  normalizeArchitectureDraft,
  type ArtifactBundle,
  type ProjectConfigV2,
  type SessionMetadataV1,
  type TemplateMetadataV1,
} from '@systemsextant/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArtifactView } from './ArtifactView.js';
import { Builder } from './Builder.js';
import { Library } from './Library.js';
import {
  BrowserDraftRepository,
  BrowserSessionRepository,
  BrowserTemplateRepository,
  type DraftRecord,
} from './storage.js';

type View = 'home' | 'builder' | 'artifacts' | 'library';
interface ArtifactState {
  title: string;
  artifacts: ArtifactBundle;
  config?: ProjectConfigV2;
}
function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}
function createDraftRecord(draft = createArchitectureDraft()): DraftRecord {
  const timestamp = new Date().toISOString();
  return { id: newId('draft'), draft, createdAt: timestamp, updatedAt: timestamp };
}

export function App() {
  const repositories = useMemo(
    () => ({
      drafts: new BrowserDraftRepository(),
      sessions: new BrowserSessionRepository(),
      templates: new BrowserTemplateRepository(),
    }),
    [],
  );
  const [view, setView] = useState<View>('home');
  const [activeDraft, setActiveDraft] = useState<DraftRecord>();
  const [artifactState, setArtifactState] = useState<ArtifactState>();
  const [drafts, setDrafts] = useState<readonly DraftRecord[]>([]);
  const [sessions, setSessions] = useState<readonly SessionMetadataV1[]>([]);
  const [templates, setTemplates] = useState<readonly TemplateMetadataV1[]>([]);
  const [status, setStatus] = useState<string>();
  const importInput = useRef<HTMLInputElement>(null);
  const refresh = useCallback(async () => {
    try {
      const [nextDrafts, nextSessions, nextTemplates] = await Promise.all([
        repositories.drafts.list(),
        repositories.sessions.list(),
        repositories.templates.list(),
      ]);
      setDrafts(nextDrafts);
      setSessions(nextSessions);
      setTemplates(nextTemplates);
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : String(reason));
    }
  }, [repositories]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!activeDraft || view !== 'builder') return;
    const timeout = window.setTimeout(() => {
      void repositories.drafts
        .put(activeDraft)
        .then(refresh)
        .catch((reason: unknown) =>
          setStatus(reason instanceof Error ? reason.message : String(reason)),
        );
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [activeDraft, refresh, repositories, view]);
  const beginDraft = async (record = createDraftRecord()) => {
    await repositories.drafts.put(record);
    setActiveDraft(record);
    setArtifactState(undefined);
    setStatus(undefined);
    setView('builder');
    await refresh();
  };
  const continueDraft = async (id: string) => {
    const record = await repositories.drafts.get(id);
    if (!record) {
      setStatus('That draft is no longer available.');
      return;
    }
    setActiveDraft(record);
    setArtifactState(undefined);
    setStatus(undefined);
    setView('builder');
  };
  const generate = async () => {
    if (!activeDraft) return;
    let config: ProjectConfigV2;
    try {
      config = normalizeArchitectureDraft(activeDraft.draft);
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : String(reason));
      return;
    }
    setArtifactState({ title: config.name, config, artifacts: generateArtifacts(config) });
    setStatus(undefined);
    setView('artifacts');
    // The session saves automatically with the generation that produced it.
    try {
      await ensureCompletedSession(repositories.sessions, config, {
        clock: { now: () => new Date() },
        generatorVersion: '0.1.0-web',
      });
      await refresh();
    } catch (reason) {
      setStatus(
        `The session could not be saved automatically: ${
          reason instanceof Error ? reason.message : String(reason)
        }`,
      );
    }
  };
  const saveTemplate = async (config: ProjectConfigV2, name: string) => {
    await createNamedTemplate(repositories.templates, config, {
      id: newId('template'),
      title: name,
      now: new Date(),
    });
    await refresh();
  };
  const useTemplate = async (id: string) => {
    const template = await repositories.templates.get(id);
    if (!template || !isProjectConfigV2(template.config)) {
      setStatus('Only V2 architecture templates can be edited in the browser.');
      return;
    }
    await beginDraft(createDraftRecord(architectureDraftFromConfig(template.config)));
  };
  const openSession = async (id: string) => {
    const session = await repositories.sessions.get(id);
    if (!session) {
      setStatus('That session is no longer available.');
      return;
    }
    setArtifactState({ title: session.metadata.title, artifacts: session.artifacts });
    setView('artifacts');
  };
  const confirmDelete = async (kind: 'session' | 'template' | 'draft', id: string) => {
    if (!window.confirm(`Delete this ${kind}? This cannot be undone.`)) return;
    if (kind === 'session') await repositories.sessions.delete(id);
    else if (kind === 'template') await repositories.templates.delete(id);
    else await repositories.drafts.delete(id);
    await refresh();
  };
  const importProject = async (file: File) => {
    try {
      const config = deserializeProjectConfig(await file.text());
      if (!isProjectConfigV2(config))
        throw new Error('The browser editor currently imports V2 project.yaml files only.');
      await beginDraft(createDraftRecord(architectureDraftFromConfig(config)));
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : String(reason));
    }
  };
  return (
    <div className="app-shell">
      {view !== 'builder' && (
        <header className="topbar">
          <button
            className="brand button-reset"
            onClick={() => setView('home')}
            aria-label="SystemSextant home"
          >
            <span className="brand-mark" aria-hidden="true">
              ✦
            </span>
            <span>SystemSextant</span>
          </button>
          <nav className="topnav" aria-label="Main navigation">
            <button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>
              Home
            </button>
            <button
              className={view === 'library' ? 'active' : ''}
              onClick={() => setView('library')}
            >
              Library <span>{sessions.length + templates.length}</span>
            </button>
          </nav>
        </header>
      )}
      <main>
        {status && view !== 'builder' && (
          <div className="global-message message" role="status">
            {status}
            <button onClick={() => setStatus(undefined)}>Dismiss</button>
          </div>
        )}
        {view === 'home' && (
          <section className="home">
            <div className="hero-copy">
              <p className="eyebrow">Architecture, with bearings</p>
              <h1>Turn a product idea into a system an agent can build.</h1>
              <p className="lede">
                Shape components, connections, and infrastructure in a visual workspace. Generate
                deterministic project instructions without sending your work anywhere.
              </p>
              <div className="hero-actions">
                <button className="primary-action" onClick={() => void beginDraft()}>
                  Start an architecture <span>→</span>
                </button>
                <button className="secondary-action" onClick={() => importInput.current?.click()}>
                  Import project.yaml
                </button>
                <input
                  ref={importInput}
                  className="visually-hidden"
                  type="file"
                  accept=".yaml,.yml,text/yaml,application/yaml"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void importProject(file);
                    event.target.value = '';
                  }}
                />
              </div>
            </div>
            <div className="dashboard-grid">
              <section className="dashboard-panel recent-panel">
                <div className="panel-heading">
                  <div>
                    <span className="card-number">Drafts</span>
                    <h2>Continue where you left off</h2>
                  </div>
                  <span>{drafts.length}</span>
                </div>
                {drafts.length === 0 ? (
                  <p className="panel-empty">Your autosaved drafts will appear here.</p>
                ) : (
                  <div className="recent-list">
                    {drafts.slice(0, 4).map((record) => (
                      <article key={record.id}>
                        <button onClick={() => void continueDraft(record.id)}>
                          <strong>{record.draft.projectName || 'Untitled architecture'}</strong>
                          <span>
                            {record.draft.uis.length} UIs · {record.draft.services.length} services
                            · {new Date(record.updatedAt).toLocaleDateString()}
                          </span>
                        </button>
                        <button
                          className="danger-link"
                          onClick={() => void confirmDelete('draft', record.id)}
                        >
                          Delete
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
              <section className="dashboard-panel library-summary">
                <div className="panel-heading">
                  <div>
                    <span className="card-number">Library</span>
                    <h2>Saved locally</h2>
                  </div>
                  <span>{sessions.length + templates.length}</span>
                </div>
                <div className="summary-counts">
                  <button onClick={() => setView('library')}>
                    <strong>{sessions.length}</strong>
                    <span>Completed sessions</span>
                  </button>
                  <button onClick={() => setView('library')}>
                    <strong>{templates.length}</strong>
                    <span>Reusable templates</span>
                  </button>
                </div>
              </section>
            </div>
            <div className="home-grid">
              <article className="feature-card accent-card">
                <span className="card-number">01</span>
                <h2>Build visually</h2>
                <p>
                  Add named interfaces and services, then map relationships without stepping through
                  a terminal questionnaire.
                </p>
              </article>
              <article className="feature-card">
                <span className="card-number">02</span>
                <h2>Generate locally</h2>
                <p>
                  The browser uses the same deterministic core as the CLI. No model call, account,
                  or telemetry is involved.
                </p>
              </article>
              <article className="feature-card wide-card">
                <div>
                  <span className="card-number">03</span>
                  <h2>Keep both artifacts</h2>
                </div>
                <p>
                  Review, copy, and download project.yaml and AGENT_PROMPT.md whenever you need
                  them.
                </p>
              </article>
            </div>
          </section>
        )}
        {view === 'builder' && activeDraft && (
          <Builder
            draft={activeDraft.draft}
            savedAt={activeDraft.updatedAt}
            onChange={(draft) =>
              setActiveDraft((current) =>
                current ? { ...current, draft, updatedAt: new Date().toISOString() } : current,
              )
            }
            onGenerate={generate}
            onExit={() => {
              setView('home');
              void refresh();
            }}
          />
        )}
        {view === 'artifacts' && artifactState && (
          <ArtifactView
            title={artifactState.title}
            artifacts={artifactState.artifacts}
            {...(artifactState.config ? { config: artifactState.config } : {})}
            onBack={() => setView(artifactState.config ? 'builder' : 'library')}
            onSaveTemplate={saveTemplate}
          />
        )}
        {view === 'library' && (
          <Library
            sessions={sessions}
            templates={templates}
            onOpenSession={(id) => void openSession(id)}
            onUseTemplate={(id) => void useTemplate(id)}
            onDeleteSession={(id) => void confirmDelete('session', id)}
            onDeleteTemplate={(id) => void confirmDelete('template', id)}
          />
        )}
      </main>
    </div>
  );
}
