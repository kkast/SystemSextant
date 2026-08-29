import type {
  ArchitectureDraft,
  ArtifactBundle,
  ProjectConfigV2,
  SessionMetadataV1,
  TemplateMetadataV1,
} from '@systemsextant/core';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadCore, preloadCore } from './core.js';

const ArtifactView = lazy(() =>
  import('./ArtifactView.js').then(({ ArtifactView }) => ({ default: ArtifactView })),
);
const Builder = lazy(() => import('./Builder.js').then(({ Builder }) => ({ default: Builder })));
const Library = lazy(() => import('./Library.js').then(({ Library }) => ({ default: Library })));
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
  source?: 'library';
}
function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}
async function createDraftRecord(draft?: ArchitectureDraft): Promise<DraftRecord> {
  const value = draft ?? (await loadCore()).createArchitectureDraft();
  const timestamp = new Date().toISOString();
  return { id: newId('draft'), draft: value, createdAt: timestamp, updatedAt: timestamp };
}

function DeleteDialog({
  kind,
  onConfirm,
  onCancel,
}: {
  kind: 'session' | 'template' | 'draft';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="delete-dialog"
      aria-labelledby="delete-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="card stack" data-gap="m">
        <div className="stack" data-gap="xs">
          <p className="eyebrow">Confirm deletion</p>
          <h2 id="delete-dialog-title">Delete this {kind}?</h2>
          <p className="text-muted">This cannot be undone.</p>
        </div>
        <div className="alert" data-variant="danger" role="alert">
          The saved {kind} will be permanently removed from this browser.
        </div>
        <div className="toolbar">
          <button className="button" data-variant="secondary" autoFocus onClick={onCancel}>
            Cancel
          </button>
          <button className="button" data-variant="danger-ghost" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </dialog>
  );
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
  const [libraryTab, setLibraryTab] = useState<'sessions' | 'templates'>('sessions');
  const [pendingDelete, setPendingDelete] = useState<{
    kind: 'session' | 'template' | 'draft';
    id: string;
  }>();
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
  // Warm the core only when the browser has spare time. The timeout prevents
  // indefinite deferral while keeping parsing work out of the startup path.
  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const idle = window.requestIdleCallback(preloadCore, { timeout: 2_000 });
      return () => window.cancelIdleCallback(idle);
    }
    const timeout = globalThis.setTimeout(preloadCore, 2_000);
    return () => globalThis.clearTimeout(timeout);
  }, []);
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
  const beginDraft = async (record?: DraftRecord) => {
    const next = record ?? (await createDraftRecord());
    await repositories.drafts.put(next);
    setActiveDraft(next);
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
    const core = await loadCore();
    let config: ProjectConfigV2;
    try {
      config = core.normalizeArchitectureDraft(activeDraft.draft);
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : String(reason));
      return;
    }
    setArtifactState({ title: config.name, config, artifacts: core.generateArtifacts(config) });
    setStatus(undefined);
    setView('artifacts');
    // The session saves automatically with the generation that produced it.
    try {
      await core.ensureCompletedSession(repositories.sessions, config, {
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
    const core = await loadCore();
    await core.createNamedTemplate(repositories.templates, config, {
      title: name,
      now: new Date(),
    });
    setLibraryTab('templates');
    await refresh();
  };
  const useTemplate = async (id: string) => {
    const template = await repositories.templates.get(id);
    const core = await loadCore();
    if (!template || !core.isProjectConfigV2(template.config)) {
      setStatus('Only V2 architecture templates can be edited in the browser.');
      return;
    }
    await beginDraft(await createDraftRecord(core.architectureDraftFromConfig(template.config)));
  };
  const openSession = async (id: string) => {
    const session = await repositories.sessions.get(id);
    if (!session) {
      setStatus('That session is no longer available.');
      return;
    }
    const core = await loadCore();
    const storedConfig = core.deserializeProjectConfig(session.artifacts.projectYaml);
    setArtifactState({
      title: session.metadata.title,
      artifacts: session.artifacts,
      ...(core.isProjectConfigV2(storedConfig) ? { config: storedConfig } : {}),
      source: 'library',
    });
    setView('artifacts');
  };
  const deletePendingItem = async () => {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.kind === 'session') await repositories.sessions.delete(pendingDelete.id);
      else if (pendingDelete.kind === 'template')
        await repositories.templates.delete(pendingDelete.id);
      else await repositories.drafts.delete(pendingDelete.id);
      setPendingDelete(undefined);
      await refresh();
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : String(reason));
    }
  };
  const importProject = async (file: File) => {
    try {
      const core = await loadCore();
      const config = core.deserializeProjectConfig(await file.text());
      if (!core.isProjectConfigV2(config))
        throw new Error('The browser editor currently imports V2 project.yaml files only.');
      await beginDraft(await createDraftRecord(core.architectureDraftFromConfig(config)));
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : String(reason));
    }
  };
  return (
    <div className="app-shell">
      {view !== 'builder' && (
        <div className="container">
          <header className="topbar">
            <button
              className="brand"
              onClick={() => setView('home')}
              aria-label="SystemSextant home"
            >
              <span className="brand-mark" aria-hidden="true">
                ✦
              </span>
              <span>SystemSextant</span>
            </button>
            <nav className="topnav cluster" data-gap="xs" aria-label="Main navigation">
              <button
                className="nav-item"
                aria-current={view === 'home' ? 'page' : undefined}
                onClick={() => setView('home')}
              >
                Home
              </button>
              <button
                className="nav-item"
                aria-current={view === 'library' ? 'page' : undefined}
                onClick={() => setView('library')}
              >
                Library
              </button>
            </nav>
          </header>
        </div>
      )}
      <main>
        {status && view !== 'builder' && (
          <div className="container">
            <div className="global-message alert split" role="status">
              {status}
              <button className="button" data-variant="ghost" onClick={() => setStatus(undefined)}>
                Dismiss
              </button>
            </div>
          </div>
        )}
        {pendingDelete && view !== 'builder' && (
          <DeleteDialog
            kind={pendingDelete.kind}
            onConfirm={() => void deletePendingItem()}
            onCancel={() => setPendingDelete(undefined)}
          />
        )}
        {view === 'home' && (
          <section className="container page stack" data-gap="xl">
            <div className="stack hero-copy" data-gap="m">
              <p className="eyebrow">Architecture, with bearings</p>
              <h1>Turn a product idea into a system an agent can build.</h1>
              <p className="text-lead">
                Shape components, connections, and infrastructure in a visual workspace. Generate
                deterministic project instructions without sending your work anywhere.
              </p>
              <div className="grid" data-gap="m">
                <button className="button" onClick={() => void beginDraft()}>
                  Start an architecture <span>→</span>
                </button>
                <button
                  className="button"
                  data-variant="secondary"
                  onClick={() => importInput.current?.click()}
                >
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
            <div className="grid dashboard-grid" data-gap="l">
              <section className="dashboard-panel recent-panel card stack" data-decoration="orb">
                <div className="panel-heading split">
                  <div className="stack" data-gap="xs">
                    <span className="eyebrow">Drafts</span>
                    <h2>Continue where you left off</h2>
                  </div>
                  <span>{drafts.length}</span>
                </div>
                {drafts.length === 0 ? (
                  <p className="text-muted">Your autosaved drafts will appear here.</p>
                ) : (
                  <div className="recent-list stack" data-gap="xs">
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
                          className="button"
                          data-variant="danger-ghost"
                          onClick={() => setPendingDelete({ kind: 'draft', id: record.id })}
                        >
                          Delete
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
              <section
                className="dashboard-panel library-summary card stack"
                data-decoration="dots"
              >
                <div className="panel-heading split">
                  <div className="stack" data-gap="xs">
                    <span className="eyebrow">Library</span>
                    <h2>Saved locally</h2>
                  </div>
                </div>
                <div className="stack">
                  <button
                    className="button stat"
                    data-variant="secondary"
                    onClick={() => {
                      setLibraryTab('sessions');
                      setView('library');
                    }}
                  >
                    <strong className="stat__value">{sessions.length}</strong>
                    <span className="stat__label">Completed sessions</span>
                  </button>
                  <button
                    className="button stat"
                    data-variant="secondary"
                    onClick={() => {
                      setLibraryTab('templates');
                      setView('library');
                    }}
                  >
                    <strong className="stat__value">{templates.length}</strong>
                    <span className="stat__label">Reusable templates</span>
                  </button>
                </div>
              </section>
            </div>
            <div className="grid feature-grid">
              <article className="feature-card card stack" data-decoration="lines">
                <span className="eyebrow">01</span>
                <h2>Build visually</h2>
                <p className="text-muted">
                  Add named interfaces and services, then map relationships without stepping through
                  a terminal questionnaire.
                </p>
              </article>
              <article className="feature-card card stack" data-decoration="dots">
                <span className="eyebrow">02</span>
                <h2>Generate locally</h2>
                <p className="text-muted">
                  The browser uses the same deterministic core as the CLI. No model call, account,
                  or telemetry is involved.
                </p>
              </article>
              <article className="feature-card card stack" data-decoration="orb">
                <div className="stack" data-gap="xs">
                  <span className="eyebrow">03</span>
                  <h2>Keep both artifacts</h2>
                </div>
                <p className="text-muted">
                  Review, copy, and download project.yaml and AGENT_PROMPT.md whenever you need
                  them.
                </p>
              </article>
            </div>
          </section>
        )}
        <Suspense
          fallback={
            <div className="container loading-workspace">
              <p className="alert">Loading workspace…</p>
            </div>
          }
        >
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
              backLabel={artifactState.source === 'library' ? 'library' : 'architecture'}
              onBack={() => setView(artifactState.source === 'library' ? 'library' : 'builder')}
              onSaveTemplate={saveTemplate}
            />
          )}
          {view === 'library' && (
            <Library
              sessions={sessions}
              templates={templates}
              initialTab={libraryTab}
              onTabChange={setLibraryTab}
              onOpenSession={(id) => void openSession(id)}
              onUseTemplate={(id) => void useTemplate(id)}
              onDeleteSession={(id) => setPendingDelete({ kind: 'session', id })}
              onDeleteTemplate={(id) => setPendingDelete({ kind: 'template', id })}
            />
          )}
        </Suspense>
      </main>
    </div>
  );
}
