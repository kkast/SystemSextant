# High-Level Implementation Plan

## Product principles

- Configuration is the source of truth; the agent prompt is a derived artifact.
- Prompt and YAML generation are deterministic and testable.
- Starter architectures accelerate decisions but do not become permanent schema limits.
- Components compose through explicit contracts and ownership relationships.
- TypeScript is the only application language in the initial product.
- Completed sessions are persistent and reviewable without writing into a user's project.
- The core product behavior is independent of the interface and storage environment.
- Local CLI use requires no account, hosted service, or runtime network access.

## Proposed monorepo

Use pnpm workspaces and split only at durable boundaries.

```text
apps/
  web/                 Future local or deployed web interface
packages/
  core/                Schema, questionnaire, validation, prompt compiler,
                       session use cases, and storage contracts
  cli/                 Ink interface and local platform adapters
```

The CLI depends on `core`. A future web application also imports `core` and supplies browser-local or server-backed adapters. It must not recreate questionnaire branching, validation, prompt compilation, or session rules.

## Headless core boundary

`core` owns:

- Versioned project and session schemas.
- Architecture and capability catalogs.
- Questionnaire definitions and serializable state transitions.
- Graph and compatibility validation.
- Deterministic YAML and prompt generation.
- Session lifecycle use cases and persistence interfaces.

`core` must not depend on:

- Ink, React components, Next.js, or any other UI framework.
- Terminal input, browser APIs, or clipboard APIs.
- Node.js filesystem globals or platform-specific data paths.
- A particular database, object store, or deployment environment.

The CLI implements local filesystem, platform app-data, clipboard, clock, ID, and terminal adapters. A local web UI could use browser storage, while a deployed web UI could use server persistence. Both reuse the same core behavior.

## Core models

The versioned `ProjectConfig` represents:

- Product context and confirmed decisions.
- TypeScript applications and services.
- Infrastructure resources and ownership.
- Connections and communication protocols.
- Contracts, boundaries, and requested substitution points.
- Deployment context and constraints.
- Agent execution and question-handling preferences.

The versioned `Session` represents:

- Session identity, title, and timestamps.
- The confirmed `ProjectConfig`.
- Generated artifact hashes and generation version.
- Enough metadata to list and reopen past sessions.

The CLI session adapter stores `session.yaml`, `project.yaml`, and `AGENT_PROMPT.md` together in a platform-appropriate application-data directory.

## MVP delivery stages

### Stage 1: Foundation

- Initialize the pnpm TypeScript monorepo.
- Define the headless core and interface boundaries.
- Add shared quality tooling and package builds.
- Publish a stable `systemsextant` executable that launches the interactive interface without a subcommand.

### Stage 2: Configuration engine

- Define and version the first `ProjectConfig` schema.
- Implement architecture starters and capability-driven questions.
- Expand selections into explicit components, resources, connections, and decisions.
- Add review, validation, cancellation, and deterministic YAML output.

### Stage 3: Prompt generation

- Compile product context, architecture, constraints, security rules, and agent instructions into one prompt.
- Support plan-only, plan-then-build, and direct-build modes.
- Add decision-specific boundary and capability instructions.
- Snapshot-test representative configurations and all agent modes.

### Stage 4: Ink interface

- Add the new-session questionnaire and answer review.
- Add generated YAML and prompt review.
- Allow users to return to answers and regenerate artifacts.
- Keep all navigation and rendering logic outside `core`.

### Stage 5: Local sessions and artifact actions

- Persist completed sessions atomically in the platform application-data directory.
- Open with a choice between creating a new session and browsing past sessions.
- List, inspect, view, copy, export, and delete sessions and their artifacts.
- Do not write to the current working directory unless the user explicitly selects it as an export destination.

### Stage 6: npm distribution

- Package the CLI with a stable executable entry point.
- Add help, version, errors, and supported Node.js metadata.
- Test clean installation through `pnpm dlx` and `npx`.

## Future interfaces

### Web interface

- Build a frontend that drives the same core questionnaire and session use cases.
- Support a local web mode through a browser-compatible persistence adapter when useful.
- Support a deployed version through server-backed persistence when remote access or sharing is required.
- Add authentication only for remote persistence or shared workspaces.
- Keep CLI and web sessions on compatible versioned schemas.

The web UI is deferred, but compatibility with it is a current architectural requirement.

### Other deferred capabilities

- Reusable local templates and configuration import.
- GitHub synchronization.
- AI-assisted recommendations and conversational modes.
- Agent-readable JSON commands and optional MCP integration.
- Deterministic scaffolding and deployment.
- Mobile architecture choices.

## Cross-cutting requirements

- Schema versioning and migrations from the first public release.
- Deterministic output for identical confirmed configurations.
- Atomic session writes and safe export overwrite handling.
- No hidden AI mutations.
- Minimal permissions and privacy-preserving local storage.
- Unit tests for core rules, snapshot tests for artifacts, adapter contract tests, and end-to-end CLI tests.
- Input sanitization and strict separation between user data and generated agent instructions.
- Contract tests for the core ports so later adapters cannot change product behavior.

## Confirmed MVP boundaries

- Run the primary experience with `systemsextant`, without `init` or `new`.
- Generate a versioned configuration and one agent prompt; do not scaffold or deploy projects.
- Store completed sessions in SystemSextant application data, never implicitly in the current project.
- Make prompt and YAML viewing, copying, and explicit export available from new and past sessions.
- Include local session history and clipboard actions in the MVP; defer reusable templates.
- Defer the web UI while keeping the core reusable by local and deployed web interfaces.
- Do not call an LLM or require network access, authentication, or an account.
