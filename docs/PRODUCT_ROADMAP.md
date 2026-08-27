# Product Roadmap

## 1. CLI MVP

- Launch the primary interface with bare `systemsextant`, `pnpm dlx systemsextant`, or `npx systemsextant`.
- Start a new session or browse past sessions from the home screen.
- Guide users through product description, architecture starters, capabilities, essential follow-up decisions, and agent mode.
- Focus on TypeScript application architectures.
- Expand starter selections into a versioned component and resource configuration.
- Validate incompatible or incomplete decisions.
- Generate deterministic `project.yaml` and `AGENT_PROMPT.md` artifacts.
- Store completed sessions atomically in the platform application-data directory.
- View, copy, or explicitly export the prompt or YAML from new and past sessions.
- Delete stored sessions with confirmation.
- Never write into the current project unless the user deliberately exports there.
- Keep all questionnaire, validation, generation, and session behavior in a headless core reusable by other interfaces.
- Publish the CLI as the `systemsextant` npm package.

## 2. Richer configuration and templates

- Add repeatable component, resource, connection, and contract editing beyond the initial starters.
- Save a completed configuration as a reusable local template.
- List, load, clone, edit, rename, export, import, and delete templates.
- Detect structurally similar templates.
- Add more architecture starters and capability bundles.
- Import an existing `project.yaml` non-interactively.
- Add draft-session recovery and optional editing of completed sessions.

## 3. Local and deployed web interfaces

- Build a frontend over the same headless core used by the CLI.
- Support local browser persistence through a compatible adapter where useful.
- Support server-backed sessions for a deployed version.
- Keep project, session, and generated-artifact behavior compatible across interfaces.
- Add authentication only when remote persistence or shared workspaces require it.
- Add visual configuration editing and architecture diagrams without moving domain rules into UI components.

## 4. Optional synchronization

- Synchronize explicitly selected sessions or templates through a user-controlled Git repository or another justified transport.
- Reuse existing authentication where possible.
- Keep synchronization optional and local use fully functional without it.
- Add conflict detection and schema migrations.

## 5. AI architecture review

- Accept free-form requirements and conversational follow-ups.
- Identify missing requirements and unresolved decisions.
- Recommend architecture changes with rationale, assumptions, and alternatives.
- Show recommendations as proposed structured changes.
- Require explicit acceptance before changing configuration.
- Keep the provider boundary compatible with hosted and local models.
- Keep credentials outside configurations, prompts, logs, and sessions.

## Future agent integrations

- Ship an agent-readable usage guide and machine-readable project schema.
- Add stable JSON input and output modes so agents do not drive interactive UI.
- Add optional design, interview, and critique modes over the same core decision engine.
- Consider MCP only if documentation and the JSON interface do not cover real integrations.

## Uncommitted ideas

- Deterministic project scaffolding with command and file previews.
- Mobile TypeScript architecture choices.
- Community template discovery.
- Organization policies and approved technology catalogs.
- Cost and deployment comparisons.
- Importing architecture from an existing repository.
- CI validation of `project.yaml`.
- Plugin APIs for third-party catalogs, recommendations, and generators.
