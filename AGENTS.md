# Brandog Agent Notes

Primary companion doc: [claude.md](./claude.md)

## Scope
- Work inside `C:\Users\Mongo\Desktop\Claude Code\Brandog`.
- Do not revert unrelated local changes; this repo is often in a dirty state during active UI work.

## Framework Baseline
- Next.js 16.1.6 App Router (`app/` directory), React 18.3.1, TypeScript 5.8.
- Route guards run through `proxy.ts` (Next 16 convention), not `middleware.ts`.
- Dev server runs on port 5600 (`npm run dev`).
- Validation: `npm run build` and `npm run typecheck`.
- Path alias: `@/*` maps to project root (configured in `tsconfig.json`).

## Tech Stack
- **Styling**: TailwindCSS 4.1 with CSS-variable design tokens (`tailwind.config.mjs`), shadcn/ui base components, Lucide React icons (pinned 0.344.0).
- **Database / Auth**: Supabase (PostgreSQL + Realtime + Storage + Auth). SSR client via `@supabase/ssr`. Server client in `lib/supabase-server.ts`, browser client in `lib/supabase.ts`.
- **AI / LLM**: OpenRouter SDK (`@openrouter/sdk`) using Arcee Trinity model. Chat endpoint at `app/api/chat/route.ts`. AI drawer UI in `components/AIDrawer.tsx`.
- **Vision / Search**: Google Gemini (`@google/genai`) and SerpApi Google Lens. Config in `lib/api-config.ts`, client in `lib/vision-api.ts`. SerpApi proxied through `app/api/serpapi/[...path]/route.ts`.
- **Charts**: Recharts 2.12 for analytics.
- **Maps**: react-simple-maps 3 for country violation heatmap (`components/WorldMap.tsx`).
- **Utilities**: `class-variance-authority`, `clsx`, `tailwind-merge` (combined in `lib/utils.ts` as `cn()`).

## App Router Structure
| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Landing — redirects to `/app` if bypass auth, else shows MarketingSite |
| `/auth` | `app/auth/page.tsx` | Supabase authentication screen |
| `/app/[...slug]` | `app/app/[[...slug]]/page.tsx` | Main SPA workspace (catch-all for client routing) |
| `POST /api/chat` | `app/api/chat/route.ts` | OpenRouter AI chat endpoint |
| `GET /api/serpapi/*` | `app/api/serpapi/[...path]/route.ts` | Server-side SerpApi proxy |

## Context Providers (nested in `App.tsx`)
- **AuthProvider** (`context/AuthContext.tsx`) — User session, profile, brand selection, role helpers (`isAdmin`, `isBrandOwner`, `isLawyer`).
- **NotificationProvider** (`context/NotificationContext.tsx`) — In-app notifications with unread counts and type-based filtering.
- **DashboardProvider** (`context/DashboardContext.tsx`) — Infringements, assets, keywords, scan events, activity log, and all CRUD/workflow actions.

## Component Map

### Views (`components/views/`)
| Component | Purpose |
|-----------|---------|
| `Infringements.tsx` | Main infringement detection & management |
| `ReportBadActor.tsx` | Member interface for requesting takedowns |
| `AdminDashboard.tsx` | Admin/lawyer case management |
| `DashboardAnalytics.tsx` | Analytics with metrics and charts |
| `AssetsView.tsx` | Asset management with drag-drop upload |
| `Settings.tsx` | User settings (profile, notifications, security, billing, team) |
| `Keywords.tsx` | Keyword monitoring |
| `IPDocuments.tsx` | Trademark/IP document storage |
| `Whitelist.tsx` | Authorized reseller/partner list |
| `EnforcingWorkspace.tsx` | Admin enforcement workspace |

### Feature Components
| Component | Purpose |
|-----------|---------|
| `AIDrawer.tsx` | Collapsible AI assistant chat |
| `CommandPalette.tsx` | Global keyboard command palette |
| `NotificationBell.tsx` | Notification center with unread count |
| `InfringementTable.tsx` | Data table for infringement listings |
| `InfringementCard.tsx` | Card view for a single case |
| `CaseDetailModal.tsx` | Detailed case view with evidence, history, actions |
| `CreateBrandModal.tsx` | Brand creation modal |
| `SearchResultsModal.tsx` | Reverse image search results |
| `TrademarkMatchPanel.tsx` | Trademark match analysis panel |
| `CountryViolationsPanel.tsx` | Geographic heat map panel |
| `WorldMap.tsx` | Interactive world map |
| `DismissReasonPicker.tsx` | Case dismissal reason selector |
| `AuthScreen.tsx` | Supabase auth UI |
| `OnboardingScreen.tsx` | First-time onboarding flow |
| `StatsCard.tsx` | KPI metric card |
| `Toast.tsx` | Toast notification container |

### UI Primitives (`components/ui/`)
- `Button.tsx`, `Modal.tsx`, `BentoCard.tsx`, `PageHeader.tsx`, `StatusBadge.tsx`, `PlatformIcon.tsx`, `ImageCarousel.tsx`, `shadcn-button.tsx`, `shadcn-card.tsx`

### Other
- `components/site/MarketingSite.tsx` — Marketing landing page.
- `components/auth/AuthRouteClient.tsx` — Auth route protection wrapper.

## Custom Hooks (`hooks/`)
- **`useRealtimeSubscription.ts`** — Generic Supabase Realtime hook with specialized variants: `useTableSubscription`, `useInfringementSubscription`, `useCaseUpdateSubscription`, `useTakedownSubscription`, `useActivitySubscription`.
- **`useChatContext.ts`** — Extracts full analytics context (threats, revenue, precision, legal risk signals, top cases) for the AI drawer.
- **`useDynamicSuggestions.ts`** — Generates contextual AI suggestion chips from dashboard data.

## Lib Utilities (`lib/`)
| File | Purpose |
|------|---------|
| `supabase.ts` | Browser Supabase client (placeholder fallback for unconfigured envs) |
| `supabase-server.ts` | Server-side Supabase client for route handlers |
| `runtime-config.ts` | Universal config getter for env vars (bypass auth, roles, API keys) |
| `api-config.ts` | Vision search provider config (Google Vision / SerpApi Lens), local storage persistence |
| `vision-api.ts` | Reverse image search client (`searchByImage()`) |
| `storage.ts` | Supabase Storage ops (upload, download, delete for assets/IP docs/avatars) |
| `asset-utils.ts` | File processing (base64, data URLs, blob URLs, MIME detection) |
| `case-status.ts` | Case workflow FSM — status types, transitions, validation, groupings |
| `priority.ts` | Auto-priority calculation, color/label getters, revenue severity |
| `data-service.ts` | Database query/mutation utilities |
| `database.types.ts` | Supabase auto-generated types |
| `seed-data.ts` | Demo data seeding |
| `enforcement-submission.ts` | Platform takedown submission utilities |
| `indexeddb.ts` | Browser IndexedDB wrapper for asset binary caching |
| `utils.ts` | `cn()` — TailwindCSS class merging |

## Case Lifecycle
Status flow (defined in `lib/case-status.ts` and `types.ts`):
```
detected → pending_review → needs_member_input → in_progress
                                                      ↓
                                          resolved_success
                                          resolved_partial
                                          resolved_failed
           dismissed_by_member (from pending_review)
           dismissed_by_admin  (from any active status)
```
- Transitions validated by `validateCaseStatusTransition()`.
- Priority auto-calculated from revenue/similarity/traffic thresholds (`lib/priority.ts`).

## Scan Pipeline
- Assets tracked by: `fingerprint`, `scan_status`, `scan_attempts`, `last_scanned_at`, `next_scan_at`.
- Keep `createInfringementFromSearch` idempotent per `(brand_id, original_asset_id, infringing_url)`.
- Prefer reusing recent scan output for identical fingerprints before triggering a new Vision request.
- Every scan attempt writes a `scan_events` row with provider, status, and summary counters.
- Reverse image providers: `google_vision`, `serpapi_lens`.
- SerpApi requires an externally accessible image URL; local-only demo files cannot be sent directly.

## Supabase Infrastructure
- **Storage buckets**: `assets`, `ip-documents`, `avatars`.
- If uploads fail with `Bucket not found`, treat as environment setup, not a UI bug.
- Protected asset uploads fall back to local in-session storage when the `assets` bucket is missing.
- **Migrations** (`supabase/migrations/`):
  1. `create_storage_buckets` — bucket creation
  2. `create_storage_object_policies` — RLS policies
  3. `add_asset_scan_queue_and_events` — scan infrastructure
  4. `add_scan_settings_and_budget_controls` — budget management

## Frontend Guardrails
- Keep React list keys stable and unique. Do not use duplicate label values as keys.
- Avoid shipping debug `console.log` noise unless explicitly requested.
- For compact chart containers, keep explicit height and `min-w-0`/`min-h-*` safeguards to avoid Recharts zero-size warnings.
- Notification IDs must be collision-safe. Avoid raw `Date.now()` alone for keys/IDs.

## Auth / Demo Mode
- When `NEXT_PUBLIC_BYPASS_AUTH=true`, route `/` redirects to `/app` (skip auth/onboarding).
- `NEXT_PUBLIC_BYPASS_ROLE` controls demo role: `brand` or `admin`.
- Without Supabase config or bypass, `App.tsx` shows a RoleSelectionScreen for demo mode.

## Validation
After any code changes, run:
```
npm run build
npm run typecheck
```
