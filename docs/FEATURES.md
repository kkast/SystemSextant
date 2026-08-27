# Features

This is the single tracker for implemented and potential SystemSextant features.

- `[x]` Implemented and verified
- `[-]` In progress
- `[ ]` Planned or potential

## Local CLI

- [x] Launch the interactive experience with bare `systemsextant`.
- [x] Start a new session or browse saved sessions from the home screen.
- [x] Define multiple named UIs and services with role-based default names, optional descriptions, and deployments in a linear question-by-question flow.
- [x] Support admin, business-client, user-client, landing-page, and custom UI roles.
- [x] Generate directly from answer review with the `G` quick action.
- [x] Browse a concise catalog of all selectable stacks, providers, and infrastructure tools from the home screen.
- [x] Ask deterministic product and architecture questions with conditional follow-ups.
- [x] Replace bundled architecture starters with an independent frontend choice: vanilla TypeScript with Create Vite, Next.js, or no frontend.
- [x] Add an independent backend choice: Next.js server features, Express, Cloudflare Workers, or no backend. Express and Cloudflare Workers are alternatives within the same question.
- [x] Select Server-Sent Events and WebSockets independently, including both together for Express.
- [x] Explain the deployment fit of frontend and backend choices, then capture compatible Vercel, Render, Cloudflare, VPS, or local-only targets per independently deployed component.
- [x] Select a database and provider, then filter ORM and direct data-access choices by database compatibility.
- [x] Select no file storage, Supabase Storage, or Cloudflare R2.
- [x] Select application caching, distributed rate limiting, and reliable background delivery or queues as independent infrastructure needs.
- [x] Map selected infrastructure challenges to Upstash.
- [x] When Cloudflare Workers is the backend, let each selected infrastructure need use either its Cloudflare-native service or Upstash.
- [x] Add Cloudflare Cache/KV, Workers Rate Limiting, and Cloudflare Queues as independent tool mappings and prompt blocks.
- [x] Select an authentication service, then offer only its compatible login methods.
- [x] Review and edit answers before generating artifacts.
- [x] Review generated artifacts after automatic session persistence.
- [x] Copy the complete prompt or YAML directly from generated-artifact preview.
- [x] Work locally without an account, model call, telemetry, or runtime network access.

## Configuration and prompting

- [x] Normalize answers into a versioned `ProjectConfigV1` component graph.
- [x] Validate stable IDs, ownership, connections, and confirmed decisions with Zod.
- [x] Generate byte-identical `project.yaml` and `AGENT_PROMPT.md` for identical input.
- [x] Keep every configuration value inside escaped JSON prompt-data boundaries that cannot override compiler instructions.
- [x] Put a mandatory security baseline and negative-path security verification ahead of engineering and capability guidance.
- [x] Add pnpm workspace guidance only for multi-component architectures.
- [x] Keep vanilla Vite lightweight and require shadcn/ui with Tailwind CSS only for selected Next.js frontends.
- [x] Add guidance only for selected capabilities.
- [x] Compile prompts from stable independently selected blocks with recorded block IDs.
- [x] Map Upstash caching to Redis, rate limiting to Ratelimit, and background delivery to QStash in separate tool blocks.
- [x] Keep existing prompts byte-identical when an unrelated unselected tool block is registered.
- [x] Support plan-only, plan-then-build, and direct-build agent workflows.
- [x] Require the target coding agent to create and maintain `SYSTEM_ARCHITECTURE.md` and link it from target-project `AGENTS.md` when present.

## Local sessions and artifacts

- [x] Save each unique generated configuration as a local session automatically.
- [x] Store completed sessions in the platform application-data directory.
- [x] Persist `session.yaml`, `project.yaml`, and `AGENT_PROMPT.md` atomically.
- [x] Verify stored artifact hashes when loading a session.
- [x] List saved sessions newest first and reopen them.
- [x] View, copy, and explicitly export prompt or YAML artifacts.
- [x] Protect exports from accidental overwrite and commit paired exports together.
- [x] Delete a saved session only after confirmation.
- [x] Sanitize terminal text and avoid implicit writes to the current project.

## Release readiness

- [x] Use a strict pnpm TypeScript workspace with a platform-neutral core and bundled CLI entry point.
- [x] Cover core behavior, prompt snapshots, filesystem persistence, export safety, sanitization, and basic Ink navigation with tests.
- [ ] Verify the packed package and clean local installation on every supported platform.
- [ ] Verify published `pnpm dlx systemsextant` and `npx systemsextant` execution before documenting them as current usage.
- [ ] Add schema migrations before a public schema change requires them.

## Next: reusable templates

- [x] Save a completed configuration as a reusable local template and reopen a V2 template as an editable architecture.
- [x] Require a custom template name and prevent duplicate templates for the same configuration.
- [x] List, load, and delete local templates with atomic writes and integrity verification.
- [ ] Clone, rename, export, and import templates.
- [ ] Detect structurally similar templates.
- [ ] Add richer component, resource, connection, and contract editing.
- [ ] Import an existing `project.yaml` and recover draft sessions.

## Later: browser and delivery

- [ ] Build a local or hosted browser interface over the same `core` package.
- [ ] Add browser-local and server-backed session adapters while keeping schemas compatible.
- [ ] Capture detailed runtime constraints, lifecycle commands, and optional container artifacts.
- [ ] Preview and explicitly export requested scaffolding or automation files without executing them.
- [ ] Add authentication only when remote storage or shared workspaces require it.

## Potential

- [ ] Add Google Cloud Firestore as a selectable document database and Google Cloud as a database provider.
- [ ] Add AWS DynamoDB as a selectable key-value/document database.
- [ ] Add Cloudflare Workers KV as a selectable key-value database for Workers projects.
- [ ] Bundle a concise, offline system-design knowledge base that helps coding agents make architecture decisions, with compact structured guidance suitable for less capable models.
- [ ] Optional Git-based session and template synchronization.
- [ ] AI-assisted architecture design, interview, and critique modes with explicit acceptance of changes.
- [ ] Stable JSON commands and agent-readable schema documentation.
- [ ] Optional MCP integration if JSON commands do not cover real integration needs.
- [ ] Architecture diagrams, community templates, organization policies, cost comparisons, and repository import.
