# SystemSextant Agent Guide

## Read before working

Always read:

1. `README.md` for the product overview.
2. `docs/naming.md` for canonical names and commands.
3. `docs/IMPLEMENTATION_STATUS.md` for the current scope and overall progress.

Then read only the documents relevant to the task:

- `docs/HIGH_LEVEL_IMPLEMENTATION_PLAN.md` for stable architecture and product principles.
- `docs/DETAILED_IMPLEMENTATION_PLAN.md` for schemas, behavior, boundaries, security, and testing expectations.
- `docs/PRODUCT_ROADMAP.md` for sequencing and deferred product direction.
- `docs/AGENT_INTEGRATION.md` only for agent-facing commands, machine-readable interfaces, or future conversational modes.

## Source-of-truth rules

- The user's current request overrides repository documentation.
- `docs/naming.md` is authoritative for product, package, command, file, and environment-variable names.
- `docs/IMPLEMENTATION_STATUS.md` is authoritative for current milestone scope and completion state.
- The detailed plan guides implementation within that scope.
- The high-level plan guides architectural boundaries and long-term design.
- The roadmap and agent-integration document describe future direction; do not implement deferred work unless requested.
- The README is an overview. When it conflicts with a more specific document, follow the more specific document and update the stale overview when appropriate.

## Current implementation constraints

- The product name is `SystemSextant`; the npm package and executable are `systemsextant`.
- The primary experience launches from bare `systemsextant`; do not require `init` or `new`.
- `project.yaml` is the configuration source of truth; `AGENT_PROMPT.md` is derived from it.
- Completed sessions persist in the platform application-data directory, not the npm package or current project.
- Do not write to the current working directory unless the user explicitly selects it as an export destination.
- New and past sessions must support viewing, copying, and exporting both prompt and YAML artifacts.
- Generation must be deterministic and work without runtime network access.
- The current MVP must not call an AI model or add a model-provider SDK.
- Keep schemas, questionnaire state, validation, prompt compilation, and session use cases in a headless, environment-neutral core.
- Keep Ink, React UI components, terminal behavior, clipboard access, filesystem paths, and local storage adapters outside `core`.
- A future local or deployed web interface must be able to use the same core with different UI and persistence adapters.
- Never execute user input or generated content.
- Preserve validation, terminal sanitization, atomic session writes, deletion confirmation, and export overwrite protection.

## Working rules

- Keep changes inside the current milestone unless the user expands the scope.
- Prefer the smallest implementation that preserves the documented interface and storage boundaries.
- Add proportional unit, snapshot, adapter contract, integration, and CLI tests.
- Do not introduce a database, server, telemetry, runtime network access, post-install scripts, scaffolding, or deployment in the CLI MVP.
- Update `docs/IMPLEMENTATION_STATUS.md` only when an entire high-level item is implemented and verified. Do not add subtasks or chat-level work items to it.
- If implementation changes a confirmed decision, update the relevant documentation in the same change.
- Do not duplicate the same decision across documents unless each document needs it for its stated purpose.
