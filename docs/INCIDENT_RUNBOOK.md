# Incident Runbook

## Purpose

Define immediate response actions when agent-driven detection or enforcement behavior degrades.

## Severity Levels

| Severity | Definition | Example |
| --- | --- | --- |
| `SEV-1` | Legal or production-critical failure with customer impact | Wrongful autonomous action at scale |
| `SEV-2` | Major functionality impaired but workaround exists | Scan queue stalled for many brands |
| `SEV-3` | Partial degradation with limited business impact | Provider latency spike |
| `SEV-4` | Minor issue or documentation/process defect | Missing telemetry field in non-critical path |

## Universal First Response

1. Acknowledge incident and assign incident owner.
2. Freeze risky autonomy actions if legal or quality uncertainty exists.
3. Capture scope: affected brands, providers, time window, and impacted statuses.
4. Start an incident timeline with timestamps and decisions.
5. Notify stakeholder channel based on severity.

## Playbook: Scan Queue Stalled

1. Check due jobs (`assets.next_scan_at`) vs claimed jobs.
2. Verify worker loops are running and not budget-blocked.
3. Validate `claim_due_asset_scans` RPC health.
4. Confirm scan settings are not unintentionally restrictive.
5. Resume queue and backfill skipped windows.

## Playbook: Provider Outage or Credential Failure

1. Identify affected provider and error class.
2. Switch impacted brands to safe provider where possible.
3. Mark runs as failed/skipped with explicit reason in `scan_events`.
4. Increase retry delay to prevent cost amplification.
5. Re-enable normal routing after smoke validation.

## Playbook: False Positive Spike

1. Compare current precision against baseline.
2. Disable high-autonomy actions for impacted cohorts.
3. Sample recent cases and classify error patterns.
4. Patch detection rules/prompts and add regression examples.
5. Re-run eval gates before restoring autonomy mode.

## Playbook: Cost Spike

1. Inspect `scan_budget_daily` for anomalous spend by provider/brand.
2. Confirm budget guardrails are enforced in worker cycle.
3. Reduce parallelism and tighten daily scan cap temporarily.
4. Prefer fingerprint reuse and stale-scan throttling.
5. Publish recovery timeline and expected cost normalization.

## Playbook: Storage Dependency Failure

1. Check availability of required buckets (`assets`, `ip-documents`, `avatars`).
2. Move to fallback upload behavior for demos when possible.
3. Pause provider flows that require external asset URLs.
4. Recover bucket configuration and validate permissions.

## Communication Requirements

For `SEV-1` and `SEV-2` incidents:

1. Send initial summary within 30 minutes.
2. Send updates at least every 60 minutes.
3. Share mitigation and rollback status.
4. Publish final incident report with root cause and prevention tasks.

## Post-Incident Actions

1. Document root cause and blast radius.
2. Add regression tests or eval samples for the failure mode.
3. Update autonomy policy if decision thresholds failed.
4. Update this runbook if response steps were missing or unclear.

## Related Docs

- [AGENT_OPERATING_MODEL.md](./AGENT_OPERATING_MODEL.md)
- [AUTONOMY_AND_ESCALATION.md](./AUTONOMY_AND_ESCALATION.md)
- [AGENT_EVALS.md](./AGENT_EVALS.md)

