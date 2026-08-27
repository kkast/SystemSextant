# SystemSextant

SystemSextant turns product requirements and TypeScript architecture decisions into two deterministic artifacts: a structured `project.yaml` and an implementation-ready `AGENT_PROMPT.md` for a coding agent.

It is currently a local, interactive terminal application. It does not call an AI model, require an account, or write into the current project unless the user explicitly exports an artifact there.

## Run locally

Requirements: Node.js 22 or newer and pnpm 11.

```bash
pnpm install
pnpm build
node packages/cli/dist/bin/systemsextant.js
```

For convenience, use `pnpm dev` to build and launch the CLI in one command.

The bare interface lets you start a new session or reopen a saved one. A new session asks about the product, frontend, backend, data and infrastructure needs, authentication, and how the receiving coding agent should work. Before saving, you can review answers and both generated artifacts.

Caching, distributed rate limiting, and reliable background delivery are separate choices. They use Upstash Redis, Ratelimit, and QStash, or Cloudflare-native alternatives when Cloudflare Workers is the selected backend.

Completed sessions are stored in the operating system's application-data directory. Saved sessions can be reopened, viewed, copied, exported, or deleted.

Choose **Supported stacks and tools** from the home screen to browse every currently selectable option and discussion-only future additions.

## Product direction

- **Now:** local questionnaire, deterministic generation, and saved local sessions.
- **Next:** save and reuse configurations as templates.
- **Later:** use the same core through a local or hosted web browser interface.

See [Architecture](docs/ARCHITECTURE.md) for how the code is organized, [Features](docs/FEATURES.md) for current and potential capabilities, and [AGENTS.md](AGENTS.md) for repository working rules.
