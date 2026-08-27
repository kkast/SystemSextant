# Features

This is the single tracker for implemented and potential SystemSextant features.

- `[x]` Implemented and verified
- `[-]` In progress
- `[ ]` Planned or potential

## Local CLI

- [x] Launch the interactive experience with bare `systemsextant`.
- [x] Start a new session or browse saved sessions from the home screen.
- [x] Ask deterministic product and architecture questions with conditional follow-ups.
- [x] Support Next.js, Next.js with Express, TypeScript CLI, and custom TypeScript starters.
- [x] Add database, authentication, real-time, background-job, and file-storage capabilities.
- [x] Ask about caching, distributed rate limiting, and reliable message-delivery challenges before selecting infrastructure.
- [x] Offer Upstash or provider-neutral handling for applicable challenges.
- [x] Review and edit answers before generating artifacts.
- [x] View generated artifacts before saving a session.
- [x] Work locally without an account, model call, telemetry, or runtime network access.

## Configuration and prompting

- [x] Normalize answers into a versioned `ProjectConfigV1` component graph.
- [x] Validate stable IDs, ownership, connections, and confirmed decisions with Zod.
- [x] Generate byte-identical `project.yaml` and `AGENT_PROMPT.md` for identical input.
- [x] Keep user product text inside an escaped prompt data boundary.
- [x] Add guidance only for selected capabilities.
- [x] Compile prompts from stable independently selected blocks with recorded block IDs.
- [x] Map Upstash caching to Redis, rate limiting to Ratelimit, and background delivery to QStash in separate tool blocks.
- [x] Keep existing prompts byte-identical when an unrelated unselected tool block is registered.
- [x] Support plan-only, plan-then-build, and direct-build agent workflows.
- [x] Require the target coding agent to create and maintain `SYSTEM_ARCHITECTURE.md` and link it from target-project `AGENTS.md` when present.

## Local sessions and artifacts

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

- [ ] Save a completed configuration as a reusable local template.
- [ ] List, load, clone, edit, rename, export, import, and delete templates.
- [ ] Detect structurally similar templates.
- [ ] Add richer component, resource, connection, and contract editing.
- [ ] Import an existing `project.yaml` and recover draft sessions.

## Later: browser and delivery

- [ ] Build a local or hosted browser interface over the same `core` package.
- [ ] Add browser-local and server-backed session adapters while keeping schemas compatible.
- [ ] Capture deployment targets, runtime constraints, lifecycle commands, and optional container artifacts.
- [ ] Preview and explicitly export requested scaffolding or automation files without executing them.
- [ ] Add authentication only when remote storage or shared workspaces require it.

## Potential

- [ ] Optional Git-based session and template synchronization.
- [ ] AI-assisted architecture design, interview, and critique modes with explicit acceptance of changes.
- [ ] Stable JSON commands and agent-readable schema documentation.
- [ ] Optional MCP integration if JSON commands do not cover real integration needs.
- [ ] Architecture diagrams, community templates, organization policies, cost comparisons, and repository import.
