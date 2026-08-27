# Architecture

SystemSextant separates deterministic product rules from the interface and operating system. This keeps the current CLI small and lets templates or a browser interface reuse the same configuration and prompt behavior later.

## Structure

```text
packages/
  core/src/
    schema/          Versioned project and session data
    catalog/         Supported starters, capabilities, and agent modes
    questionnaire/   Questions and conditional question flow
    validation/      Answers-to-configuration normalization and graph rules
    prompt/          Stable prompt-block registry and deterministic compiler
    artifacts/       YAML serialization and artifact hashing
    sessions/        Session use cases and persistence ports
  cli/src/
    app/             Screen state and workflow orchestration
    screens/         Questionnaire, session, and export experiences
    ui/              Reusable Ink controls
    adapters/        Filesystem, app-data, clipboard, clock, ID, and sanitization
    bin/             Published executable entry point
```

`core` owns every rule that must behave identically in a terminal or browser. It has no UI, filesystem, clipboard, or browser dependencies. `cli` renders the current Ink interface and implements Node.js adapters for the ports defined by `core`. A future `apps/web` should depend on `core` and supply browser-local or server-backed adapters.

## Product flow

```text
questionnaire answers
  -> normalized and validated ProjectConfigV1
  -> deterministic project.yaml + AGENT_PROMPT.md
  -> completed session
  -> local SessionRepository
```

- The questionnaire uses product-language choices, explains why each option is useful, filters incompatible combinations, and asks follow-up questions only when required.
- Frontend selection is independent from backend selection: create a vanilla TypeScript frontend with Vite, use Next.js, or choose no frontend.
- Backend selection follows frontend selection and offers Next.js server features, Express, Cloudflare Workers, or no backend. Express and Cloudflare Workers are alternatives within this single question; Next.js server features require the Next.js frontend.
- Real-time transports are independent selections. Express projects may use Server-Sent Events, WebSockets, both, or neither; other current backends offer Server-Sent Events or neither.
- Deployment is captured per independently deployed component. A Next.js backend shares its frontend target; Express offers Render, a self-managed VPS, or local-only operation; Cloudflare Workers offers Cloudflare or local-only operation. Frontends offer Vercel, Cloudflare, Render, a VPS, or local-only operation.
- Data questions select a database and provider before offering only compatible ORM or direct data-access choices.
- File storage is selected independently as none, Supabase Storage, or Cloudflare R2.
- Infrastructure toggles represent application caching, distributed rate limiting, and reliable background delivery or queues. Upstash is available for every backend. When Cloudflare Workers is selected, each infrastructure need can instead use its Cloudflare-native service.
- Authentication selects a service before offering only login methods compatible with that service.
- Normalization expands shortcuts into explicit components, resources, connections, contracts, and confirmed decisions.
- Zod validates data at each boundary and rejects invalid graph references or duplicate stable IDs.
- Artifact generation uses stable ordering, excludes timestamps from project artifacts, and hashes the exact stored content.
- Session use cases depend on `SessionRepository`, `Clock`, and `IdGenerator` interfaces so persistence and platform behavior remain replaceable.
- The CLI repository stages all session files before renaming them into place, then verifies hashes whenever a session is loaded.

## Prompt design

`project.yaml` is authoritative; `AGENT_PROMPT.md` is a derived execution brief. The compiler validates the configuration first and assembles sections in a fixed order so identical configurations produce byte-identical prompts.

The prompt contains:

- a mission and the confirmed product context;
- the explicit component, resource, connection, and contract graph;
- general TypeScript and security requirements;
- guidance only for selected capabilities;
- one of three agent workflows: plan only, plan then build, or direct build;
- required deliverables, including a durable `SYSTEM_ARCHITECTURE.md` in the generated target project.

User-provided text is escaped and placed inside a labeled data block. This is a prompt-injection boundary: product descriptions remain context and must not become instructions. Capability and workflow text is maintained as trusted compiler-owned guidance. Comments next to the compiler explain these choices because changing their order or trust role changes the generated contract.

### Prompt blocks: the LEGO rule

The compiler treats prompt sections like LEGO pieces. Each block has a stable unique ID, deterministic order, applicability rule based on validated configuration, and deterministic renderer. Block families include `base.*`, `architecture.*`, `baseline.*`, `capability.*`, `tool.*`, and `agent-mode.*`.

Provider-independent challenge guidance and provider-specific tool guidance are separate blocks. Adding a tool should normally add a new `tool.*` block; it must not rewrite shared blocks or change prompts for configurations that do not select that tool. Edit an existing shared block only when its existing responsibility genuinely changes, such as correcting unsafe global guidance.

`ProjectConfigV1.tools` records selected tools by stable ID, and every session records its selected prompt-block IDs. Tests verify that unrelated unselected blocks leave an existing prompt byte-identical, selected tools add their own blocks without replacing generic guidance, block IDs stay unique, and ordering remains deterministic.

Upstash mappings follow the challenge rather than asking whether to add Redis and remain available for every backend:

| Challenge                                                        | Selected tool                       | Prompt block               |
| ---------------------------------------------------------------- | ----------------------------------- | -------------------------- |
| Application caching                                              | Upstash Redis with `@upstash/redis` | `tool.upstash.redis-cache` |
| Distributed rate limiting                                        | Upstash Ratelimit backed by Redis   | `tool.upstash.ratelimit`   |
| Reliable background delivery, retries, schedules, or FIFO queues | Upstash QStash                      | `tool.upstash.qstash`      |

QStash is the messaging product and is not modeled as merely a Redis queue. The current questionnaire maps each selected infrastructure challenge to its corresponding Upstash product. Provider SDKs remain behind the stable capability boundaries recorded in `project.yaml`, so alternative providers can be added later as independent tool blocks.

When Cloudflare Workers is the backend, the questionnaire may map each selected challenge to either Upstash or the corresponding Cloudflare-native tool:

| Challenge                                                        | Cloudflare-native tool                                        | Prompt block                |
| ---------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------- |
| Application caching                                              | Workers Cache API; KV when shared key-value caching is needed | `tool.cloudflare.cache`     |
| Distributed rate limiting                                        | Workers Rate Limiting binding                                 | `tool.cloudflare.ratelimit` |
| Reliable background delivery, retries, schedules, or FIFO queues | Cloudflare Queues                                             | `tool.cloudflare.queues`    |

[Cloudflare Queues](https://developers.cloudflare.com/queues/platform/pricing/) has a free tier. Cloudflare-native infrastructure is offered only with a Cloudflare Workers backend; Upstash remains an available alternative for that backend and the default for Next.js server features or Express.

Product references: [Upstash Redis](https://upstash.com/docs/redis/overall/getstarted), [Upstash Ratelimit](https://upstash.com/docs/redis/sdks/ratelimit-ts/methods), [QStash queues](https://upstash.com/docs/qstash/features/queues), [Workers Cache](https://developers.cloudflare.com/workers/runtime-apis/cache/), [Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), and [Cloudflare Queues](https://developers.cloudflare.com/queues/).

## Technology choices

| Choice                       | Why it is used                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| pnpm workspaces              | Keeps `core` and `cli` independently testable while sharing one lockfile.          |
| TypeScript, strict mode, ESM | Provides explicit contracts and matches the systems the product currently designs. |
| Zod                          | Defines runtime schemas and derives matching TypeScript types from one source.     |
| `yaml`                       | Produces and parses the human-readable configuration source of truth.              |
| `@noble/hashes`              | Creates portable SHA-256 integrity hashes without coupling `core` to Node crypto.  |
| Ink and React                | Model the interactive terminal as composable stateful UI components.               |
| Commander                    | Supplies the executable contract, help, version, and future command routing.       |
| `env-paths`                  | Resolves platform-appropriate local application-data storage.                      |
| `clipboardy`                 | Implements explicit local clipboard actions behind a CLI adapter.                  |
| `strip-ansi`                 | Prevents stored or entered text from controlling terminal output.                  |
| esbuild                      | Bundles the CLI entry point while leaving runtime packages external.               |
| Vitest                       | Covers core rules, prompt snapshots, adapters, and Ink behavior.                   |

## Invariants

- No runtime network access, model calls, command execution, or implicit project writes.
- No platform APIs inside `core`.
- No session IDs or timestamps in deterministic project artifacts.
- User content is data, never trusted prompt instructions or executable input.
- Exports require an explicit destination and confirmation before overwriting.
