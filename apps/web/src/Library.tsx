import { useMemo, useState } from 'react';
import type { SessionMetadataV1, TemplateMetadataV1 } from '@systemsextant/core';

export function Library({
  sessions,
  templates,
  onOpenSession,
  onUseTemplate,
  onDeleteSession,
  onDeleteTemplate,
}: {
  sessions: readonly SessionMetadataV1[];
  templates: readonly TemplateMetadataV1[];
  onOpenSession: (id: string) => void;
  onUseTemplate: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
}) {
  const [tab, setTab] = useState<'sessions' | 'templates'>('sessions');
  const [query, setQuery] = useState('');
  const items = tab === 'sessions' ? sessions : templates;
  const filtered = useMemo(
    () => items.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())),
    [items, query],
  );
  return (
    <section className="library-page">
      <div className="library-heading">
        <div>
          <p className="eyebrow">Local library</p>
          <h1>Return to your work</h1>
          <p className="lede">
            Sessions and templates stay in this browser and are never uploaded.
          </p>
        </div>
        <label className="search-field">
          Search
          <input
            type="search"
            value={query}
            placeholder="Search by title"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <div className="library-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'sessions'}
          className={tab === 'sessions' ? 'active' : ''}
          onClick={() => setTab('sessions')}
        >
          Sessions <span>{sessions.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === 'templates'}
          className={tab === 'templates' ? 'active' : ''}
          onClick={() => setTab('templates')}
        >
          Templates <span>{templates.length}</span>
        </button>
      </div>
      {filtered.length === 0 ? (
        <div className="library-empty">
          <h2>No {tab} found</h2>
          <p>
            {query
              ? 'Try a different search.'
              : tab === 'sessions'
                ? 'Generate and save an architecture to create your first session.'
                : 'Save a generated architecture as a reusable template.'}
          </p>
        </div>
      ) : (
        <div className="library-grid">
          {tab === 'sessions'
            ? (filtered as SessionMetadataV1[]).map((item) => (
                <article className="library-card" key={item.id}>
                  <div>
                    <span className="type-pill">Session</span>
                    <h2>{item.title}</h2>
                    <p>{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>Frontend</dt>
                      <dd>{item.frontend}</dd>
                    </div>
                    <div>
                      <dt>Backend</dt>
                      <dd>{item.backend}</dd>
                    </div>
                  </dl>
                  <div className="card-actions">
                    <button className="secondary-action" onClick={() => onOpenSession(item.id)}>
                      Open
                    </button>
                    <button className="danger-link" onClick={() => onDeleteSession(item.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))
            : (filtered as TemplateMetadataV1[]).map((item) => (
                <article className="library-card" key={item.id}>
                  <div>
                    <span className="type-pill resource">Template</span>
                    <h2>{item.title}</h2>
                    <p>{item.description || 'Reusable architecture configuration'}</p>
                  </div>
                  <div className="card-actions">
                    <button className="secondary-action" onClick={() => onUseTemplate(item.id)}>
                      Use template
                    </button>
                    <button className="danger-link" onClick={() => onDeleteTemplate(item.id)}>
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
