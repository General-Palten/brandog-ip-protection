# Data Contracts

## Purpose

This file captures canonical enum values and key field contracts used by agents and UI flows.

## Canonical Enums

### Infringement Status (`infringements.status`)

1. `detected`
2. `pending_review`
3. `in_progress`
4. `resolved`
5. `rejected`

### Asset Scan Status (`assets.scan_status`)

1. `pending`
2. `queued`
3. `scanning`
4. `success`
5. `failed`
6. `skipped`

### Case Update Type (`case_updates.update_type`)

1. `takedown_initiated`
2. `platform_contacted`
3. `dmca_sent`
4. `awaiting_response`
5. `follow_up_sent`
6. `escalated`
7. `content_removed`
8. `case_closed`
9. `custom`

### Asset Type (`assets.type`)

1. `image`
2. `video`
3. `text`

### Platform Values (`infringements.platform`)

1. `Meta Ads`
2. `Instagram`
3. `Shopify`
4. `TikTok Shop`
5. `Amazon`
6. `AliExpress`
7. `eBay`
8. `Website`

## Provider Identifier Contract

Two provider namespaces currently exist and must be mapped explicitly:

| Layer | Google Vision | SerpApi Lens |
| --- | --- | --- |
| Config/UI provider value | `google_vision` | `serpapi_lens` |
| Persisted scan/detection provider value | `google_vision` | `serpapi_google_lens` |
| Detection method | `web_detection` | `google_lens` |

Do not assume config values and persisted provider values are identical.

## Core Table Field Contracts

### `assets` (detection-critical fields)

| Field | Contract |
| --- | --- |
| `fingerprint` | Optional hash, required for reuse optimization |
| `scan_status` | Must be valid scan status enum |
| `scan_attempts` | Non-negative integer |
| `last_scanned_at` | Timestamp of last attempted scan |
| `next_scan_at` | Timestamp for future worker claim |
| `scan_provider` | Provider ID used in worker execution |

### `infringements` (case-critical fields)

| Field | Contract |
| --- | --- |
| `original_asset_id` | Nullable reference to source asset |
| `infringing_url` | Normalized URL if present |
| `source_fingerprint` | Fingerprint associated with originating asset |
| `detection_provider` | Persisted provider ID |
| `status` | Must be valid infringement status enum |

### `scan_events` (audit-critical fields)

| Field | Contract |
| --- | --- |
| `provider` | Provider ID used for this run |
| `status` | `queued`, `success`, `failed`, or `skipped` |
| `matches_found` | Non-negative integer |
| `duplicates_skipped` | Non-negative integer |
| `invalid_results` | Non-negative integer |
| `failed_results` | Non-negative integer |
| `estimated_cost_usd` | Optional decimal estimate |
| `metadata` | JSON object for run context |

## Idempotency Contract

Application logic should enforce case-level idempotency by:

1. Normalizing inbound URL.
2. Checking existing rows for `(brand_id, original_asset_id, infringing_url)` when asset reference is available.
3. Falling back to `(brand_id, infringing_url)` when asset reference is unavailable.

## Schema Change Protocol

When changing enums or field semantics:

1. Add migration.
2. Update generated DB types.
3. Update this document in the same PR.
4. Update affected docs:
   [ASSETS.md](./ASSETS.md), [CASE_LIFECYCLE.md](./CASE_LIFECYCLE.md), and [FLOW.md](./FLOW.md).

