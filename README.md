# Pickleball Fee Splitter

A SvelteKit app for splitting pickleball court fees among participants. Each person signs in to their own profile. Event data is stored in Cloudflare D1 (not in the browser).

## Features

- Per-user accounts (email + password) with session cookies
- Invisible Cloudflare Turnstile on sign in and create account
- Add multiple courts, each with its own fee and an optional "Paid by" owner
- When 2+ courts have different owners, the Summary shows a Reimbursements breakdown of how much is owed back to each person (their share of the total pool, collected proportionally as participants pay). Leave "Paid by" blank (or the same on every court) and this stays hidden — the app behaves as a single-owner splitter by default
- Mass-add participants by pasting a numbered list (e.g. `1. johanna`), or add one at a time
- Starting a new event asks you to confirm the roster first: copy participants from a previous event, uncheck or remove anyone who isn’t playing, and add extra names before the event is created
- Master list of members is remembered across events, so you can still add known names later from chips on the main screen
- Per-event checklist to mark who has paid, with collected/remaining totals
- Generates a shareable PNG summary (courts, total, per-person amount, participant list) that excludes paid/unpaid status

## Running locally

```sh
npm install
npx wrangler d1 migrations apply pickleball-fee-splitter --local
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`). Vite uses the D1 binding from `wrangler.jsonc` so `/api/*` talks to the local database. New accounts start empty.

Local Turnstile uses Cloudflare’s dummy **invisible always-pass** keys (`PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000BB` and `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA` in `.env.development` / `.dev.vars`). Create an Invisible widget in the Cloudflare dashboard for production and set the real keys as a Pages/Workers env var (site key) and a Wrangler secret (secret key). Do not put the secret in client code.

If you already registered with a username before this change, wipe the local D1 (or delete those users) and apply migrations again — logins are email-only now.

## Data storage

Each signed-in user has one JSON document in D1 (`masterList` + `events` keyed by date). The UI still uses the same in-memory shape as before. Saving is debounced while typing court fees or payer names.

Create a remote D1 database once, then put its id in `wrangler.jsonc`:

```sh
npx wrangler d1 create pickleball-fee-splitter
npx wrangler d1 migrations apply pickleball-fee-splitter --remote
```

Replace the placeholder `database_id` in `wrangler.jsonc` with the id Wrangler prints. Bind the same database as `DB` on the Cloudflare Pages/Workers project.

Do not put Cloudflare API tokens in client code. Keep them in `.env` or CI secrets only.

## Building

```sh
npm run build
```

Output for Cloudflare is `.svelte-kit/cloudflare`. Preview with Wrangler:

```sh
npx wrangler dev
```

## Deploying

| Trigger | Environment | URL |
| --- | --- | --- |
| Push / merge to `main` | Staging | https://staging.pickleball-fee-calculator.pages.dev/ |
| GitHub **Release** published | Production | https://pickleball-fee-calculator.pages.dev/ |

CI workflow: `.github/workflows/deploy-cloudflare-pages.yml` (also supports manual `workflow_dispatch`).

In the Cloudflare Pages project, keep the **production branch** set to `main` so release deploys become the live `*.pages.dev` site. Staging uses the non-production Pages branch alias `staging`.

Required GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN` — token with **Account → Cloudflare Pages → Edit** and **Account → D1 → Edit**
- `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account id

Optional repository variable:

- `PUBLIC_TURNSTILE_SITE_KEY` — production Turnstile site key (defaults to Cloudflare’s dummy always-pass key)

Also set `TURNSTILE_SECRET_KEY` as a Pages/Wrangler secret (server only), bind D1 as `DB`, and enable compatibility flag `nodejs_als`.

Manual deploy:

```sh
npm run deploy:staging
npm run deploy:production
```

Apply remote migrations before (or as part of) the first deploy. Staging and production currently share the same D1 database from `wrangler.jsonc`.
