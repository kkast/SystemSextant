import type { ArchitectureDraft, ServiceDraft, UiDraft } from '@systemsextant/core';
import { useMemo, useState } from 'react';
import { loadCore } from './core.js';

type Section = 'project' | 'components' | 'connections' | 'resources' | 'workflow' | 'review';
const sections: readonly { id: Section; label: string }[] = [
  { id: 'project', label: 'Project' },
  { id: 'components', label: 'Components' },
  { id: 'connections', label: 'Connections' },
  { id: 'resources', label: 'Resources' },
  { id: 'workflow', label: 'Agent workflow' },
  { id: 'review', label: 'Review' },
];

function nextId(prefix: string, existing: readonly string[]) {
  let index = 1;
  while (existing.includes(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

/**
 * Preset labels, names, and descriptions keep component types self-explanatory. Selecting a role or
 * runtime replaces only untouched values, so names and descriptions the user wrote are preserved.
 */
const uiRolePresets: Readonly<Record<UiDraft['role'], { label: string; name: string; description: string }>> = {
  admin: {
    label: 'Admin portal',
    name: 'Admin UI',
    description: 'Admin UI for internal operations and management.',
  },
  'business-client': {
    label: 'Business client',
    name: 'Business client UI',
    description: 'Interface for business customers and their teams.',
  },
  'user-client': {
    label: 'User client',
    name: 'User client UI',
    description: 'Primary interface for end users.',
  },
  'landing-page': {
    label: 'Landing page',
    name: 'Landing page',
    description: 'Public marketing and conversion page.',
  },
  custom: {
    label: 'Custom UI',
    name: 'Custom UI',
    description: 'Interface with a purpose you describe.',
  },
};
const serviceRuntimePresets: Readonly<Record<'express' | 'cloudflare-workers', { label: string; description: string }>> = {
  express: { label: 'Express', description: 'Backend server exposing HTTP APIs.' },
  'cloudflare-workers': {
    label: 'Cloudflare Workers',
    description: 'Backend server running on Cloudflare Workers.',
  },
};
const serviceNamePreset = 'Backend server';
const presetUiNames = new Set(Object.values(uiRolePresets).map((preset) => preset.name));
const presetUiDescriptions = new Set(Object.values(uiRolePresets).map((preset) => preset.description));
const presetServiceDescriptions = new Set(Object.values(serviceRuntimePresets).map((preset) => preset.description));
const untouchedUiName = (name: string) =>
  !name.trim() || presetUiNames.has(name) || /^UI \d+$/.test(name);
const untouchedUiDescription = (description: string) =>
  !description.trim() ||
  presetUiDescriptions.has(description) ||
  description === 'Describe this interface, its users, and the outcome it owns.';
const untouchedServiceName = (name: string) =>
  !name.trim() || name === serviceNamePreset || /^Service \d+$/.test(name);
const untouchedServiceDescription = (description: string) =>
  !description.trim() ||
  presetServiceDescriptions.has(description) ||
  description === 'Describe the business capability and operations this service owns.';

function CheckboxGroup({
  values,
  options,
  onChange,
  label,
}: {
  values: readonly string[];
  options: readonly { id: string; label: string }[];
  onChange: (values: string[]) => void;
  label: string;
}) {
  return (
    <fieldset className="checkbox-group">
      <legend>{label}</legend>
      {options.length === 0 ? (
        <span className="muted">No available services</span>
      ) : (
        options.map((option) => (
          <label className="check-row" key={option.id}>
            <input
              type="checkbox"
              checked={values.includes(option.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...values, option.id]
                    : values.filter((value) => value !== option.id),
                )
              }
            />
            <span>{option.label}</span>
          </label>
        ))
      )}
    </fieldset>
  );
}

function EditorSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="editor-section">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="lede">{description}</p>
      <div className="editor-content">{children}</div>
    </div>
  );
}
function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

export function Builder({
  draft,
  savedAt,
  onChange,
  onGenerate,
  onExit,
}: {
  draft: ArchitectureDraft;
  savedAt?: string;
  onChange: (draft: ArchitectureDraft) => void;
  onGenerate: () => void | Promise<void>;
  onExit: () => void;
}) {
  const [section, setSection] = useState<Section>('project');
  const [error, setError] = useState<string>();
  const sectionIndex = sections.findIndex((item) => item.id === section);
  const navigateTo = (nextIndex: number) => {
    const next = sections[nextIndex];
    if (!next) return;
    setSection(next.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const ids = useMemo(() => [...draft.uis, ...draft.services].map((item) => item.id), [draft]);
  const components = useMemo(
    () =>
      [...draft.uis, ...draft.services].map((item) => ({
        id: item.id,
        label: item.name || item.id,
      })),
    [draft],
  );
  const patchUi = (id: string, patch: Partial<UiDraft>) =>
    onChange({
      ...draft,
      uis: draft.uis.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  const patchService = (id: string, patch: Partial<ServiceDraft>) =>
    onChange({
      ...draft,
      services: draft.services.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  const patchUiRole = (id: string, role: UiDraft['role']) => {
    const preset = uiRolePresets[role];
    const current = draft.uis.find((item) => item.id === id);
    if (!current) return;
    patchUi(id, {
      role,
      ...(untouchedUiName(current.name) ? { name: preset.name } : {}),
      ...(untouchedUiDescription(current.description) ? { description: preset.description } : {}),
    });
  };

  const removeComponent = (id: string) => {
    const remaining = ids.filter((candidate) => candidate !== id);
    const repair = <
      T extends { users: { ownerComponentId: string; consumerComponentIds: string[] } },
    >(
      resource: T | undefined,
    ): T | undefined => {
      if (!resource || remaining.length === 0) return undefined;
      const ownerComponentId = remaining.includes(resource.users.ownerComponentId)
        ? resource.users.ownerComponentId
        : remaining[0]!;
      const consumers = resource.users.consumerComponentIds.filter((candidate) =>
        remaining.includes(candidate),
      );
      return {
        ...resource,
        users: {
          ownerComponentId,
          consumerComponentIds: consumers.length ? consumers : [ownerComponentId],
        },
      };
    };
    const {
      database: _database,
      cache: _cache,
      rateLimit: _rateLimit,
      queue: _queue,
      fileStorage: _fileStorage,
      ...base
    } = draft;
    const database = repair(draft.database);
    const cache = repair(draft.cache);
    const rateLimit = repair(draft.rateLimit);
    const queue = repair(draft.queue);
    const fileStorage = repair(draft.fileStorage);
    onChange({
      ...base,
      uis: draft.uis.filter((item) => item.id !== id),
      services: draft.services.filter((item) => item.id !== id),
      uiServices: draft.uiServices
        .filter((item) => item.uiId !== id)
        .map((item) => ({
          ...item,
          serviceIds: item.serviceIds.filter((candidate) => candidate !== id),
        })),
      serviceDependencies: draft.serviceDependencies
        .filter((item) => item.serviceId !== id)
        .map((item) => ({
          ...item,
          dependencyIds: item.dependencyIds.filter((candidate) => candidate !== id),
        })),
      ...(database ? { database } : {}),
      ...(cache ? { cache } : {}),
      ...(rateLimit ? { rateLimit } : {}),
      ...(queue ? { queue } : {}),
      ...(fileStorage ? { fileStorage } : {}),
    });
  };
  const generate = () => {
    void (async () => {
      const core = await loadCore();
      try {
        core.normalizeArchitectureDraft(draft);
        setError(undefined);
        await onGenerate();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
        setSection('review');
      }
    })();
  };

  return (
    <section className="workspace">
      <aside className="workspace-sidebar">
        <button className="back-link" onClick={onExit}>
          ← Home
        </button>
        <div className="draft-heading">
          <p className="eyebrow">Architecture draft</p>
          <strong>{draft.projectName || 'Untitled architecture'}</strong>
          <span>
            {savedAt
              ? `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Saving locally…'}
          </span>
        </div>
        <nav aria-label="Architecture sections">
          {sections.map((item, index) => (
            <button
              className={section === item.id ? 'nav-item active' : 'nav-item'}
              key={item.id}
              onClick={() => setSection(item.id)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <div className="workspace-main">
        {section === 'project' && (
          <EditorSection
            eyebrow="Project"
            title="Describe what you are building"
            description="Give the architecture a stable name and enough context for the receiving coding agent."
          >
            <label>
              Project name
              <input
                value={draft.projectName}
                maxLength={100}
                placeholder="My product"
                onChange={(event) => onChange({ ...draft, projectName: event.target.value })}
              />
            </label>
            <label>
              Product summary
              <textarea
                rows={6}
                maxLength={2000}
                value={draft.productSummary}
                placeholder="Who is it for, and what should it accomplish?"
                onChange={(event) => onChange({ ...draft, productSummary: event.target.value })}
              />
            </label>
          </EditorSection>
        )}

        {section === 'components' && (
          <EditorSection
            eyebrow="Components"
            title="Name the pieces of the system"
            description="Interfaces and services are independent responsibilities, not generic frontend/backend placeholders."
          >
            <div className="section-toolbar">
              <h2>Interfaces</h2>
              <button
                className="secondary-action"
                onClick={() => {
                  const id = nextId('ui', ids);
                  onChange({
                    ...draft,
                    uis: [
                      ...draft.uis,
                      {
                        id,
                        name: uiRolePresets.custom.name,
                        role: 'custom',
                        runtime: 'vite-vanilla',
                        deployment: 'cloudflare',
                        description: uiRolePresets.custom.description,
                      },
                    ],
                  });
                }}
              >
                + Add interface
              </button>
            </div>
            <div className="card-stack">
              {draft.uis.length === 0 && (
                <EmptyState>Backend-only architectures can leave interfaces empty.</EmptyState>
              )}
              {draft.uis.map((ui) => (
                <article className="editor-card" key={ui.id}>
                  <div className="card-header">
                    <span className="type-pill">UI · {ui.id}</span>
                    <button className="danger-link" onClick={() => removeComponent(ui.id)}>
                      Remove
                    </button>
                  </div>
                  <div className="form-grid two-column">
                    <label>
                      Name
                      <input
                        value={ui.name}
                        onChange={(event) => patchUi(ui.id, { name: event.target.value })}
                      />
                    </label>
                    <label>
                      Role
                      <select
                        value={ui.role}
                        onChange={(event) => patchUiRole(ui.id, event.target.value as UiDraft['role'])}
                      >
                        {Object.entries(uiRolePresets).map(([value, preset]) => (
                          <option value={value} key={value}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Runtime
                      <select
                        value={ui.runtime}
                        onChange={(event) =>
                          patchUi(ui.id, { runtime: event.target.value as UiDraft['runtime'] })
                        }
                      >
                        <option value="vite-vanilla">Vanilla TypeScript + Vite</option>
                        <option value="nextjs">Next.js</option>
                      </select>
                    </label>
                    <label>
                      Deployment
                      <select
                        value={ui.deployment}
                        onChange={(event) =>
                          patchUi(ui.id, {
                            deployment: event.target.value as UiDraft['deployment'],
                          })
                        }
                      >
                        <option value="cloudflare">Cloudflare</option>
                        <option value="vercel">Vercel</option>
                        <option value="render">Render</option>
                        <option value="vps">VPS</option>
                        <option value="local-only">Local only</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Description
                    <textarea
                      rows={3}
                      value={ui.description}
                      onChange={(event) => patchUi(ui.id, { description: event.target.value })}
                    />
                  </label>
                </article>
              ))}
            </div>
            <div className="section-toolbar spaced">
              <h2>Services</h2>
              <button
                className="secondary-action"
                onClick={() => {
                  const id = nextId('service', ids);
                  onChange({
                    ...draft,
                    services: [
                      ...draft.services,
                      {
                        id,
                        name: serviceNamePreset,
                        runtime: 'cloudflare-workers',
                        deployment: 'cloudflare',
                        description: serviceRuntimePresets['cloudflare-workers'].description,
                      },
                    ],
                  });
                }}
              >
                + Add service
              </button>
            </div>
            <div className="card-stack">
              {draft.services.length === 0 && (
                <EmptyState>
                  Static interface-only architectures can leave services empty.
                </EmptyState>
              )}
              {draft.services.map((service) => (
                <article className="editor-card" key={service.id}>
                  <div className="card-header">
                    <span className="type-pill service">Service · {service.id}</span>
                    <button className="danger-link" onClick={() => removeComponent(service.id)}>
                      Remove
                    </button>
                  </div>
                  <div className="form-grid two-column">
                    <label>
                      Name
                      <input
                        value={service.name}
                        onChange={(event) => patchService(service.id, { name: event.target.value })}
                      />
                    </label>
                    <label>
                      Runtime
                      <select
                        value={service.runtime}
                        onChange={(event) => {
                          const runtime = event.target.value as 'express' | 'cloudflare-workers';
                          patchService(service.id, {
                            runtime,
                            ...(untouchedServiceDescription(service.description)
                              ? { description: serviceRuntimePresets[runtime].description }
                              : {}),
                            deployment: runtime === 'express' ? 'render' : 'cloudflare',
                          });
                        }}
                      >
                        {Object.entries(serviceRuntimePresets).map(([value, preset]) => (
                          <option value={value} key={value}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Deployment
                      <select
                        value={service.deployment}
                        onChange={(event) =>
                          patchService(service.id, {
                            deployment: event.target.value as ServiceDraft['deployment'],
                          })
                        }
                      >
                        {service.runtime === 'cloudflare-workers' ? (
                          <>
                            <option value="cloudflare">Cloudflare</option>
                            <option value="local-only">Local only</option>
                          </>
                        ) : (
                          <>
                            <option value="render">Render</option>
                            <option value="vps">VPS</option>
                            <option value="local-only">Local only</option>
                          </>
                        )}
                      </select>
                    </label>
                  </div>
                  <label>
                    Description
                    <textarea
                      rows={3}
                      value={service.description}
                      onChange={(event) =>
                        patchService(service.id, { description: event.target.value })
                      }
                    />
                  </label>
                </article>
              ))}
            </div>
          </EditorSection>
        )}

        {section === 'connections' && (
          <EditorSection
            eyebrow="Connections"
            title="Show how components communicate"
            description="Toggle component calls and any real-time transports the system needs."
          >
            <div className="connection-list">
              {draft.uis.map((ui) => (
                <article className="connection-row" key={ui.id}>
                  <div>
                    <span className="type-pill">UI</span>
                    <h2>{ui.name}</h2>
                    <p>{ui.description}</p>
                  </div>
                  <CheckboxGroup
                    label="Calls these services"
                    options={draft.services.map((item) => ({ id: item.id, label: item.name }))}
                    values={draft.uiServices.find((item) => item.uiId === ui.id)?.serviceIds ?? []}
                    onChange={(serviceIds) =>
                      onChange({
                        ...draft,
                        uiServices: [
                          ...draft.uiServices.filter((item) => item.uiId !== ui.id),
                          { uiId: ui.id, serviceIds },
                        ],
                      })
                    }
                  />
                </article>
              ))}
              {draft.services.map((service) => (
                <article className="connection-row" key={service.id}>
                  <div>
                    <span className="type-pill service">Service</span>
                    <h2>{service.name}</h2>
                    <p>{service.description}</p>
                  </div>
                  <CheckboxGroup
                    label="Calls these services"
                    options={draft.services
                      .filter((item) => item.id !== service.id)
                      .map((item) => ({ id: item.id, label: item.name }))}
                    values={
                      draft.serviceDependencies.find((item) => item.serviceId === service.id)
                        ?.dependencyIds ?? []
                    }
                    onChange={(dependencyIds) =>
                      onChange({
                        ...draft,
                        serviceDependencies: [
                          ...draft.serviceDependencies.filter(
                            (item) => item.serviceId !== service.id,
                          ),
                          { serviceId: service.id, dependencyIds },
                        ],
                      })
                    }
                  />
                </article>
              ))}
              {components.length === 0 && (
                <EmptyState>Add components before mapping connections.</EmptyState>
              )}
            </div>
            <article className="editor-card capability-card">
              <div>
                <span className="type-pill resource">Capability</span>
                <h2>Real-time communication</h2>
                <p>Select the transports the services must support.</p>
              </div>
              <CheckboxGroup
                label="Transports"
                options={[
                  { id: 'sse', label: 'Server-Sent Events' },
                  ...(draft.services.some((service) => service.runtime === 'express')
                    ? [{ id: 'websocket', label: 'WebSockets' }]
                    : []),
                ]}
                values={draft.realtimeModes}
                onChange={(values) =>
                  onChange({
                    ...draft,
                    realtimeModes: values as ArchitectureDraft['realtimeModes'],
                  })
                }
              />
            </article>
          </EditorSection>
        )}

        {section === 'resources' && (
          <EditorSection
            eyebrow="Resources"
            title="Assign shared infrastructure"
            description="The current schema supports one database, cache, and object store. Choose their owners and consumers."
          >
            {components.length === 0 ? (
              <EmptyState>Add a component before configuring resources.</EmptyState>
            ) : (
              <div className="card-stack">
                <ResourceEditor
                  title="Database"
                  enabled={Boolean(draft.database)}
                  onToggle={() => {
                    if (draft.database) {
                      const { database: _database, ...rest } = draft;
                      onChange(rest);
                    } else
                      onChange({
                        ...draft,
                        database: {
                          type: 'postgresql',
                          provider: 'supabase',
                          dataAccess: 'drizzle',
                          users: { ownerComponentId: ids[0]!, consumerComponentIds: ids },
                        },
                      });
                  }}
                >
                  {draft.database && (
                    <>
                      <div className="form-grid three-column">
                        <label>
                          Database
                          <select
                            value={draft.database.type}
                            onChange={(event) => {
                              const type = event.target.value as NonNullable<
                                ArchitectureDraft['database']
                              >['type'];
                              const compatible =
                                type === 'postgresql'
                                  ? {
                                      provider: 'supabase' as const,
                                      dataAccess: 'drizzle' as const,
                                    }
                                  : type === 'mongodb'
                                    ? {
                                        provider: 'mongodb-atlas' as const,
                                        dataAccess: 'native-driver' as const,
                                      }
                                    : {
                                        provider: 'cloudflare' as const,
                                        dataAccess: 'drizzle' as const,
                                      };
                              onChange({
                                ...draft,
                                database: { ...draft.database!, type, ...compatible },
                              });
                            }}
                          >
                            <option value="postgresql">PostgreSQL</option>
                            <option value="mongodb">MongoDB</option>
                            <option value="cloudflare-d1">Cloudflare D1</option>
                          </select>
                        </label>
                        <label>
                          Provider
                          <select
                            value={draft.database.provider}
                            onChange={(event) =>
                              onChange({
                                ...draft,
                                database: {
                                  ...draft.database!,
                                  provider: event.target.value as NonNullable<
                                    ArchitectureDraft['database']
                                  >['provider'],
                                },
                              })
                            }
                          >
                            {draft.database.type === 'postgresql' ? (
                              <>
                                <option value="supabase">Supabase</option>
                                <option value="neon">Neon</option>
                              </>
                            ) : draft.database.type === 'mongodb' ? (
                              <option value="mongodb-atlas">MongoDB Atlas</option>
                            ) : (
                              <option value="cloudflare">Cloudflare</option>
                            )}
                          </select>
                        </label>
                        <label>
                          Data access
                          <select
                            value={draft.database.dataAccess}
                            onChange={(event) =>
                              onChange({
                                ...draft,
                                database: {
                                  ...draft.database!,
                                  dataAccess: event.target.value as NonNullable<
                                    ArchitectureDraft['database']
                                  >['dataAccess'],
                                },
                              })
                            }
                          >
                            {draft.database.type === 'postgresql' ? (
                              <>
                                <option value="drizzle">Drizzle</option>
                                <option value="prisma">Prisma</option>
                              </>
                            ) : draft.database.type === 'mongodb' ? (
                              <>
                                <option value="native-driver">Native driver</option>
                                <option value="prisma">Prisma</option>
                              </>
                            ) : (
                              <>
                                <option value="drizzle">Drizzle</option>
                                <option value="native-driver">D1 binding API</option>
                              </>
                            )}
                          </select>
                        </label>
                      </div>
                      <ResourceUsers
                        components={components}
                        users={draft.database.users}
                        onChange={(users) =>
                          onChange({ ...draft, database: { ...draft.database!, users } })
                        }
                      />
                    </>
                  )}
                </ResourceEditor>
                <ResourceEditor
                  title="Application cache"
                  enabled={Boolean(draft.cache)}
                  onToggle={() => {
                    if (draft.cache) {
                      const { cache: _cache, ...rest } = draft;
                      onChange(rest);
                    } else
                      onChange({
                        ...draft,
                        cache: {
                          provider: 'upstash',
                          users: { ownerComponentId: ids[0]!, consumerComponentIds: ids },
                        },
                      });
                  }}
                >
                  {draft.cache && (
                    <>
                      <label>
                        Provider
                        <select
                          value={draft.cache.provider}
                          onChange={(event) =>
                            onChange({
                              ...draft,
                              cache: {
                                ...draft.cache!,
                                provider: event.target.value as NonNullable<
                                  ArchitectureDraft['cache']
                                >['provider'],
                              },
                            })
                          }
                        >
                          <option value="upstash">Upstash Redis</option>
                          <option value="cloudflare">Cloudflare Cache / KV</option>
                        </select>
                      </label>
                      <ResourceUsers
                        components={components}
                        users={draft.cache.users}
                        onChange={(users) =>
                          onChange({ ...draft, cache: { ...draft.cache!, users } })
                        }
                      />
                    </>
                  )}
                </ResourceEditor>
                <ResourceEditor
                  title="Distributed rate limiting"
                  enabled={Boolean(draft.rateLimit)}
                  onToggle={() => {
                    if (draft.rateLimit) {
                      const { rateLimit: _rateLimit, ...rest } = draft;
                      onChange(rest);
                    } else
                      onChange({
                        ...draft,
                        rateLimit: {
                          provider: 'upstash',
                          users: { ownerComponentId: ids[0]!, consumerComponentIds: ids },
                        },
                      });
                  }}
                >
                  {draft.rateLimit && (
                    <>
                      <label>
                        Provider
                        <select
                          value={draft.rateLimit.provider}
                          onChange={(event) =>
                            onChange({
                              ...draft,
                              rateLimit: {
                                ...draft.rateLimit!,
                                provider: event.target.value as NonNullable<
                                  ArchitectureDraft['rateLimit']
                                >['provider'],
                              },
                            })
                          }
                        >
                          <option value="upstash">Upstash Ratelimit</option>
                          <option value="cloudflare">Cloudflare Workers Rate Limiting</option>
                        </select>
                      </label>
                      <ResourceUsers
                        components={components}
                        users={draft.rateLimit.users}
                        onChange={(users) =>
                          onChange({ ...draft, rateLimit: { ...draft.rateLimit!, users } })
                        }
                      />
                    </>
                  )}
                </ResourceEditor>
                <ResourceEditor
                  title="Message queue and background jobs"
                  enabled={Boolean(draft.queue)}
                  onToggle={() => {
                    if (draft.queue) {
                      const { queue: _queue, ...rest } = draft;
                      onChange(rest);
                    } else
                      onChange({
                        ...draft,
                        queue: {
                          provider: 'upstash',
                          users: { ownerComponentId: ids[0]!, consumerComponentIds: ids },
                        },
                      });
                  }}
                >
                  {draft.queue && (
                    <>
                      <label>
                        Provider
                        <select
                          value={draft.queue.provider}
                          onChange={(event) =>
                            onChange({
                              ...draft,
                              queue: {
                                ...draft.queue!,
                                provider: event.target.value as NonNullable<
                                  ArchitectureDraft['queue']
                                >['provider'],
                              },
                            })
                          }
                        >
                          <option value="upstash">Upstash QStash</option>
                          <option value="cloudflare">Cloudflare Queues</option>
                        </select>
                      </label>
                      <ResourceUsers
                        components={components}
                        users={draft.queue.users}
                        onChange={(users) =>
                          onChange({ ...draft, queue: { ...draft.queue!, users } })
                        }
                      />
                    </>
                  )}
                </ResourceEditor>
                <ResourceEditor
                  title="Object storage"
                  enabled={Boolean(draft.fileStorage)}
                  onToggle={() => {
                    if (draft.fileStorage) {
                      const { fileStorage: _fileStorage, ...rest } = draft;
                      onChange(rest);
                    } else
                      onChange({
                        ...draft,
                        fileStorage: {
                          provider: 'cloudflare-r2',
                          users: { ownerComponentId: ids[0]!, consumerComponentIds: ids },
                        },
                      });
                  }}
                >
                  {draft.fileStorage && (
                    <>
                      <label>
                        Provider
                        <select
                          value={draft.fileStorage.provider}
                          onChange={(event) =>
                            onChange({
                              ...draft,
                              fileStorage: {
                                ...draft.fileStorage!,
                                provider: event.target.value as NonNullable<
                                  ArchitectureDraft['fileStorage']
                                >['provider'],
                              },
                            })
                          }
                        >
                          <option value="cloudflare-r2">Cloudflare R2</option>
                          <option value="supabase-storage">Supabase Storage</option>
                        </select>
                      </label>
                      <ResourceUsers
                        components={components}
                        users={draft.fileStorage.users}
                        onChange={(users) =>
                          onChange({ ...draft, fileStorage: { ...draft.fileStorage!, users } })
                        }
                      />
                    </>
                  )}
                </ResourceEditor>
                {draft.services.some((service) => service.runtime === 'cloudflare-workers') && (
                  <article className="editor-card">
                    <div>
                      <span className="type-pill resource">Capability</span>
                      <h2>Periodic scheduled execution</h2>
                      <p>Cloudflare Workers Cron Triggers run code on a schedule.</p>
                    </div>
                    <label>
                      <input
                        type="checkbox"
                        checked={draft.scheduledJobs}
                        onChange={(event) =>
                          onChange({ ...draft, scheduledJobs: event.target.checked })
                        }
                      />{' '}
                      Enable Cron Triggers
                    </label>
                  </article>
                )}
              </div>
            )}
          </EditorSection>
        )}

        {section === 'workflow' && (
          <EditorSection
            eyebrow="Agent workflow"
            title="Set access and execution guidance"
            description="Authentication becomes a product capability; agent mode controls how the receiving coding agent works."
          >
            <article className="editor-card auth-card">
              <div>
                <span className="type-pill resource">Access</span>
                <h2>Authentication</h2>
              </div>
              <label>
                Service
                <select
                  value={draft.authService}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      authService: event.target.value as ArchitectureDraft['authService'],
                      loginMethods: [],
                    })
                  }
                >
                  <option value="none">No authentication</option>
                  <option value="supabase-auth">Supabase Auth</option>
                  <option value="authjs">Auth.js</option>
                  <option value="privy">Privy</option>
                </select>
              </label>
              {draft.authService !== 'none' && (
                <CheckboxGroup
                  label="Login methods"
                  options={[
                    { id: 'github', label: 'GitHub' },
                    ...(draft.authService === 'supabase-auth'
                      ? [{ id: 'email-password', label: 'Email and password' }]
                      : []),
                    { id: 'magic-link', label: 'Magic link' },
                    ...(draft.authService === 'privy'
                      ? [{ id: 'wallet', label: 'Crypto wallet' }]
                      : []),
                  ]}
                  values={draft.loginMethods}
                  onChange={(values) =>
                    onChange({
                      ...draft,
                      loginMethods: values as ArchitectureDraft['loginMethods'],
                    })
                  }
                />
              )}
            </article>
            <h2 className="subsection-title">Coding agent mode</h2>
            <div className="mode-grid">
              {(
                [
                  [
                    'plan-only',
                    'Plan only',
                    'Analyze and produce an implementation plan without changing code.',
                  ],
                  [
                    'plan-then-build',
                    'Plan, then build',
                    'Plan, implement, and verify the finished system.',
                  ],
                  [
                    'direct-build',
                    'Build directly',
                    'Begin immediately and ask only when blocked.',
                  ],
                ] as const
              ).map(([value, label, description]) => (
                <label
                  className={draft.agentMode === value ? 'mode-card selected' : 'mode-card'}
                  key={value}
                >
                  <input
                    type="radio"
                    name="agent-mode"
                    checked={draft.agentMode === value}
                    onChange={() => onChange({ ...draft, agentMode: value })}
                  />
                  <strong>{label}</strong>
                  <span>{description}</span>
                </label>
              ))}
            </div>
          </EditorSection>
        )}

        {section === 'review' && (
          <EditorSection
            eyebrow="Review"
            title="Ready to generate"
            description="SystemSextant validates the graph before producing byte-stable YAML and prompt artifacts."
          >
            {error && (
              <div className="message error" role="alert">
                {error}
              </div>
            )}
            <div className="review-grid">
              <ReviewStat value={draft.uis.length} label="Interfaces" />
              <ReviewStat value={draft.services.length} label="Services" />
              <ReviewStat
                value={
                  draft.uiServices.reduce((sum, item) => sum + item.serviceIds.length, 0) +
                  draft.serviceDependencies.reduce(
                    (sum, item) => sum + item.dependencyIds.length,
                    0,
                  )
                }
                label="Connections"
              />
              <ReviewStat
                value={
                  [
                    draft.database,
                    draft.cache,
                    draft.rateLimit,
                    draft.queue,
                    draft.fileStorage,
                  ].filter(Boolean).length
                }
                label="Resources"
              />
            </div>
            <article className="review-summary">
              <h2>{draft.projectName || 'Untitled architecture'}</h2>
              <p>{draft.productSummary || 'No product summary yet.'}</p>
              <dl>
                <div>
                  <dt>Agent workflow</dt>
                  <dd>{draft.agentMode}</dd>
                </div>
                <div>
                  <dt>Authentication</dt>
                  <dd>{draft.authService}</dd>
                </div>
                <div>
                  <dt>Real-time</dt>
                  <dd>{draft.realtimeModes.join(', ') || 'None'}</dd>
                </div>
              </dl>
            </article>
          </EditorSection>
        )}
        <nav className="step-navigation" aria-label="Architecture step navigation">
          <div>
            <span>
              Step {sectionIndex + 1} of {sections.length}
            </span>
            <strong>{sections[sectionIndex]?.label}</strong>
          </div>
          <div className="step-actions">
            <button
              className="secondary-action"
              onClick={() => (sectionIndex === 0 ? onExit() : navigateTo(sectionIndex - 1))}
            >
              ← {sectionIndex === 0 ? 'Home' : sections[sectionIndex - 1]?.label}
            </button>
            <button
              className="primary-action compact"
              onClick={() =>
                sectionIndex === sections.length - 1 ? generate() : navigateTo(sectionIndex + 1)
              }
            >
              {sectionIndex === sections.length - 1
                ? 'Generate artifacts'
                : sections[sectionIndex + 1]?.label}{' '}
              →
            </button>
          </div>
        </nav>
      </div>
    </section>
  );
}

function ResourceEditor({
  title,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <article
      className={enabled ? 'editor-card resource-card enabled' : 'editor-card resource-card'}
    >
      <div className="card-header">
        <div>
          <span className="type-pill resource">Resource</span>
          <h2>{title}</h2>
        </div>
        <button className={enabled ? 'danger-link' : 'secondary-action'} onClick={onToggle}>
          {enabled ? 'Remove' : '+ Add'}
        </button>
      </div>
      {children}
    </article>
  );
}
function ResourceUsers({
  components,
  users,
  onChange,
}: {
  components: readonly { id: string; label: string }[];
  users: { ownerComponentId: string; consumerComponentIds: string[] };
  onChange: (users: { ownerComponentId: string; consumerComponentIds: string[] }) => void;
}) {
  return (
    <div className="resource-users">
      <label>
        Owner
        <select
          value={users.ownerComponentId}
          onChange={(event) => onChange({ ...users, ownerComponentId: event.target.value })}
        >
          {components.map((item) => (
            <option value={item.id} key={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <CheckboxGroup
        label="Consumers"
        options={components}
        values={users.consumerComponentIds}
        onChange={(consumerComponentIds) => onChange({ ...users, consumerComponentIds })}
      />
    </div>
  );
}
function ReviewStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="review-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
