# Implementation Plan (V1)

Status snapshot: See [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for current completion state.

## Goal

Implement this exact operating model:

1. AI agent handles detection.
2. Company reviews and decides whether to enforce.
3. Lawyer + AI agent handle enforcement execution.

Execution tracking companion:

- [EXECUTION_BACKLOG.md](./EXECUTION_BACKLOG.md) for epic and ticket-level delivery.

## Step-by-Step Plan

## 1. Lock Contracts and Status Rules

Build:
1. Confirm canonical enums in code and DB.
2. Freeze allowed transitions (`detected -> pending_review -> in_progress -> resolved/rejected`).
3. Define required fields for detection, review, and enforcement handoff.

Done when:
1. `DATA_CONTRACTS.md` matches actual code/schema.
2. Invalid status transitions are blocked in service layer.

## 2. Complete AI Detection Worker

Build:
1. Queue claim loop (`claim_due_asset_scans`).
2. Fingerprint reuse path.
3. Provider execution (`google_vision` / `serpapi_lens` mapping).
4. Dedupe/idempotent case creation.
5. `scan_events` logging for every run.

Done when:
1. New assets automatically produce case candidates.
2. Duplicate case creation is prevented.
3. Every run writes telemetry rows.

## 3. Normalize Case Creation to Review Queue

Build:
1. Ensure all AI-created cases land in `pending_review` after initial detection workflow.
2. Preserve evidence packet (URL, screenshots, scores, metadata).
3. Add clear source marker (`automated` vs `manual`).

Done when:
1. Company review queue shows complete case evidence.
2. No case jumps directly into enforcement in V1.

## 4. Build Company Review Actions

Build:
1. UI/UX for `Enforce`, `Dismiss`, `Whitelist`.
2. Audit events for every decision.
3. Bulk review actions with safeguards.

Done when:
1. Review actions change status correctly.
2. Decision history is visible in case timeline.

## 5. Build Enforcement Handoff Package

Build:
1. On company `Enforce`, create enforcement work item.
2. Pre-generate AI draft artifacts:
   DMCA/platform template, evidence bundle, offender history.
3. Route work item to lawyer queue.

Done when:
1. `pending_review -> in_progress` only occurs via explicit company enforce action.
2. Lawyer can open a complete package without manual data gathering.

## 6. Build Lawyer + AI Enforcement Workspace

Build:
1. Lawyer dashboard for assigned in-progress cases.
2. AI co-pilot panel for draft suggestions and next-step recommendations.
3. Approval controls before submission.

Done when:
1. Lawyer can review/edit/approve drafts.
2. AI suggestions are logged and traceable.

## 7. Implement Submission Channels

Build:
1. Platform API submission adapters where available.
2. DMCA/manual submission workflow where API is unavailable.
3. Submission result ingestion into case timeline.

Done when:
1. Submission can be triggered from lawyer workspace.
2. Result updates flow into `case_updates`.

## 8. Implement Response and Follow-Up Automation

Build:
1. AI reminders for response deadlines.
2. Auto-generated follow-up drafts for lawyer review.
3. Escalation flags for stalled/rejected cases.

Done when:
1. No in-progress case becomes stale without alert.
2. Escalation queue is visible to legal team.

## 9. Closeout and Outcome Management

Build:
1. Finalize transitions to `resolved` or `rejected`.
2. Capture reason codes and closure metadata.
3. Notify company stakeholders.

Done when:
1. Every enforced case has a final recorded outcome.
2. Closure reasons are queryable for analytics.

## 10. Monitoring and Re-listing Loop

Build:
1. Continuous AI monitoring for previously resolved/rejected offenders.
2. Re-list detection that reopens case path from `detected`.

Done when:
1. Re-listings generate fresh, reviewable cases.
2. Historical linkage to previous cases is retained.

## 11. Quality and Legal Safety Gates

Build:
1. Precision/false-positive tracking.
2. Enforcement success/rejection metrics.
3. Incident alerts for policy or legal risk.

Done when:
1. Dashboards expose detection and enforcement quality.
2. Legal escalation triggers are active and tested.

## 12. Controlled Rollout

Build:
1. Pilot with selected brands.
2. Weekly review of detection quality and legal outcomes.
3. Iterate thresholds/workflows before broader rollout.

Done when:
1. Pilot metrics meet targets.
2. Team approves expansion to all brands.

## Suggested Delivery Phases

1. **Phase A (Weeks 1-2):** Steps 1-4
2. **Phase B (Weeks 3-4):** Steps 5-7
3. **Phase C (Weeks 5-6):** Steps 8-10
4. **Phase D (Week 7+):** Steps 11-12

## Implementation Order Summary

1. Detection reliability first.
2. Company review gate second.
3. Lawyer + AI enforcement third.
4. Monitoring, quality, and rollout last.
