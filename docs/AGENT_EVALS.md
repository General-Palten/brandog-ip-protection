# Agent Evaluation Framework

## Purpose

Define how Brandog measures agent quality, reliability, and business impact before increasing autonomy.

## Metric Layers

| Layer | Metric | Why It Matters |
| --- | --- | --- |
| Detection quality | Precision, recall, false-positive rate | Controls trust and triage load |
| Case creation quality | Duplicate rate, invalid URL rate | Measures pipeline hygiene |
| Enforcement quality | Success rate, rejection rate, appeal rate | Measures legal effectiveness |
| Monitoring quality | Re-listing detection latency, recurrence capture rate | Measures persistence against offenders |
| Operational quality | Scan failure rate, queue lag, cost per scan | Measures reliability and scalability |

## Core Definitions

1. **Precision** = true positives / all positives created.
2. **Recall** = true positives found / total true positives in evaluation set.
3. **Duplicate rate** = duplicate attempts / total create attempts.
4. **Auto-action error rate** = incorrect autonomous actions / total autonomous actions.
5. **Time to first action** = `case.created_at` to first enforcement event.

## Recommended Starting Gates

Use these as initial autonomy gates, then tighten with real data:

1. Precision >= 0.90 on protected categories.
2. Duplicate rate <= 0.05.
3. Scan event completion coverage >= 0.99.
4. Autonomous enforcement rejection rate <= manual baseline + 5%.
5. No unresolved critical legal incidents in the previous 30 days.

## Evaluation Datasets

Maintain three sets:

1. **Gold set:** human-labeled historic cases across platforms.
2. **Regression set:** previous false positives and edge cases.
3. **Drift set:** recent live samples by platform/jurisdiction.

## Test Cadence

1. Daily: operational health checks and scan failure alerts.
2. Weekly: precision/duplicate/rejection trend review.
3. Monthly: autonomy gate review and policy adjustment.
4. Pre-release: mandatory regression run on all model/rule changes.

## Failure Actions

If any release gate fails:

1. Freeze autonomy expansion.
2. Roll back to stricter mode if needed.
3. Open incident with root-cause classification.
4. Add failing patterns to regression set.

## Dashboard Requirements

A production eval dashboard should expose:

1. Metrics split by provider and platform
2. Metrics split by autonomy mode
3. Cohorts for high-value brands
4. Trend lines and alert thresholds

## Related Docs

- [AUTONOMY_AND_ESCALATION.md](./AUTONOMY_AND_ESCALATION.md)
- [AGENT_OPERATING_MODEL.md](./AGENT_OPERATING_MODEL.md)
- [INCIDENT_RUNBOOK.md](./INCIDENT_RUNBOOK.md)

