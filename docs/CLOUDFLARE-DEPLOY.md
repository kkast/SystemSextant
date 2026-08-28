# Deploying the Web UI to Cloudflare Workers Static Assets

How SystemSextant's browser app (`apps/web`) is deployed to Cloudflare. The app is a static client-only Vite build — no server code — served via Workers Static Assets with SPA fallback routing.

## One-time setup

### 1. Install pnpm (via corepack)

```bash
corepack enable pnpm
corepack prepare pnpm@latest --activate
```

### 2. Create a scoped API token

Avoid the Global API Key. In the Cloudflare dashboard: **My Profile → API Tokens → Create Token** (Custom Token).

Minimum permissions (Account level):

- `Workers Scripts : Edit` — deploys the Worker and its static assets
- `Account Settings : Read` — lets wrangler resolve the account ID

Skip KV, R2, Pages, Tail, CI, Observability, Containers permissions unless a future Worker actually uses them. Keep the token's account scope restricted to the one account, and optionally set an expiry date and IP filter.

### 3. Authenticate on the deploy machine

```bash
export CLOUDFLARE_API_TOKEN="cf_..."
export CLOUDFLARE_ACCOUNT_ID="efe371304b805a171dd683ccbec576db"
```

Persist in `~/.bashrc`. The account ID is set explicitly because account-scoped tokens cannot call `/memberships`, which older wrangler versions use for account discovery — providing the ID avoids the `Authentication failed (status: 400) [code: 9106]` error.

## Deploying

From the repo root once, then the web app:

```bash
pnpm install
pnpm build

cd apps/web
pnpm exec wrangler deploy
```

Or use the shortcut: `pnpm deploy` inside `apps/web` (builds, then deploys).

Result: `https://web.systemsextant.workers.dev` (worker name `web`, account subdomain `systemsextant`).

## wrangler.jsonc notes

```jsonc
{
  "name": "web",                    // worker name → <name>.<subdomain>.workers.dev
  "workers_dev": true,              // explicitly enable the workers.dev route
  "compatibility_date": "2025-01-01", // must not be in the future
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application" // SPA history fallback
  }
}
```

- `workers_dev: true` is set explicitly. Without it, wrangler warns about a fallback and the route can end up disabled on the dashboard, making the deployed URL unreachable.
- `not_found_handling: single-page-application` serves `index.html` for unknown paths so client-side routes work.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Command 'pnpm' not found` | pnpm missing | `corepack enable pnpm` |
| `Authentication failed (9106)` on deploy, `whoami` works | Token can't call `/memberships` | `export CLOUDFLARE_ACCOUNT_ID=...` |
| Deployed URL won't load / TLS handshake failure | workers.dev route disabled for the worker | `"workers_dev": true` in config + redeploy |
| Wrong URL after renaming worker | Stale config or ran from repo root | Edit `wrangler.jsonc` `name`, deploy from `apps/web` |

## Cleanup

Delete the old worker (renamed deployments leave the previous one behind):

```bash
cd apps/web
pnpm exec wrangler delete --name systemsextant
```
