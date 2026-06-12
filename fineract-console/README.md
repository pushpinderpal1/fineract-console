# Fineract Console

A custom Next.js UI for Apache Fineract — a clean, controllable alternative
to the official Mifos web-app for sandbox configuration and operations.
Talks to the Fineract REST API; uses the same database; can run alongside
the official UI without conflict.

## What this is (and isn't)

This is a **purpose-specific console** — not a replacement for the full Mifos
UI. It currently includes:

- Sign in (against Fineract `/authentication`)
- List loan products
- Create a loan product (with sane defaults, no deprecated fields)
- Live backend health pip in the sidebar

It's designed to grow: each new resource (clients, loans, savings, offices,
etc.) is a new page following the same shape as the loan product pages.

## Why it exists

The official Mifos UIs have known rough edges on complex forms — invisible
fields, deprecated field names, dropdown bindings that submit `null`. Rather
than fight those forms, this console talks directly to the Fineract REST API
with a clean minimal payload that's known to work. Same backend, same database,
no surprises.

## Architecture

```
Browser  →  Next.js (this app)  →  /api/fineract route (proxy)  →  Fineract REST API
```

Credentials live in browser localStorage as Base64 Basic Auth blobs. The
proxy route attaches the `Fineract-Platform-TenantId` header and forwards
requests to the Fineract base URL configured via env vars. The Fineract URL
and tenant are never exposed to the browser bundle.

## Local development

```bash
npm install
cp .env.example .env.local
# edit .env.local if you want to point at a different Fineract
npm run dev
```

Open http://localhost:3000.

## Deploy on Railway

1. Push this folder to a GitHub repo (its own repo — files at the root, no
   `fineract-console/` subfolder inside the repo).

2. In your existing Railway project (the one with Fineract and Postgres),
   add a new service → GitHub Repo → select this repo.

3. Set environment variables on the service:

   | Variable | Value |
   |---|---|
   | `FINERACT_BASE_URL` | `https://<your-fineract-domain>.up.railway.app/fineract-provider/api/v1` |
   | `FINERACT_TENANT`   | `default` |

4. Generate a public domain. Target port is whatever Railway gives you (the
   server reads `$PORT` from Railway automatically via `next start -p $PORT`).

5. Open the domain and sign in with `mifos` / your password.

The service uses Nixpacks (no Dockerfile needed) — Railway detects the
Next.js project and builds it cleanly.

## Adding a new resource (e.g. Clients)

The pattern repeats. To add a Clients page:

1. Create `src/app/clients/page.tsx` for the list, modelled on
   `src/app/loan-products/page.tsx`. Change the API path to `/clients`.

2. Create `src/app/clients/new/page.tsx` for the form, modelled on
   `src/app/loan-products/new/page.tsx`. Use the minimal client JSON body:

   ```json
   {
     "officeId": 1,
     "firstname": "...",
     "lastname": "...",
     "active": true,
     "activationDate": "01 January 2026",
     "dateFormat": "dd MMMM yyyy",
     "locale": "en"
   }
   ```

3. Add the nav entry in `src/components/AppShell.tsx`.

Each Fineract resource follows the same pattern: a minimal body, a POST to
`/<resource>`, a GET to `/<resource>` for listing. Fields are documented
in the Fineract Swagger UI on your backend.

## Files

- `src/lib/fineract.ts` — API client, session, error formatter
- `src/app/api/fineract/route.ts` — server-side proxy
- `src/app/api/health/route.ts` — backend health check
- `src/components/AppShell.tsx` — sidebar, topbar, auth guard
- `src/app/globals.css` — design system (monospace + humanist sans, signal yellow)

## Design notes

The visual direction is "engineering console" rather than "consumer fintech."
Monospace for codes, identifiers, and structural labels; humanist sans for
body and form fields. One accent (signal yellow) used only for primary actions
and live state. Tight 8px grid, no rounded corners, hairline rules. The
signature element is the persistent backend status pip in the sidebar —
making the API connection a tangible part of the UI.
