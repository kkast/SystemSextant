# SystemSextant Agent Guide

## Read before working

Always read:

1. `README.md` for the product and current usage.
2. `docs/ARCHITECTURE.md` for boundaries, component responsibilities, and technology rationale.
3. `docs/FEATURES.md` for implemented, planned, and potential features.

The user's current request overrides repository documentation. When the request changes a confirmed product or architecture decision, update the relevant document in the same change.

## Product contract

- The product name is `SystemSextant`; the npm package and executable are `systemsextant`.
- The primary experience launches from bare `systemsextant`; do not require `init` or `new`.
- `project.yaml` is the configuration source of truth. `AGENT_PROMPT.md` is derived from it.
- Generation must be deterministic and work without runtime network access.
- The current product must not call an AI model or add a model-provider SDK.
- Completed sessions belong in the platform application-data directory, never the package or current project.
- Write to the current working directory only when the user explicitly selects it as an export destination.
- New and saved sessions must allow viewing, copying, and exporting both artifacts.
- Never execute user input or generated content.
- Preserve validation, terminal sanitization, atomic session writes, deletion confirmation, hash verification, and export overwrite protection.

## Architecture rules

- Keep schemas, catalogs, questionnaire state, normalization, validation, prompt compilation, artifact generation, and session use cases in the environment-neutral `core` package.
- Keep Ink and React UI, terminal behavior, clipboard access, filesystem paths, and local persistence adapters in `cli`.
- A future browser interface must reuse `core` with different UI and persistence adapters rather than duplicate its rules.
- Keep dependencies pointing inward: interfaces depend on `core`; `core` does not depend on an interface or platform API.
- Keep changes within the current scope in `docs/FEATURES.md` unless the user explicitly expands it.
- Treat prompt blocks like independent LEGO pieces: add provider or tool guidance in a new stable block and do not change prompts for configurations that do not select it.

## Documentation rules

- Keep `README.md` concise and human-focused: what the product does, how to run it now, and the near-term direction.
- Keep `docs/ARCHITECTURE.md` short and durable. Explain why boundaries and important dependencies exist; do not turn it into a file inventory.
- Keep `docs/FEATURES.md` as the single feature and status tracker. Mark a feature implemented only after the complete behavior is verified.
- Prefer comments near code when the reason is inseparable from the implementation. In prompt compilation, document the purpose, trust boundary, ordering, and determinism of injected text; do not merely restate the code.
- Update prompt rationale comments and snapshots whenever prompt behavior changes.
- Preserve the prompt-block IDs, deterministic order, and challenge-before-tool rules documented in `docs/ARCHITECTURE.md`.
- Do not duplicate the same decision across documents unless each document needs a short version for its role.

## Working rules

- Prefer the smallest implementation that preserves documented behavior and storage boundaries.
- Add proportional unit, snapshot, adapter-contract, integration, and CLI tests.
- Do not introduce a database, server, telemetry, runtime network access, post-install scripts, scaffolding, or deployment in the local CLI unless requested.
- During implementation, run targeted tests and the narrowest relevant type-checks.
- Run the full build, type-check, and test suite once before declaring a completed implementation change.
- Do not update generated `dist/` files unless the task requires release artifacts.
