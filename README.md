# SystemSextant

SystemSextant is a guided architecture tool for TypeScript projects. It turns product requirements and system-design decisions into a reproducible `project.yaml` configuration and an implementation-ready `AGENT_PROMPT.md` for an AI coding agent.

## Core workflow

1. Run `pnpm dlx systemsextant` or `systemsextant` from anywhere.
2. Start a new session or open a past session.
3. For a new session, answer deterministic questions about the product, architecture, capabilities, and desired agent behavior.
4. Review and edit the confirmed decisions.
5. Generate `project.yaml` and `AGENT_PROMPT.md`.
6. Store the completed session in SystemSextant's platform-specific application-data directory.
7. View, copy, or explicitly export either artifact.

SystemSextant does not write into the current working directory unless the user deliberately exports an artifact there.

## Interface architecture

The questionnaire, schemas, validation, prompt compiler, and session use cases live in a headless core package. The initial Ink CLI is one interface over that core.

A future local or deployed web interface must use the same core rather than reproduce its rules. Interface-specific concerns such as terminal rendering, browser components, clipboard access, filesystem persistence, IndexedDB, or server storage remain adapters outside the core.

## MVP boundaries

- Local-first interactive CLI distributed as an npm package.
- Persistent local sessions with browse, view, copy, export, and delete actions.
- Deterministic generation with no runtime network access.
- No LLM calls, model SDK, project scaffolding, deployment, authentication, or telemetry.
- No reusable templates in the first MVP.

See the [Product Roadmap](docs/PRODUCT_ROADMAP.md), [High-Level Implementation Plan](docs/HIGH_LEVEL_IMPLEMENTATION_PLAN.md), [Detailed Implementation Plan](docs/DETAILED_IMPLEMENTATION_PLAN.md), [Implementation Status](docs/IMPLEMENTATION_STATUS.md), and [Agent Integration Direction](docs/AGENT_INTEGRATION.md).

