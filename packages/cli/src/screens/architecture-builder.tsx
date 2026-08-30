import { Text } from 'ink';
import { useMemo, useState } from 'react';
import { createArchitectureDraft, normalizeArchitectureDraft, type ArchitectureDraft, type ProjectConfigV2, type ServiceDraft, type UiDraft } from '@systemsextant/core';
import { sanitizeTerminalText } from '../adapters/sanitize.js';
import { Frame } from '../ui/frame.js';
import { Menu, type MenuOption } from '../ui/menu.js';
import { MultiSelect } from '../ui/multi-select.js';
import { TextEntry } from '../ui/text-entry.js';

interface WizardState {
  readonly draft: ArchitectureDraft;
  readonly uiCount?: number;
  readonly serviceCount?: number;
  readonly databaseChoice?: 'none' | 'postgresql' | 'mongodb' | 'cloudflare-d1';
  readonly fileStorageChoice?: 'none' | 'supabase-storage' | 'cloudflare-r2';
  readonly infrastructure?: readonly ('caching' | 'rate-limiting' | 'background-jobs')[];
}
interface Question {
  readonly id: string;
  readonly kind: 'text' | 'single' | 'multi';
  readonly label: string;
  readonly help?: string;
  readonly placeholder?: string;
  readonly options?: readonly MenuOption<string>[];
  readonly value: string | readonly string[];
  readonly optional?: boolean;
  apply(state: WizardState, value: string | string[]): WizardState;
}

const countOptions: readonly MenuOption<string>[] = [0, 1, 2, 3, 4, 5].map((count) => ({ value: String(count), label: String(count) }));
const roleOptions: readonly MenuOption<string>[] = [
  { value: 'admin', label: 'Admin portal', description: 'Internal operations, support, and management.' },
  { value: 'business-client', label: 'Business client', description: 'Workspace for business customers and their teams.' },
  { value: 'user-client', label: 'User client', description: 'Primary product experience for end users.' },
  { value: 'landing-page', label: 'Landing page', description: 'Public marketing and conversion surface.' },
  { value: 'custom', label: 'Custom UI', description: 'A UI with a purpose described by you.' },
];

function resourceUsers(draft: ArchitectureDraft) {
  const componentIds = (draft.services.length ? draft.services : draft.uis).map(({ id }) => id);
  const ownerComponentId = componentIds[0];
  if (!ownerComponentId) throw new Error('Add at least one UI or service first.');
  return { ownerComponentId, consumerComponentIds: componentIds };
}
function resizeUis(uis: readonly UiDraft[], count: number): UiDraft[] {
  return Array.from({ length: count }, (_, index) => uis[index] ?? { id: `ui-${index + 1}`, name: 'Admin portal', description: '', role: 'admin', runtime: 'nextjs', deployment: 'vercel' });
}
function resizeServices(services: readonly ServiceDraft[], count: number): ServiceDraft[] {
  return Array.from({ length: count }, (_, index) => services[index] ?? { id: `service-${index + 1}`, name: `Service ${index + 1}`, description: '', runtime: 'express', deployment: 'render' });
}
function patchUi(state: WizardState, index: number, patch: Partial<UiDraft>): WizardState {
  return { ...state, draft: { ...state.draft, uis: state.draft.uis.map((ui, current) => current === index ? { ...ui, ...patch } : ui) } };
}
function patchService(state: WizardState, index: number, patch: Partial<ServiceDraft>): WizardState {
  const services = state.draft.services.map((service, current) => current === index ? { ...service, ...patch } : service);
  return {
    ...state,
    draft: {
      ...state.draft,
      services,
      scheduledJobs: state.draft.scheduledJobs && services.some(({ runtime }) => runtime === 'cloudflare-workers'),
    },
  };
}
function initialState(initialDraft?: ArchitectureDraft): WizardState {
  const draft = initialDraft ?? createArchitectureDraft();
  return { draft, ...(initialDraft ? {
    uiCount: draft.uis.length, serviceCount: draft.services.length,
    databaseChoice: draft.database?.type ?? 'none', fileStorageChoice: draft.fileStorage?.provider ?? 'none',
    infrastructure: [...(draft.cache ? ['caching' as const] : []), ...(draft.rateLimit ? ['rate-limiting' as const] : []), ...(draft.queue ? ['background-jobs' as const] : [])],
  } : {}) };
}

function questionsFor(state: WizardState): Question[] {
  const questions: Question[] = [
    { id: 'project-name', kind: 'text', label: 'Project name', placeholder: 'My project', value: state.draft.projectName, apply: (current, value) => ({ ...current, draft: { ...current.draft, projectName: String(value).trim() } }) },
    { id: 'product-summary', kind: 'text', label: 'What are you building? (optional)', placeholder: 'Describe the product, users, and primary outcome', value: state.draft.productSummary, optional: true, apply: (current, value) => ({ ...current, draft: { ...current.draft, productSummary: String(value).trim() } }) },
    { id: 'ui-count', kind: 'single', label: 'How many user interfaces does the product need?', help: 'Count separately deployed admin, business, user, and landing-page applications.', options: countOptions, value: state.uiCount === undefined ? '' : String(state.uiCount), apply: (current, value) => { const uiCount = Number(value); return { ...current, uiCount, draft: { ...current.draft, uis: resizeUis(current.draft.uis, uiCount) } }; } },
  ];
  for (let index = 0; index < (state.uiCount ?? 0); index += 1) {
    const ui = state.draft.uis[index]!;
    questions.push(
      { id: `ui-${index}-role`, kind: 'single', label: `UI ${index + 1}: purpose`, options: roleOptions, value: ui.role, apply: (current, value) => { const role = String(value) as UiDraft['role']; return patchUi(current, index, { role, name: roleOptions.find((option) => option.value === role)?.label ?? `UI ${index + 1}` }); } },
      { id: `ui-${index}-name`, kind: 'text', label: `UI ${index + 1}: name`, placeholder: roleOptions.find(({ value }) => value === ui.role)?.label ?? `UI ${index + 1}`, value: ui.name, apply: (current, value) => patchUi(current, index, { name: String(value).trim() }) },
      { id: `ui-${index}-description`, kind: 'text', label: `UI ${index + 1}: description (optional)`, placeholder: 'Who uses this UI, and what outcome does it own?', value: ui.description, optional: true, apply: (current, value) => patchUi(current, index, { description: String(value).trim() }) },
      { id: `ui-${index}-runtime`, kind: 'single', label: `UI ${index + 1}: technology`, options: [{ value: 'nextjs', label: 'Next.js' }, { value: 'vite-vanilla', label: 'Vanilla TypeScript with Create Vite' }], value: ui.runtime, apply: (current, value) => patchUi(current, index, { runtime: String(value) as UiDraft['runtime'], deployment: 'vercel' }) },
      { id: `ui-${index}-deployment`, kind: 'single', label: `UI ${index + 1}: deployment`, options: ['vercel', 'cloudflare', 'render', 'vps', 'local-only'].map((value) => ({ value, label: value })), value: ui.deployment, apply: (current, value) => patchUi(current, index, { deployment: String(value) as UiDraft['deployment'] }) },
    );
  }
  questions.push({ id: 'service-count', kind: 'single', label: 'How many backend services does the product need?', help: 'Each service gets its own name, description, runtime, and deployment.', options: state.uiCount === 0 ? countOptions.slice(1) : countOptions, value: state.serviceCount === undefined ? '' : String(state.serviceCount), apply: (current, value) => { const serviceCount = Number(value); const services = resizeServices(current.draft.services, serviceCount); return { ...current, serviceCount, draft: { ...current.draft, services, scheduledJobs: current.draft.scheduledJobs && services.some(({ runtime }) => runtime === 'cloudflare-workers') } }; } });
  const nextUis = state.draft.uis.filter(({ runtime }) => runtime === 'nextjs');
  for (let index = 0; index < (state.serviceCount ?? 0); index += 1) {
    const service = state.draft.services[index]!;
    const runtimeOptions: MenuOption<string>[] = [...(nextUis.length ? [{ value: 'nextjs', label: 'Next.js server features', description: 'Hosted with one selected Next.js UI.' }] : []), { value: 'express', label: 'Express server' }, { value: 'cloudflare-workers', label: 'Cloudflare Workers' }];
    questions.push(
      { id: `service-${index}-name`, kind: 'text', label: `Service ${index + 1}: name`, placeholder: `Service ${index + 1}`, value: service.name, apply: (current, value) => patchService(current, index, { name: String(value).trim() }) },
      { id: `service-${index}-description`, kind: 'text', label: `Service ${index + 1}: description (optional)`, placeholder: 'What business capability and operations does this service own?', value: service.description, optional: true, apply: (current, value) => patchService(current, index, { description: String(value).trim() }) },
      { id: `service-${index}-runtime`, kind: 'single', label: `Service ${index + 1}: technology`, options: runtimeOptions, value: service.runtime, apply: (current, value) => { const runtime = String(value) as ServiceDraft['runtime']; return patchService(current, index, runtime === 'nextjs' ? { runtime, hostUiId: nextUis[0]?.id, deployment: undefined } : { runtime, hostUiId: undefined, deployment: runtime === 'express' ? 'render' : 'cloudflare' }); } },
    );
    if (service.runtime === 'nextjs') questions.push({ id: `service-${index}-host`, kind: 'single', label: `Service ${index + 1}: host UI`, options: nextUis.map((ui) => ({ value: ui.id, label: ui.name || ui.id })), value: service.hostUiId ?? '', apply: (current, value) => patchService(current, index, { hostUiId: String(value), deployment: undefined }) });
    else { const deployments = service.runtime === 'cloudflare-workers' ? ['cloudflare', 'local-only'] : ['render', 'vps', 'local-only']; questions.push({ id: `service-${index}-deployment`, kind: 'single', label: `Service ${index + 1}: deployment`, options: deployments.map((value) => ({ value, label: value })), value: service.deployment ?? '', apply: (current, value) => patchService(current, index, { deployment: String(value) as ServiceDraft['deployment'] }) }); }
  }
  const hasServices = (state.serviceCount ?? 0) > 0;
  const hasExpress = state.draft.services.some(({ runtime }) => runtime === 'express');
  const hasCloudflare = state.draft.services.some(({ runtime }) => runtime === 'cloudflare-workers');
  if (hasCloudflare) questions.push({ id: 'scheduled-jobs', kind: 'single', label: 'Periodic scheduled execution', help: 'Run code on a schedule with Cloudflare Workers Cron Triggers.', options: [{ value: 'no', label: 'No scheduled execution' }, { value: 'yes', label: 'Cron Triggers', description: 'Scheduled handler in the Cloudflare Worker.' }], value: state.draft.scheduledJobs ? 'yes' : 'no', apply: (current, value) => ({ ...current, draft: { ...current.draft, scheduledJobs: String(value) === 'yes' } }) });
  if (hasServices) questions.push({ id: 'realtime', kind: 'multi', label: 'Real-time communication', help: 'Select any transports needed, or continue with none.', options: [{ value: 'sse', label: 'Server-Sent Events' }, ...(hasExpress ? [{ value: 'websocket', label: 'WebSockets' }] : [])], value: state.draft.realtimeModes, apply: (current, value) => ({ ...current, draft: { ...current.draft, realtimeModes: value as ArchitectureDraft['realtimeModes'] } }) });
  questions.push({ id: 'database', kind: 'single', label: 'Database', options: [{ value: 'none', label: 'No database' }, { value: 'postgresql', label: 'PostgreSQL' }, { value: 'mongodb', label: 'MongoDB / NoSQL' }, ...(hasCloudflare ? [{ value: 'cloudflare-d1', label: 'Cloudflare D1' }] : [])], value: state.databaseChoice ?? '', apply: (current, value) => {
    const databaseChoice = String(value) as NonNullable<WizardState['databaseChoice']>;
    if (databaseChoice === 'none') return { ...current, databaseChoice, draft: { ...current.draft, database: undefined } };
    const defaults = databaseChoice === 'postgresql' ? { provider: 'supabase' as const, dataAccess: 'drizzle' as const } : databaseChoice === 'mongodb' ? { provider: 'mongodb-atlas' as const, dataAccess: 'native-driver' as const } : { provider: 'cloudflare' as const, dataAccess: 'drizzle' as const };
    return { ...current, databaseChoice, draft: { ...current.draft, database: { type: databaseChoice!, ...defaults, users: resourceUsers(current.draft) } } };
  } });
  if (state.databaseChoice && state.databaseChoice !== 'none' && state.draft.database) {
    const providers = state.databaseChoice === 'postgresql' ? [{ value: 'supabase', label: 'Supabase PostgreSQL' }, { value: 'neon', label: 'Neon PostgreSQL' }, { value: 'local-docker', label: 'Local PostgreSQL in Docker' }] : state.databaseChoice === 'mongodb' ? [{ value: 'mongodb-atlas', label: 'MongoDB Atlas' }] : [{ value: 'cloudflare', label: 'Cloudflare D1' }];
    const access = state.databaseChoice === 'postgresql' ? [{ value: 'drizzle', label: 'Drizzle ORM' }, { value: 'prisma', label: 'Prisma ORM' }] : state.databaseChoice === 'mongodb' ? [{ value: 'native-driver', label: 'MongoDB driver' }, { value: 'prisma', label: 'Prisma ORM' }] : [{ value: 'drizzle', label: 'Drizzle ORM' }, { value: 'native-driver', label: 'D1 binding API' }];
    questions.push(
      { id: 'database-provider', kind: 'single', label: 'Database provider', options: providers, value: state.draft.database.provider, apply: (current, value) => ({ ...current, draft: { ...current.draft, database: { ...current.draft.database!, provider: String(value) as NonNullable<ArchitectureDraft['database']>['provider'] } } }) },
      { id: 'data-access', kind: 'single', label: 'Data access', options: access, value: state.draft.database.dataAccess, apply: (current, value) => ({ ...current, draft: { ...current.draft, database: { ...current.draft.database!, dataAccess: String(value) as NonNullable<ArchitectureDraft['database']>['dataAccess'] } } }) },
    );
  }
  questions.push({ id: 'file-storage', kind: 'single', label: 'File storage', options: [{ value: 'none', label: 'Not needed' }, { value: 'supabase-storage', label: 'Supabase Storage' }, ...(hasServices ? [{ value: 'cloudflare-r2', label: 'Cloudflare R2' }] : [])], value: state.fileStorageChoice ?? '', apply: (current, value) => { const fileStorageChoice = String(value) as NonNullable<WizardState['fileStorageChoice']>; return { ...current, fileStorageChoice, draft: { ...current.draft, fileStorage: fileStorageChoice === 'none' ? undefined : { provider: fileStorageChoice, users: resourceUsers(current.draft) } } }; } });
  if (hasServices) {
    questions.push({ id: 'infrastructure', kind: 'multi', label: 'Managed infrastructure needs', help: 'Choose each capability needed, or continue with none.', options: [{ value: 'caching', label: 'Cache' }, { value: 'rate-limiting', label: 'Distributed rate limiting' }, { value: 'background-jobs', label: 'Message queue / background jobs' }], value: state.infrastructure ?? [], apply: (current, value) => { const infrastructure = value as NonNullable<WizardState['infrastructure']>; const users = resourceUsers(current.draft); return { ...current, infrastructure, draft: { ...current.draft, cache: infrastructure.includes('caching') ? current.draft.cache ?? { provider: 'upstash', users } : undefined, rateLimit: infrastructure.includes('rate-limiting') ? current.draft.rateLimit ?? { provider: 'upstash', users } : undefined, queue: infrastructure.includes('background-jobs') ? current.draft.queue ?? { provider: 'upstash', users } : undefined } }; } });
    const providerOptions = [{ value: 'upstash', label: 'Upstash' }, ...(hasCloudflare ? [{ value: 'cloudflare', label: 'Cloudflare native' }] : [])];
    if (state.infrastructure?.includes('caching') && state.draft.cache) questions.push({ id: 'cache-provider', kind: 'single', label: 'Cache provider', options: providerOptions, value: state.draft.cache.provider, apply: (current, value) => ({ ...current, draft: { ...current.draft, cache: { ...current.draft.cache!, provider: String(value) as 'upstash' | 'cloudflare' } } }) });
    if (state.infrastructure?.includes('rate-limiting') && state.draft.rateLimit) questions.push({ id: 'rate-provider', kind: 'single', label: 'Rate-limiting provider', options: providerOptions, value: state.draft.rateLimit.provider, apply: (current, value) => ({ ...current, draft: { ...current.draft, rateLimit: { ...current.draft.rateLimit!, provider: String(value) as 'upstash' | 'cloudflare' } } }) });
    if (state.infrastructure?.includes('background-jobs') && state.draft.queue) questions.push({ id: 'queue-provider', kind: 'single', label: 'Queue provider', options: providerOptions, value: state.draft.queue.provider, apply: (current, value) => ({ ...current, draft: { ...current.draft, queue: { ...current.draft.queue!, provider: String(value) as 'upstash' | 'cloudflare' } } }) });
  }
  questions.push({ id: 'auth', kind: 'single', label: 'Authentication', options: [{ value: 'none', label: 'No authentication' }, { value: 'supabase-auth', label: 'Supabase Auth' }, { value: 'authjs', label: 'Auth.js' }, { value: 'privy', label: 'Privy' }], value: state.draft.authService, apply: (current, value) => ({ ...current, draft: { ...current.draft, authService: String(value) as ArchitectureDraft['authService'], loginMethods: [] } }) });
  if (state.draft.authService !== 'none') {
    const login: MenuOption<string>[] = [{ value: 'github', label: 'GitHub' }];
    if (state.draft.authService === 'supabase-auth') login.push({ value: 'email-password', label: 'Email and password' }, { value: 'magic-link', label: 'Email magic link' }); else if (state.draft.authService === 'authjs') login.push({ value: 'magic-link', label: 'Email magic link' }); else login.push({ value: 'magic-link', label: 'Email login' }, { value: 'wallet', label: 'Crypto wallet' });
    questions.push({ id: 'login-methods', kind: 'multi', label: 'Login methods', options: login, value: state.draft.loginMethods, apply: (current, value) => ({ ...current, draft: { ...current.draft, loginMethods: value as ArchitectureDraft['loginMethods'] } }) });
  }
  questions.push({ id: 'agent-mode', kind: 'single', label: 'How should the receiving coding agent work?', options: [{ value: 'plan-only', label: 'Plan only' }, { value: 'plan-then-build', label: 'Plan then build' }, { value: 'direct-build', label: 'Direct build' }], value: state.draft.agentMode, apply: (current, value) => ({ ...current, draft: { ...current.draft, agentMode: String(value) as ArchitectureDraft['agentMode'] } }) });
  return questions;
}

function formatValue(question: Question): string {
  if (Array.isArray(question.value)) return question.value.length ? question.value.map((value) => question.options?.find((option) => option.value === value)?.label ?? value).join(', ') : 'None';
  if (!question.value) return 'Not answered';
  return question.options?.find((option) => option.value === question.value)?.label ?? String(question.value);
}

export function ArchitectureBuilderScreen({ initialDraft, onGenerate, onCancel }: { readonly initialDraft?: ArchitectureDraft; readonly onGenerate: (config: ProjectConfigV2, draft: ArchitectureDraft) => void; readonly onCancel: () => void }) {
  const [state, setState] = useState(() => initialState(initialDraft));
  const [index, setIndex] = useState(0);
  const [review, setReview] = useState(Boolean(initialDraft));
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const questions = useMemo(() => questionsFor(state), [state]);
  const currentIndex = Math.min(index, Math.max(0, questions.length - 1));
  const question = questions[currentIndex];
  const generate = () => { try { onGenerate(normalizeArchitectureDraft(state.draft), state.draft); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  if (review) return <Frame title="Review answers" subtitle="Select an answer to edit it, or press G to generate." error={error}><Menu options={[...questions.map((item, questionIndex) => ({ value: `edit:${questionIndex}`, label: item.label, description: formatValue(item) })), { value: 'generate', label: 'Generate and review artifacts', shortcut: 'g' }, { value: 'cancel', label: 'Cancel session' }]} showDescriptions onSelect={(value) => { setError(undefined); if (value === 'generate') generate(); else if (value === 'cancel') onCancel(); else { setIndex(Number(value.slice('edit:'.length))); setEditing(true); setReview(false); } }} onCancel={onCancel} /></Frame>;
  if (!question) return null;
  const submit = (value: string | string[]) => { const next = question.apply(state, question.kind === 'text' ? sanitizeTerminalText(String(value)).trim() : value); setState(next); setError(undefined); if (editing) { setEditing(false); setReview(true); return; } const nextQuestions = questionsFor(next); if (currentIndex >= nextQuestions.length - 1) setReview(true); else setIndex(currentIndex + 1); };
  const back = () => { if (editing) { setEditing(false); setReview(true); } else if (currentIndex > 0) setIndex(currentIndex - 1); else onCancel(); };
  const validateText = (value: string) => { const clean = sanitizeTerminalText(value).trim(); if (!question.optional && !clean) return 'This answer is required.'; if (question.id === 'project-name' && clean.length > 100) return 'Use 100 characters or fewer.'; if ((question.id.includes('description') || question.id === 'product-summary') && clean.length > 2_000) return 'Use 2,000 characters or fewer.'; return undefined; };
  const multiOptions = (question.options ?? []).map(({ value, label, description }) => ({ value, label, ...(description ? { description } : {}) }));
  return <Frame title="New session" subtitle={`Question ${currentIndex + 1} of ${questions.length}`} error={error}><Text bold>{question.label}</Text>{question.help ? <Text dimColor>{question.help}</Text> : null}{question.kind === 'text' ? <TextEntry key={question.id} initialValue={String(question.value)} placeholder={question.placeholder} multilineHint={question.id.includes('description') || question.id === 'product-summary'} validate={validateText} onSubmit={submit} onCancel={back} /> : question.kind === 'multi' ? <MultiSelect key={question.id} options={multiOptions} initialValues={question.value as readonly string[]} minimumSelections={question.id === 'login-methods' ? 1 : 0} onSubmit={submit} onCancel={back} /> : <Menu key={question.id} options={question.options ?? []} onSelect={submit} onCancel={back} />}</Frame>;
}
