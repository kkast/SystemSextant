# Detailed Implementation Plan

## 1. MVP outcome

Publish an interactive npm CLI that runs with:

```bash
pnpm dlx systemsextant
```

The bare `systemsextant` command opens an Ink interface with two primary choices:

- Start a new session.
- Browse past sessions.

A new session guides the user through a deterministic TypeScript architecture questionnaire and produces:

- `project.yaml`: the complete, versioned configuration.
- `AGENT_PROMPT.md`: one copy-ready prompt for an AI coding agent.

Completed sessions are stored automatically in SystemSextant's platform-specific application-data directory. From a new or past session, users can view, copy, or explicitly export either artifact. The CLI never writes to the current project directory implicitly.

The MVP does not call an LLM, scaffold code, deploy infrastructure, authenticate users, use telemetry, or synchronize data remotely.

## 2. Technology choices

- pnpm workspace monorepo.
- Strict TypeScript and ESM.
- Current active-LTS Node.js release selected when implementation begins.
- Commander for help, version, and future command routing.
- Ink and React for the terminal interface.
- Zod for runtime validation and inferred TypeScript types.
- `yaml` for deterministic YAML parsing and serialization.
- A platform-aware data-directory utility for local session storage.
- A clipboard adapter, initially backed by `clipboardy`, with a clear unsupported-platform fallback.
- Vitest for unit, snapshot, integration, and adapter contract tests.
- `tsc` for the initial build; add a bundler only if package distribution requires it.

Avoid a database, web server, runtime network access, post-install scripts, and platform-specific logic inside `core`.

## 3. Repository structure

```text
packages/
  core/
    src/
      schema/            Versioned project and session schemas
      catalog/           Architectures, capabilities, and agent modes
      questionnaire/     Questions and serializable state transitions
      validation/        Graph and compatibility validation
      prompt/            Prompt modules and compiler
      artifacts/         Deterministic YAML and artifact metadata
      sessions/          Session use cases and persistence contracts
  cli/
    src/
      app/               Ink application and navigation
      screens/           Home, questionnaire, review, and session screens
      adapters/          Filesystem, app-data, clipboard, clock, and IDs
      output/            Terminal-safe rendering and errors
    bin/                  Published executable entry point
apps/
  web/                   Future local or deployed web interface
docs/
pnpm-workspace.yaml
```

Do not create `apps/web` during the CLI MVP. Its place in the proposed structure documents the boundary the core must support.

## 4. Reusable core architecture

`core` contains product behavior and exposes typed functions or use cases. It must run without Ink, React UI components, Next.js, Node.js filesystem globals, clipboard APIs, or browser globals.

The shared core owns:

- Project and session schemas.
- Questionnaire definitions, branching, and validation.
- Architecture-starter expansion.
- Compatibility and graph rules.
- YAML serialization and prompt compilation.
- Session lifecycle operations expressed through interfaces.

Interface packages own:

- Rendering and navigation.
- Keyboard, terminal, pointer, or browser events.
- Clipboard integration.
- Local paths and filesystem operations.
- Browser storage or deployed server persistence.
- User-facing confirmations and error presentation.

### Core ports

Keep storage and platform capabilities behind narrow interfaces. The initial shapes should cover behavior such as:

```text
SessionRepository
  create(session, artifacts)
  list()
  get(sessionId)
  delete(sessionId)

Clock
  now()

IdGenerator
  createSessionId()
```

The CLI supplies a filesystem-backed `SessionRepository`. A future local web interface may use IndexedDB or a local service, while a deployed version may use server-backed persistence. Those adapters must satisfy the same contract and must not change validation or generated output.

Clipboard and export remain interface actions over artifact content; they are not required by the core compiler.

## 5. Versioned project configuration

Define `ProjectConfigV1` in Zod and infer its TypeScript type from the schema.

```text
ProjectConfigV1
  schemaVersion
  name
  language: typescript
  product: summary, goals, constraints
  architectureStarter
  components[]
  resources[]
  connections[]
  contracts[]
  decisions[]
  agentPreferences
```

Keep session IDs and timestamps out of `project.yaml`. They belong in `session.yaml`; this allows identical confirmed answers to produce byte-identical project configuration and prompt content.

Use stable, deterministic IDs for components, resources, connections, and decisions.

### Initial architecture starters

- Next.js.
- Next.js with Express.
- TypeScript CLI.
- Custom TypeScript system.

Each selection expands into explicit components and connections. Starters are questionnaire shortcuts, not schema limits.

### Initial capabilities

- Database.
- Authentication.
- Real-time communication.
- Background jobs.
- File storage.

Capabilities activate only the follow-up questions needed to make the configuration usable. For example, ask whether real-time communication is one-way or bidirectional before choosing SSE or WebSocket guidance.

### Validation

Reject:

- Duplicate or unstable IDs.
- Dangling component or resource references.
- Self-connections without an explicit reason.
- Resources without an owner or consumer.
- Architecture and capability combinations that cannot satisfy their runtime requirements.
- Required decisions that remain unresolved.

Prompt generation must accept only a valid, confirmed `ProjectConfig`.

## 6. Headless questionnaire

Represent the questionnaire as data and serializable state transitions rather than Ink components.

The first flow asks:

1. Project name.
2. What the user is building.
3. Architecture starter.
4. Capabilities.
5. Essential capability follow-ups.
6. Agent mode.

Agent modes:

- `plan-only`.
- `plan-then-build`.
- `direct-build`.

The core must support:

- Starting a questionnaire.
- Applying and validating an answer.
- Determining the next applicable question.
- Moving back without losing compatible answers.
- Producing a review model.
- Normalizing confirmed answers into `ProjectConfigV1`.

Use product-language questions before technology questions. The CLI decides how these states look and how keyboard navigation works.

## 7. Prompt and YAML generation

Serialize `project.yaml` with stable key and collection ordering.

Generate `AGENT_PROMPT.md` from ordered, typed modules rather than handwritten prompts for every stack combination.

### Prompt sections

1. Mission and required outcome.
2. Product context, goals, constraints, and non-goals.
3. Confirmed architecture and component responsibilities.
4. Resources, ownership, contracts, and communication paths.
5. Deployment assumptions and runtime limitations.
6. TypeScript engineering standards.
7. Applicable security requirements.
8. Architecture and capability guidance.
9. Agent workflow and question policy.
10. Required deliverables.

The compiler must:

- Select only applicable modules.
- Deduplicate modules by stable ID.
- Order sections deterministically.
- Detect incompatible instructions.
- Include confirmed assumptions and decisions.
- Keep user-provided product text clearly delimited as data.
- Produce byte-identical output for identical normalized configuration.

Snapshot-test every architecture starter and agent mode, plus representative capability combinations.

## 8. Session model and persistence

Define a versioned session metadata schema:

```text
SessionV1
  schemaVersion
  id
  title
  createdAt
  updatedAt
  generatorVersion
  projectConfigHash
  agentPromptHash
```

Use a platform-appropriate persistent application-data directory, not the npm installation, package cache, current project, or operating system temporary directory.

```text
systemsextant-data-directory/
  sessions/
    <timestamp>-<session-id>/
      session.yaml
      project.yaml
      AGENT_PROMPT.md
```

Requirements:

- Write all three files into a staging directory and rename the completed directory atomically.
- Store artifact hashes in `session.yaml` and verify them when loading.
- Use restrictive file permissions where supported.
- Store no API keys, access tokens, application secrets, or copied environment values.
- Sort session listings predictably, newest first by default.
- Recover safely from or ignore incomplete staging directories.
- Require explicit confirmation before deletion.
- Never treat the npm package directory as persistent storage.

Only completed sessions need persistence in the first MVP. Draft recovery and session editing can be added later.

## 9. Ink interface flow

### Home

```text
SystemSextant
  New session
  Past sessions
  Exit
```

### New session

```text
Questionnaire
  -> Review and edit answers
  -> Validate configuration
  -> Generate YAML and prompt in memory
  -> Review artifacts
  -> Confirm session
  -> Persist session
  -> Session actions
```

Users can return from answer review or artifact review, change answers, and regenerate before confirming the session.

### Past sessions

Show a concise list containing session title, creation time, and architecture summary. Opening a session provides:

- View prompt.
- Copy prompt.
- Export prompt.
- View YAML.
- Copy YAML.
- Export YAML.
- Export both artifacts.
- Delete session with confirmation.
- Return to the session list.

Artifact views must be scrollable and render terminal-safe text. Generated prompts are never dumped to standard output automatically.

## 10. Clipboard and export behavior

- Copy prompt or YAML only after an explicit user action.
- Report clipboard failure without losing the session.
- On clipboard failure, keep view and export actions available.
- Export only to a user-selected destination.
- Show exact destination paths before writing.
- Require confirmation before overwriting existing files.
- When exporting both artifacts, stage and commit the pair so a partial successful export is not reported as complete.
- The current working directory has no special status; it is used only when explicitly selected.

## 11. Testing strategy

### Core tests

- Project and session schema parsing and migrations.
- Questionnaire branching, backtracking, and normalization.
- Architecture-starter expansion and graph validation.
- YAML determinism and round trips.
- Prompt-module selection, ordering, deduplication, conflicts, and snapshots.
- Session use cases against an in-memory repository contract implementation.

### Adapter and CLI tests

- Filesystem repository contract tests in isolated temporary data directories.
- Atomic creation, hash verification, stale staging recovery, and deletion confirmation.
- Clipboard success and unsupported-platform failure.
- Export, overwrite refusal, overwrite confirmation, and partial-write failure.
- Ink navigation for new and past sessions.
- Cancellation without partial completed sessions.
- npm-package smoke tests from a clean temporary directory with network access disabled at runtime.

### Portability tests

- Ensure `core` does not import Ink, Next.js, Node filesystem modules, or browser globals.
- Exercise core use cases with both in-memory and filesystem repository adapters.
- Keep adapter contract tests reusable for a future browser-local or server-backed session repository.

## 12. Security and privacy

- Make no runtime network calls in the CLI MVP.
- Do not collect authentication, account, API-key, or deployment credentials.
- Treat product descriptions and generated prompts as potentially sensitive local data.
- Never execute project names, custom technologies, paths, user text, YAML, or prompt content.
- Strip terminal control sequences from user-provided and loaded text while preserving ordinary Unicode.
- Escape or delimit user Markdown so it cannot silently override generated agent instructions.
- Validate session metadata and hashes before presenting stored artifacts.
- Keep deletion and export overwrite operations explicitly confirmed.
- Do not add telemetry without a separate decision and explicit opt-in.

## 13. npm distribution

- Publish `systemsextant` with a stable `bin` entry that launches the home screen.
- Add `--help`, `--version`, useful exit codes, and clear non-interactive-terminal errors.
- Declare the supported Node.js range.
- Include only compiled runtime files, required schemas, license, and README.
- Avoid install-time scripts and global installation requirements.
- Run `pnpm pack`, inspect the archive, and verify both `pnpm dlx systemsextant` and `npx systemsextant` from a clean environment.

## 14. Implementation milestones

### Milestone 1: Workspace and portable core boundary

Create the workspace, packages, quality tooling, core ports, and executable shell.

Acceptance: packages build and test, and `core` has no interface or platform dependencies.

### Milestone 2: Configuration and questionnaire

Implement `ProjectConfigV1`, catalogs, graph validation, questionnaire state, architecture expansion, and fixtures.

Acceptance: representative configurations can be produced without Ink and invalid decisions return actionable errors.

### Milestone 3: Artifact compiler

Implement deterministic YAML and prompt generation with reviewed snapshots.

Acceptance: identical confirmed configurations produce byte-identical artifacts without contradictory instructions.

### Milestone 4: Ink new-session workflow

Implement the home screen, questionnaire, answer editing, validation, and artifact review.

Acceptance: users can complete and review a session without writing to the current directory.

### Milestone 5: Persistent session browser

Implement atomic app-data storage and session list, view, copy, export, and delete actions.

Acceptance: users can reopen past sessions and retrieve either artifact after restarting the CLI.

### Milestone 6: Release readiness

Finalize safety behavior, documentation, package contents, and clean-install smoke tests.

Acceptance: the packed CLI works offline at runtime through `pnpm dlx` and `npx` on supported platforms.

## 15. Explicitly deferred

- Draft-session recovery and editing completed past sessions.
- Reusable templates and configuration import.
- Project scaffolding and command execution.
- Deployment execution or provider authentication.
- GitHub synchronization.
- LLM calls, model-provider SDKs, and conversational recommendations.
- The local or deployed web interface itself; only core compatibility is required now.
- Accounts, billing, and shared workspaces.
- Mobile architecture choices.
- Agent-readable JSON commands, MCP, interview, and critique modes.
