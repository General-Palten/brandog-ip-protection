<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Brandog

Brand protection console with a public marketing site and authenticated `/app` workspace.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Add Supabase env vars in `.env.local` for authenticated mode:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` (public app base URL, used to mint provider fetch URLs for SerpApi)
   - `SUPABASE_SERVICE_ROLE_KEY` (required for server scan worker and provider fetch proxy)
   - `LENS_TOKEN_SECRET` (HMAC secret for provider tokens)
   - `SCAN_WORKER_SECRET` (optional, protects `/api/scan-worker/run`)
3. Optional for server-managed SerpApi Lens requests:
   - `SERPAPI_API_KEY`
   - `OPENROUTER_API_KEY` (optional but recommended for AI revenue scoring in worker)
   - `OPENROUTER_MODEL` (optional override, default `arcee-ai/trinity-large-preview:free`)
4. Run the app:
   `npm run dev`

Auth troubleshooting:
- `Failed to execute 'fetch' on 'Window': Invalid value` during sign-in usually means malformed Supabase env vars (extra quotes or hidden newline characters).
- Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are plain values (no wrapping quotes, no line breaks).

## Scan Worker (Server Cron)

Trigger periodic scans server-side by calling:

- `POST /api/scan-worker/run`
- Header: `x-cron-secret: <SCAN_WORKER_SECRET>`

Recommended cadence: every minute. The worker enforces per-brand daily budget and scan caps from `scan_settings`.
Worker logic:
- Runs Lens `type=all` + product enrichment (`type=products`) and follow-up product details (bounded by `max_provider_calls_per_scan`)
- Stores normalized offers/evidence snapshots and revenue scores
- Uses fixed rescan policy: `base_interval_days` or `found_interval_days` depending on findings in the last `lookback_scans`

Tokenized provider fetch URLs require the latest Supabase migrations, including:
- `20260226174500_create_provider_fetch_tokens.sql`
- `20260226213000_add_product_evidence_and_revenue_scoring.sql`

## Routes

- Public site: `/`
- Auth page: `/auth`
- Product console: `/app`
