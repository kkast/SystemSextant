# Agent Integration Direction

## Goal

Support two related capabilities without coupling them:

- Let users design, discuss, practice, and critique systems through SystemSextant interfaces.
- Let another AI agent understand and use SystemSextant reproducibly without driving an interactive UI.

This is separate from `AGENT_PROMPT.md`:

- `AGENT_PROMPT.md` tells an agent how to plan or build one configured project.
- The agent integration contract tells an agent how to operate SystemSextant itself.

These features are intentionally deferred until the core questionnaire and `project.yaml` schema are stable.

## Recommended progression

### 1. Product-native design modes

Keep system-design conversations in the product interfaces while reusing the same headless core:

```text
systemsextant design
systemsextant interview
systemsextant critique <project.yaml>
```

- `design` guides the user through requirements and architecture decisions.
- `interview` asks questions, challenges trade-offs, and provides a learning review.
- `critique` reviews an existing configuration for missing decisions, risks, and alternatives.

The deterministic questionnaire can support guided design without an LLM. Rich conversational follow-ups and critique can later use the provider-neutral model adapter. CLI and web interfaces must call the same core decision engine. Every path stores accepted answers as structured decisions and finishes with `project.yaml`.

### 2. Portable agent documentation

Ship an `AGENT_USAGE.md` file in the npm package containing:

- The purpose and limits of the tool.
- Available commands and supported workflows.
- Input and output formats.
- The location and meaning of generated artifacts.
- Rules for confirmation, session access, privacy, and destructive operations.
- Examples that begin from a new or selected session.

Publish the versioned `project.yaml` JSON Schema alongside it. This gives agents useful context without requiring MCP.

### 3. Machine-readable CLI

Add non-interactive commands only after the human CLI is stable:

```text
systemsextant capabilities --json
systemsextant config schema --json
systemsextant config validate <path> --json
systemsextant session list --json
systemsextant prompt generate --config <path> --json
```

Machine mode must keep structured results on stdout, diagnostics on stderr, stable exit codes, and schema-versioned payloads. It must never prompt unexpectedly.

### 4. Optional MCP adapter

MCP is an example of a possible integration, not a requirement or current product direction. Consider it only if users need compatible AI hosts to discover and invoke the tool directly. A stable JSON CLI plus agent documentation may already be sufficient.

If justified later, the MCP adapter should remain thin and call the same `core` use cases as the CLI and web interfaces. It could expose the project schema and explicitly selected sessions as resources, and validation or prompt generation as tools.

Do not add MCP merely to support SystemSextant's own design, interview, or critique modes; those belong in the product interfaces over the shared core.

## Conversational design sessions

A future agent can discuss a product with the user, ask targeted questions, challenge assumptions, and propose configuration changes. Reproducibility requires structured state:

```text
DesignSession
  initial product description
  structured answers
  proposed decisions
  accepted and rejected decisions
  unresolved blockers
  resulting project configuration hash
  optional transcript reference
```

The agent may propose changes, but only accepted decisions modify `project.yaml`. The transcript is supporting context, never the source of truth.

## System-design interview and learning mode

Future modes can reuse the same decision engine:

- Guided mode: the tool asks questions and explains recommendations.
- Interview mode: the tool acts as an interviewer and challenges trade-offs.
- Critique mode: the tool reviews an existing `project.yaml` and identifies risks or missing decisions.

Every mode should finish with a validated `project.yaml`. An optional `SYSTEM_DESIGN_REVIEW.md` can record feedback, alternatives, concepts to revisit, and why selected trade-offs were reasonable.

## Safety and privacy

- Require confirmation before persisting agent-proposed decisions.
- Expose only explicitly selected sessions or templates.
- Never expose API keys, provider credentials, or application secrets.
- Keep tool descriptions precise about reads, writes, and deletion.
- Preserve the same validation and session-consistency guarantees as the CLI.
- Keep model-provider integration separate from the agent invocation protocol.
