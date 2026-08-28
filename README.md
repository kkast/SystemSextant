# SystemSextant

SystemSextant turns product requirements and TypeScript architecture decisions into two deterministic artifacts: a structured `project.yaml` and an implementation-ready `AGENT_PROMPT.md` for a coding agent.

It runs as a local interactive terminal application and as a browser-local web application. Neither interface calls an AI model or requires an account. Artifacts leave local storage only when the user explicitly downloads, copies, or exports them.

## Run locally

Requirements: Node.js 22 or newer and pnpm 11.

```bash
pnpm install
pnpm build
node packages/cli/dist/bin/systemsextant.js
```

For convenience, use `pnpm dev` to build and launch the CLI in one command.

To launch the browser application locally:

```bash
pnpm dev:web
```

The browser workspace autosaves drafts in IndexedDB. Generating saves the completed session automatically — one session per unique configuration — and saving a reusable template asks for a template-specific name and rejects duplicate configurations. `AGENT_PROMPT.md` is derived from the saved YAML only when requested. The browser can import a V2 `project.yaml`, and it can view, copy, and download both generated artifacts. Its production build is configured for Cloudflare Workers Static Assets.

The bare interface lets you start a new session, reopen a saved one, or use a template. A new session asks one question at a time about multiple named UIs and services, their descriptions, deployments, data, authentication, and infrastructure. Press `G` from review to generate both artifacts.

Caching, distributed rate limiting, and reliable background delivery are separate choices. They use Upstash Redis, Ratelimit, and QStash, or Cloudflare-native alternatives when Cloudflare Workers is the selected backend.

Generated sessions are saved automatically in the operating system's application-data directory. Saved sessions can be reopened, viewed, copied, exported, or deleted. Saving a reusable template asks for a template-specific name and rejects duplicate configurations.

Choose **Supported stacks and tools** from the home screen to browse every currently selectable option and discussion-only future additions.

## Product direction

- **Now:** CLI and browser interfaces over the same deterministic core, with local sessions and reusable templates.
- **Later:** optional server-backed storage, shared workspaces, and explicitly accepted AI-assisted design.

See [Architecture](docs/ARCHITECTURE.md) for how the code is organized, [Features](docs/FEATURES.md) for current and potential capabilities, and [AGENTS.md](AGENTS.md) for repository working rules.
