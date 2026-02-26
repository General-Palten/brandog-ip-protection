# Claude Notes — Brandog

This file is linked with [AGENTS.md](./AGENTS.md).

## Source of truth
- Follow [AGENTS.md](./AGENTS.md) for project guardrails and workflow constraints.

## Current baseline
- **Framework**: Next.js 16.1.6 App Router (`app/` directory), React 18.3.1, TypeScript 5.8.
- **Styling**: TailwindCSS 4.1 with CSS-variable design tokens, shadcn/ui primitives, Lucide icons.
- **Database / Auth**: Supabase (PostgreSQL + Realtime + Storage + Auth with SSR via `@supabase/ssr`).
- **AI / Search APIs**: OpenRouter (Arcee Trinity via `@openrouter/sdk`), Google Gemini (`@google/genai`), SerpApi Google Lens.
- **Charts / Maps**: Recharts 2.12, react-simple-maps 3.
- **Route guard**: `proxy.ts` (Next 16 convention, not `middleware.ts`).
- **Dev server**: `npm run dev` → port 5600.
- **Validation**: `npm run build` and `npm run typecheck`.

## Architecture overview
Brandog is a brand-protection / anti-counterfeit SaaS console. Key capabilities:
1. **Dual-role system** — Brand owners submit IP assets and report infringements; Admins/Lawyers triage, enforce, and resolve cases.
2. **Reverse-image detection** — Assets are scanned via Google Vision API or SerpApi Google Lens to find infringing listings.
3. **Case lifecycle** — `detected → pending_review → needs_member_input → in_progress → resolved_* / dismissed_*` (see `lib/case-status.ts`).
4. **Real-time sync** — Supabase Realtime subscriptions in `hooks/useRealtimeSubscription.ts`.
5. **AI assistant** — `AIDrawer` component backed by OpenRouter chat endpoint (`app/api/chat/route.ts`).
6. **Analytics** — Dashboard metrics, country-level violation heatmap, platform breakdown.

## Key directories
| Path | Purpose |
|------|---------|
| `app/` | Next.js App Router pages and API routes |
| `components/views/` | Full-page view components (Infringements, Assets, Analytics, Settings, etc.) |
| `components/ui/` | Reusable UI primitives (Button, Modal, StatusBadge, etc.) |
| `context/` | React context providers (Auth, Dashboard, Notification) |
| `hooks/` | Custom hooks (Realtime subscriptions, chat context, dynamic suggestions) |
| `lib/` | Utilities — Supabase clients, vision API, storage, case-status FSM, priority calc, runtime config |
| `constants.ts` | Mock data, platform config, status config, nav structure, plan tiers |
| `types.ts` | All TypeScript interfaces (InfringementItem, PersistedAsset, TakedownRequest, etc.) |
| `supabase/` | SQL migrations for storage buckets, RLS policies, scan queue |
| `scripts/` | `test-case-contracts.cjs` — data-contract validation |
| `docs/` | Extended docs (case lifecycle, data contracts, integrations matrix, runbooks, backlogs) |

## Environment variables (`.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase connection.
- `SERPAPI_API_KEY` — Server-side SerpApi key (proxied via `app/api/serpapi/`).
- `NEXT_PUBLIC_SERPAPI_SERVER_KEY` — Flag indicating server-managed SerpApi is active.
- `GEMINI_API_KEY` — Google Gemini vision key.
- `OPENROUTER_API_KEY` — OpenRouter LLM key (powers AI drawer).
- `NEXT_PUBLIC_BYPASS_AUTH` / `NEXT_PUBLIC_BYPASS_ROLE` — Demo mode toggles.
