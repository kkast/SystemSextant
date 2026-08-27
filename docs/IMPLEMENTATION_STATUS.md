# Implementation Status

This file tracks overall implementation progress. Detailed subtasks are handled during implementation and are not maintained here.

## Status

- `[ ]` Not started
- `[-]` In progress
- `[x]` Implemented and verified
- `[!]` Blocked

## Current MVP

Build the local, deterministic `systemsextant` experience. The bare command creates new architecture sessions or opens past sessions, with no runtime network access or implicit writes to the current project.

- [ ] Set up the pnpm TypeScript workspace, portable core package, and publishable CLI.
- [ ] Define the versioned project and session schemas, questionnaire engine, and validation.
- [ ] Generate deterministic `project.yaml` and `AGENT_PROMPT.md` artifacts.
- [ ] Build the Ink new-session questionnaire, answer editing, and artifact review.
- [ ] Persist completed sessions atomically in the platform application-data directory.
- [ ] Add past-session navigation with prompt and YAML view, copy, export, and delete actions.
- [ ] Add security, adapter-contract, integration, and packaged-CLI verification.
- [x] Align documentation with the bare command, persistent sessions, and reusable-core architecture.

## Deferred

- Draft recovery and editing completed sessions.
- Reusable templates and configuration import.
- AI-assisted design, interview, and critique modes.
- GitHub or remote synchronization.
- Local or deployed web UI implementation.
- Scaffolding and deployment.

