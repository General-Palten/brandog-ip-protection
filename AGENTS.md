# Brandog Agent Notes

Primary companion doc: [claude.md](./claude.md)

## Scope
- Work inside `C:\Users\Mongo\Desktop\Claude Code\Brandog`.
- Do not revert unrelated local changes; this repo is often in a dirty state during active UI work.

## Framework Baseline
- App runtime is Next.js App Router (`app/` directory) on Next `16.1.6`.
- Route guards run through `proxy.ts` (Next 16 convention), not `middleware.ts`.
- Use `npm run build` to validate framework compatibility after code changes.

## Frontend Guardrails
- Keep React list keys stable and unique. Do not use duplicate label values (for example weekday initials) as keys.
- Avoid shipping debug `console.log` noise in UI components unless explicitly requested for diagnostics.
- For compact chart containers, keep explicit height and `min-w-0`/`min-h-*` safeguards to avoid Recharts zero-size warnings.

## Notifications
- Notification IDs must be collision-safe. Avoid using raw `Date.now()` alone for keys/IDs.

## Supabase Storage Requirements
- The app expects storage buckets:
  - `assets`
  - `ip-documents`
  - `avatars`
- If uploads fail with `Bucket not found`, treat it as environment setup, not a UI logic bug.
- Protected asset uploads now fall back to local in-session storage when `assets` bucket is missing, so demos can continue without blocking.

## Scan Pipeline Guardrails
- Image assets now use fingerprint-based scan controls:
  - `assets.fingerprint`
  - `assets.scan_status`
  - `assets.scan_attempts`
  - `assets.last_scanned_at`
  - `assets.next_scan_at`
- Keep `createInfringementFromSearch` idempotent per `(brand_id, original_asset_id, infringing_url)`.
- For cost control, prefer reusing recent scan output for identical fingerprints before triggering a new Vision request.
- Every automatic scan attempt should write a `scan_events` row with provider, status, and summary counters.
- Reverse image provider options:
  - `google_vision`
  - `serpapi_lens` (Google Lens via SerpApi)
- SerpApi requires an externally accessible image URL; local-only demo files cannot be sent directly.

## Routing/Auth Bypass
- When `NEXT_PUBLIC_BYPASS_AUTH=true`, route `/` should redirect to `/app` so users land directly in the console and skip auth/onboarding screens.

## Validation
- After UI changes, run a build before handing off:
  - `npm run build`

