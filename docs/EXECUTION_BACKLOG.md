# Execution Backlog (V1)

Status snapshot: See [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for current completion state.

## Purpose

Convert the V1 implementation plan into a delivery backlog that can be executed in strict order.

Operating model being implemented:

1. AI detects.
2. Company reviews.
3. Lawyer + AI enforce.

## How to Use This Backlog

1. Execute epics in numeric order (`E1 -> E12`).
2. Within each epic, execute tickets in order unless marked parallel-safe.
3. Do not start `E5+` until company review gate (`E4`) is complete.
4. Use acceptance criteria as release gates for each ticket.

## Ticket ID Format

`BG-E<epic>-T<ticket>`

Example: `BG-E4-T2` means Epic 4, Ticket 2.

## Global Definition of Done

1. Feature behavior matches [FLOW.md](./FLOW.md).
2. Status transitions match [CASE_LIFECYCLE.md](./CASE_LIFECYCLE.md).
3. Contracts match [DATA_CONTRACTS.md](./DATA_CONTRACTS.md).
4. Audit and telemetry are present for every state-changing action.
5. UI + backend paths are covered by tests (or documented gap with follow-up ticket).

## Critical Path (1 to 12)

1. E1: Contracts and status guardrails
2. E2: Detection worker hardening
3. E3: Case creation normalization
4. E4: Company review gate
5. E5: Enforcement handoff package
6. E6: Lawyer + AI workspace
7. E7: Submission channels
8. E8: Response and follow-up automation
9. E9: Outcome closure
10. E10: Monitoring and re-list loop
11. E11: Quality and legal safety gates
12. E12: Controlled rollout

---

## E1. Contracts and Status Guardrails (Step 1)

### BG-E1-T1: Canonical enum alignment
Acceptance criteria:
1. Infringement statuses are exactly `detected`, `pending_review`, `in_progress`, `resolved`, `rejected`.
2. Scan status and case update enums match [DATA_CONTRACTS.md](./DATA_CONTRACTS.md).
3. Any mismatch between code and docs is removed.

### BG-E1-T2: Transition guard service
Acceptance criteria:
1. Invalid status transitions are blocked in one shared service layer.
2. `pending_review -> in_progress` requires explicit company enforce action.
3. Guard returns actionable error payloads for UI/API.

### BG-E1-T3: Contract tests
Acceptance criteria:
1. Tests cover allowed and disallowed transitions.
2. Tests fail on enum drift.
3. CI runs these tests.

---

## E2. Detection Worker Hardening (Step 2)

### BG-E2-T1: Queue claim and scheduling reliability
Acceptance criteria:
1. Worker reliably claims due jobs with `claim_due_asset_scans`.
2. Respect `max_scans_per_day`, `max_spend_usd_per_day`, `max_parallel_scans`.
3. Retry behavior updates `next_scan_at` and `scan_attempts`.

### BG-E2-T2: Fingerprint reuse optimization
Acceptance criteria:
1. Recent fingerprint matches skip external call when policy allows.
2. Reused scans create or clone evidence safely.
3. Reuse path writes `scan_events` status `skipped` with reason metadata.

### BG-E2-T3: Provider execution and mapping
Acceptance criteria:
1. `google_vision` and `serpapi_lens` config values map correctly to persisted provider identifiers.
2. SerpApi URL requirement is enforced with explicit error messaging.
3. Provider failures do not crash worker loop.

### BG-E2-T4: Scan telemetry completeness
Acceptance criteria:
1. Every automatic scan attempt writes one `scan_events` row.
2. Rows include provider, status, counters, and timestamps.
3. Failure and budget skip reasons are queryable.

---

## E3. Case Creation Normalization (Step 3)

### BG-E3-T1: Idempotent case creation path
Acceptance criteria:
1. URL normalization is applied before dedupe checks.
2. Dedupe key behavior follows contract for asset-aware and fallback modes.
3. Duplicate creates return duplicate outcome, not hard failure.

### BG-E3-T2: Review-state normalization
Acceptance criteria:
1. AI-created cases end in `pending_review` for company queue.
2. No AI path bypasses company review and enters enforcement directly.
3. Existing UI views reflect normalized state.

### BG-E3-T3: Evidence payload completeness
Acceptance criteria:
1. Case contains URL, platform, score, and core evidence metadata.
2. Missing optional evidence is handled gracefully.
3. Automated vs manual source marker is present.

---

## E4. Company Review Gate (Step 4)

### BG-E4-T1: Review queue UX
Acceptance criteria:
1. Queue clearly shows `Enforce`, `Dismiss`, `Whitelist`.
2. Evidence needed for decision is visible in one workflow.
3. Bulk review actions include confirmation safeguards.

### BG-E4-T2: Decision execution rules
Acceptance criteria:
1. `Enforce` changes status `pending_review -> in_progress`.
2. `Dismiss` and `Whitelist` result in `rejected` with reason.
3. Whitelist action prevents immediate re-flagging from same trusted entity.

### BG-E4-T3: Audit trail for company decisions
Acceptance criteria:
1. Every decision writes timeline event with actor and timestamp.
2. Decision reason/note is stored when provided.
3. Audit entries are visible to authorized users.

---

## E5. Enforcement Handoff Package (Step 5)

### BG-E5-T1: Work item generation on enforce
Acceptance criteria:
1. Enforce action creates a lawyer-assigned work item.
2. Work item references originating case and evidence bundle.
3. Duplicate work item creation is prevented.

### BG-E5-T2: AI draft artifact generation
Acceptance criteria:
1. AI drafts DMCA/platform template based on case context.
2. Offender history and prior outcomes are included.
3. Draft quality is reviewable and editable by lawyer.

### BG-E5-T3: Lawyer queue routing
Acceptance criteria:
1. New work items appear in lawyer queue with priority signals.
2. Assignment flow supports manual override.
3. SLA timestamps are captured.

---

## E6. Lawyer + AI Enforcement Workspace (Step 6)

### BG-E6-T1: Lawyer case workspace
Acceptance criteria:
1. Lawyer can view full case packet and history.
2. Internal notes are supported.
3. Workspace supports secure role-based access.

### BG-E6-T2: AI co-pilot panel
Acceptance criteria:
1. AI suggestions include next actions and draft improvements.
2. Suggestions are non-destructive and lawyer-controlled.
3. AI recommendation usage is logged.

### BG-E6-T3: Approval controls
Acceptance criteria:
1. Submission requires lawyer explicit approval.
2. Approval state is visible in timeline.
3. Unauthorized actors cannot submit.

---

## E7. Submission Channels (Step 7)

### BG-E7-T1: Platform API channel
Acceptance criteria:
1. API-capable platforms can be submitted from lawyer workspace.
2. Request/response payloads are logged with status mapping.
3. Failures return actionable error detail.

### BG-E7-T2: DMCA/manual channel
Acceptance criteria:
1. Non-API flows support lawyer-reviewed draft submission path.
2. Manual submission references are captured (ticket IDs, links, notes).
3. Submission completion updates timeline.

### BG-E7-T3: Status ingestion pipeline
Acceptance criteria:
1. Submission outcomes append `case_updates`.
2. Case status transitions follow lifecycle rules.
3. Retry/duplicate submissions are safely handled.

---

## E8. Response and Follow-Up Automation (Step 8)

### BG-E8-T1: Deadline tracking
Acceptance criteria:
1. In-progress cases have next-action due dates.
2. Overdue items trigger alerts.
3. Lawyer queue surfaces stale items clearly.

### BG-E8-T2: Follow-up draft automation
Acceptance criteria:
1. AI generates follow-up drafts when no response is received.
2. Lawyer can approve/edit before send.
3. Follow-up sends are logged.

### BG-E8-T3: Escalation flags
Acceptance criteria:
1. Rejected/stalled cases are flagged for legal escalation.
2. Escalation queue is filterable.
3. Escalation events notify configured recipients.

---

## E9. Outcome Closure (Step 9)

### BG-E9-T1: Close transition rules
Acceptance criteria:
1. `in_progress -> resolved` and `in_progress -> rejected` are the only V1 close paths.
2. Close requires outcome reason code.
3. Invalid close transitions are blocked.

### BG-E9-T2: Closure metadata schema
Acceptance criteria:
1. Closure reason, timestamp, actor, and notes are persisted.
2. Metadata is queryable for analytics.
3. Legacy cases handle missing closure fields safely.

### BG-E9-T3: Stakeholder notifications
Acceptance criteria:
1. Company receives closure notifications.
2. Notification payload includes reason and case link.
3. Delivery failures are visible to operations.

---

## E10. Monitoring and Re-List Loop (Step 10)

### BG-E10-T1: Continuous monitoring jobs
Acceptance criteria:
1. Monitoring runs for previously resolved/rejected offenders.
2. Monitoring cadence is configurable.
3. Monitoring outcomes are logged.

### BG-E10-T2: Re-list detection and reopen
Acceptance criteria:
1. Re-list detection creates a new case or reopens per lifecycle policy.
2. New case links to prior enforcement history.
3. Reopened case returns to company review gate.

### BG-E10-T3: Recurrence analytics
Acceptance criteria:
1. Dashboard shows re-list rates by offender/platform.
2. Repeat offender cohorts are queryable.
3. Metrics can be filtered by date range.

---

## E11. Quality and Legal Safety Gates (Step 11)

### BG-E11-T1: Detection quality dashboard
Acceptance criteria:
1. Precision, false-positive rate, and duplicate rate are tracked.
2. Metrics are segmented by provider/platform.
3. Baselines and alerts are configured.

### BG-E11-T2: Enforcement quality dashboard
Acceptance criteria:
1. Success/rejection/appeal metrics are tracked.
2. Time-to-resolution metrics are available.
3. Trend regressions trigger alerts.

### BG-E11-T3: Legal risk alerts
Acceptance criteria:
1. Legal trigger events route to lawyer/ops channels.
2. Incident workflow links to [INCIDENT_RUNBOOK.md](./INCIDENT_RUNBOOK.md).
3. Alert noise is controlled with dedupe/rate limits.

---

## E12. Controlled Rollout (Step 12)

### BG-E12-T1: Pilot cohort rollout
Acceptance criteria:
1. Pilot brands are selected and configured.
2. Pilot uses full V1 review/enforcement policy.
3. Pilot issues are tracked with severity and owners.

### BG-E12-T2: Weekly pilot review cadence
Acceptance criteria:
1. Weekly review covers quality, legal outcomes, and ops load.
2. Decisions and follow-up actions are documented.
3. Exit criteria are evaluated weekly.

### BG-E12-T3: General availability go/no-go
Acceptance criteria:
1. Pilot metrics satisfy agreed thresholds.
2. Legal and product sign-off are recorded.
3. Rollout playbook and rollback plan are documented.

---

## Suggested Sprint Packaging

1. Sprint 1: E1, E2
2. Sprint 2: E3, E4
3. Sprint 3: E5, E6
4. Sprint 4: E7, E8
5. Sprint 5: E9, E10
6. Sprint 6: E11, E12

## Backlog Maintenance

1. Keep ticket IDs stable after implementation starts.
2. Do not merge epics unless dependencies are removed.
3. When scope changes, update this backlog and [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) together.
