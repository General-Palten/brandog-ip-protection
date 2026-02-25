# Agent Operating Model

## Purpose

Define how AI agents run Brandog under the required V1 process:

1. AI agent performs detection.
2. Company reviews and decides on enforcement.
3. Lawyer + AI agent perform enforcement.

## Agent Roles

| Agent | Core Responsibility | Primary Inputs | Primary Outputs |
| --- | --- | --- | --- |
| Queue Orchestrator | Claims due scan jobs within budget and concurrency limits | `assets`, `scan_settings`, `scan_budget_daily` | Claimed scan jobs |
| Detection Agent | Runs provider calls and retrieves potential matches | Claimed jobs + provider config | Candidate match set |
| Analysis Agent | Builds evidence and creates infringement cases with dedupe checks | Candidate matches + asset context | New/updated infringement rows |
| Enforcement Agent | Drafts enforcement package and tracks workflow | Approved cases + policy context | Draft notices, timelines, reminders |
| Monitoring Agent | Watches for relisting and recurrence patterns | Resolved/rejected history + new detections | Reopened/new cases |

## Runtime Loop

1. Claim due jobs (`claim_due_asset_scans`).
2. Validate budget and parallel limits.
3. For each job, check recent fingerprint reuse window.
4. If reusable, clone/attach prior evidence and mark scan as `skipped`.
5. If not reusable, run reverse image provider and collect candidates.
6. Attempt case creation per result using idempotent dedupe logic.
7. Move created cases to `pending_review` for company decision.
8. On company enforce action, prepare lawyer-ready enforcement package.
9. Lawyer reviews/approves submission path; AI tracks timeline and responses.
10. Update case states and write timeline events.

## State and Memory Model

Agents rely on three layers of memory:

1. **Primary state:** database rows (`assets`, `infringements`, `takedown_requests`).
2. **Execution history:** `scan_events` and `case_updates`.
3. **Derived memory:** fingerprint reuse, offender recurrence, no-match streaks.

## Determinism and Idempotency

1. Normalize external URLs before insert.
2. Dedupe cases by recommended key:
   `brand_id + original_asset_id + normalized_infringing_url`.
3. Retry-safe writes: if insertion returns duplicate conflict, return duplicate outcome instead of failing.
4. Always include `source_fingerprint` when available.

## Reliability Controls

1. Queue caps: `max_scans_per_day`, `max_spend_usd_per_day`, `max_parallel_scans`.
2. Backoff: failed scans schedule `next_scan_at` using retry policy.
3. Provider fallback: if provider-specific requirements are not met, mark failed/skipped with explicit reason.
4. Telemetry completeness: every run writes a scan event with status and counters.

## Human-in-the-Loop Model

1. AI fully owns detection and evidence assembly.
2. Company must approve enforcement per case.
3. Lawyer must review/authorize enforcement submissions.
4. AI supports lawyer with drafting, tracking, and follow-ups.

## Required Audit Artifacts

For each automated operation, maintain:

1. Action timestamp
2. Actor (`system`/agent/human role)
3. Input references (asset, case, provider)
4. Output state transition
5. Error details when applicable

## Related Docs

- [AUTONOMY_AND_ESCALATION.md](./AUTONOMY_AND_ESCALATION.md)
- [AGENT_EVALS.md](./AGENT_EVALS.md)
- [DATA_CONTRACTS.md](./DATA_CONTRACTS.md)
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
