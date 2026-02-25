# Assets and Detection Pipeline

## Purpose

This document is the source of truth for what an asset is, how agents scan from assets, and how matches are turned into infringement cases.

## Asset Families

| Family | Stored Type | Primary Use by Agents |
| --- | --- | --- |
| Visual assets | `image`, `video` | Reverse image detection and evidence linking |
| Text assets | `text` | Keyword and context support |
| IP documents | Document records + files | Enforcement evidence and legal context |
| Whitelist records | Domain/seller records | False-positive suppression and trust rules |

## Required Storage Dependencies

The app expects these Supabase storage buckets:

1. `assets`
2. `ip-documents`
3. `avatars`

If `assets` is missing, protected upload flows can fall back to local in-session behavior for demos.

## Canonical Asset Fields

| Field | Purpose |
| --- | --- |
| `id`, `brand_id`, `type`, `name`, `mime_type` | Identity and classification |
| `storage_path` | Source file location for provider calls |
| `fingerprint` | Content hash used for dedupe and scan reuse |
| `scan_status` | Queue and execution state |
| `scan_attempts` | Retry accounting |
| `last_scanned_at`, `next_scan_at` | Scheduling and freshness windows |
| `scan_provider` | Provider used for the next/last run |
| `last_scan_error` | Most recent failure reason |

## Scan Status Lifecycle

| Status | Meaning |
| --- | --- |
| `pending` | Asset is known but not queued |
| `queued` | Eligible for worker claim |
| `scanning` | Worker currently processing |
| `success` | Scan completed and metadata updated |
| `failed` | Scan failed and is scheduled for retry |
| `skipped` | No external call made (budget or reuse path) |

## AI Detection Pipeline

1. **Queue claim**
   Worker claims jobs via `claim_due_asset_scans`.
2. **Reuse check**
   If an equivalent fingerprint was scanned recently, reuse prior results and skip external call.
3. **Provider execution**
   Run reverse image lookup on the selected provider.
4. **Case creation**
   For each candidate result, call `createInfringementFromSearch`.
5. **Dedupe/idempotency**
   Prevent duplicate cases for the same brand/asset/url combination.
6. **Event logging**
   Write a `scan_events` row with provider, status, and summary counters.
7. **Adaptive scheduling**
   Set `next_scan_at` based on detection outcomes and retry policy.

## Idempotency and Duplicate Rules

1. Upload dedupe: identical image fingerprints can be rejected or reused.
2. Case dedupe: app logic checks existing rows before insert.
3. Recommended idempotency key:
   `brand_id + original_asset_id + normalized_infringing_url`
4. If `original_asset_id` is unavailable, fall back to:
   `brand_id + normalized_infringing_url`

## Provider-Specific Behavior

| Provider | Config Value | Persisted Value | Key Constraint |
| --- | --- | --- | --- |
| Google Vision Web Detection | `google_vision` | `google_vision` | Can run directly from image bytes |
| SerpApi Google Lens | `serpapi_lens` | `serpapi_google_lens` | Requires externally reachable image URL |

For SerpApi Lens, local-only files cannot be scanned unless uploaded and exposed through signed/public URLs.

## Scan Event Requirements

Each automatic scan attempt should write one `scan_events` row with:

1. `provider`
2. `status`
3. `matches_found`
4. `duplicates_skipped`
5. `invalid_results`
6. `failed_results`
7. `estimated_cost_usd`
8. `metadata` for worker/debug context

## Scoring Inputs for Case Priority

Current scoring signals should include:

1. Visual similarity
2. Keyword/context relevance
3. Price or listing anomaly
4. Seller/domain risk indicators
5. Prior offender history

Detailed priority policy belongs in agent policy and eval docs, not hard-coded in this file.

## Manual Ingestion Path

Manual reports should still produce the same case object model:

1. Normalize URL
2. Attach available evidence
3. Create infringement in `detected` or `pending_review`
4. Continue through the same lifecycle in [CASE_LIFECYCLE.md](./CASE_LIFECYCLE.md)

## Related Docs

- [FLOW.md](./FLOW.md)
- [CASE_LIFECYCLE.md](./CASE_LIFECYCLE.md)
- [DATA_CONTRACTS.md](./DATA_CONTRACTS.md)
- [INTEGRATIONS_MATRIX.md](./INTEGRATIONS_MATRIX.md)

