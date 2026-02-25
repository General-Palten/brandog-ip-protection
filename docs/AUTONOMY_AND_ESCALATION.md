# Autonomy and Escalation Policy (V1)

## Purpose

Define exactly what AI can do autonomously in V1 and where human approval is mandatory.

## V1 Policy (Fixed)

1. AI is autonomous for detection and evidence assembly.
2. Company review is mandatory before enforcement starts.
3. Lawyer approval is mandatory for enforcement submissions.
4. AI supports enforcement execution but does not replace legal sign-off.

## Decision Rights Matrix

| Stage | AI Agent | Company Reviewer | Lawyer |
| --- | --- | --- | --- |
| Detection scan + case creation | Owns | Informed | Informed |
| Move case to enforcement | Prepares recommendation | Approves (`Enforce`) | Informed |
| Draft takedown/DMCA package | Owns draft | Optional visibility | Reviews/edits |
| Submit legal/platform action | Assists | Optional visibility | Owns decision/submission |
| Appeals and disputes | Assists | Informed | Owns |
| Close enforcement outcome | Recommends/status updates | Informed | Approves in disputed cases |

## What AI Can Do Without Human Approval

1. Claim and run detection jobs.
2. Reuse fingerprint history and dedupe duplicates.
3. Create/refresh cases and evidence packets.
4. Draft enforcement documents after company has approved enforcement.
5. Send timeline reminders and monitor response deadlines.

## What AI Cannot Do Without Human Approval

1. Move a case from `pending_review` to `in_progress` without company enforce action.
2. Submit legal notices without lawyer authorization.
3. Handle appeals or legal threats without lawyer involvement.
4. Override explicit company dismissal/whitelist decisions.

## Escalation Triggers

Escalate to lawyer immediately when any trigger is met:

1. Platform rejects the claim with legal reasoning.
2. Counter-notice, appeal, or legal challenge is filed.
3. High-value repeat offender pattern is detected.
4. Jurisdiction/regulatory ambiguity is present.
5. Evidence quality is insufficient for confident submission.

## Escalation Routing

| Trigger Type | Primary Owner | SLA Target |
| --- | --- | --- |
| Legal ambiguity | Lawyer | Same business day |
| Appeal/counter-notice | Lawyer | Immediate |
| Repeat offender escalation | Lawyer + legal team | Immediate |
| Platform integration failure | Engineering | Immediate triage |

## Governance

1. This V1 policy should be treated as mandatory baseline.
2. Any move toward auto-enforcement must be a separate future phase with explicit legal approval.
3. All policy changes must update this file and [FLOW.md](./FLOW.md) in the same PR.

## Related Docs

- [AGENT_OPERATING_MODEL.md](./AGENT_OPERATING_MODEL.md)
- [CASE_LIFECYCLE.md](./CASE_LIFECYCLE.md)
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
