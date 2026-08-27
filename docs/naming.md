# SystemSextant

SystemSextant is the canonical name of the project.

## Positioning

**Tagline:** Navigate decisions into an agent-ready architecture.

The name reflects the product's purpose: SystemSextant guides users through system-design and product decisions, then turns those decisions into a reproducible project configuration and an implementation-ready prompt for an AI agent.

## Canonical identifiers

| Purpose | Identifier |
| --- | --- |
| Product name | `SystemSextant` |
| npm package | `systemsextant` |
| CLI command | `systemsextant` |
| Project configuration | `project.yaml` |
| Agent prompt | `AGENT_PROMPT.md` |
| Session metadata | `session.yaml` |
| Local application data | Platform app-data directory under `systemsextant/` |
| Environment-variable prefix | `SYSTEMSEXTANT_` |

## Current commands

```bash
pnpm dlx systemsextant
npx systemsextant
systemsextant
```

The bare command opens the interactive new-session and past-session interface. Export is an explicit action inside a session, not an implicit write to the current directory.

## Naming rationale

A sextant helps a traveller determine their position and chart a course. SystemSextant applies that idea to software systems: it establishes requirements, guides architectural choices, and produces a clear course that humans and AI agents can follow.

`System` was chosen instead of `Stack` because the product covers more than technology selection. It can represent requirements, applications, services, data stores, infrastructure, deployment intentions, architectural boundaries, and the reasoning connecting them.
