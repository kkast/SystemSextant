import { useMemo, useState } from 'react';
import type { SessionMetadataV1, TemplateMetadataV1 } from '@systemsextant/core';

export function Library({
  sessions,
  templates,
  initialTab,
  onTabChange,
  onOpenSession,
  onUseTemplate,
  onDeleteSession,
  onDeleteTemplate,
}: {
  sessions: readonly SessionMetadataV1[];
  templates: readonly TemplateMetadataV1[];
  initialTab: 'sessions' | 'templates';
  onTabChange: (tab: 'sessions' | 'templates') => void;
  onOpenSession: (id: string) => void;
  onUseTemplate: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
}) {
  const [tab, setTab] = useState<'sessions' | 'templates'>(initialTab);
  const [query, setQuery] = useState('');
  const items = tab === 'sessions' ? sessions : templates;
  const filtered = useMemo(
    () => items.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())),
    [items, query],
  );
  return (
    <section className="container library-page stack" data-gap="m">
      <div className="library-heading split">
        <div className="stack" data-gap="xs">
          <p className="eyebrow">Local library</p>
          <h1>Return to your work</h1>
          <p className="text-lead">
            Sessions and templates stay in this browser and are never uploaded.
          </p>
        </div>
        <label className="field search-field">
          <span className="field__label">Search</span>
          <input
            type="search"
            value={query}
            placeholder="Search by title"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'sessions'}
          className="tab"
          onClick={() => {
            setTab('sessions');
            onTabChange('sessions');
          }}
        >
          Sessions <span>{sessions.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === 'templates'}
          className="tab"
          onClick={() => {
            setTab('templates');
            onTabChange('templates');
          }}
        >
          Templates <span>{templates.length}</span>
        </button>
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state stack" data-gap="s">
          <h2>No {tab} found</h2>
          <p className="text-muted">
            {query
              ? 'Try a different search.'
              : tab === 'sessions'
                ? 'Generate and save an architecture to create your first session.'
                : 'Save a generated architecture as a reusable template.'}
          </p>
        </div>
      ) : (
        <div className="library-grid grid">
          {tab === 'sessions'
            ? (filtered as SessionMetadataV1[]).map((item) => (
                <article className="library-card card stack" data-gap="m" key={item.id}>
                  <div className="stack" data-gap="s">
                    <span className="badge" data-variant="accent">
                      Session
                    </span>
                    <h2>{item.title}</h2>
                    <p className="text-muted">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                  <dl className="definition-grid">
                    <div>
                      <dt>Frontend</dt>
                      <dd>{item.frontend}</dd>
                    </div>
                    <div>
                      <dt>Backend</dt>
                      <dd>{item.backend}</dd>
                    </div>
                  </dl>
                  <div className="card-actions split">
                    <button
                      className="button"
                      data-variant="secondary"
                      onClick={() => onOpenSession(item.id)}
                    >
                      Open
                    </button>
                    <button
                      className="button"
                      data-variant="danger-ghost"
                      onClick={() => onDeleteSession(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))
            : (filtered as TemplateMetadataV1[]).map((item) => (
                <article className="library-card card stack" data-gap="m" key={item.id}>
                  <div className="stack" data-gap="s">
                    <span className="badge">Template</span>
                    <h2>{item.title}</h2>
                    <p className="text-muted">
                      {item.description || 'Reusable architecture configuration'}
                    </p>
                  </div>
                  <div className="card-actions split">
                    <button
                      className="button"
                      data-variant="secondary"
                      onClick={() => onUseTemplate(item.id)}
                    >
                      Use template
                    </button>
                    <button
                      className="button"
                      data-variant="danger-ghost"
                      onClick={() => onDeleteTemplate(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
        </div>
      )}
    </section>
  );
}
