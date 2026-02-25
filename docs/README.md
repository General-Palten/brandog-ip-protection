# Brandog Documentation

This docs set is organized as an AI-agent-first system. Agents run default operations, and humans supervise policy, quality, and legal escalation.

## Documentation Map

| Topic | Canonical File | Notes |
| --- | --- | --- |
| Product-level flow and lifecycle | [FLOW.md](./FLOW.md) | High-level map of how work moves through the system |
| Asset model and detection pipeline | [ASSETS.md](./ASSETS.md) | Source of truth for asset ingestion and scan behavior |
| Case statuses and transitions | [CASE_LIFECYCLE.md](./CASE_LIFECYCLE.md) | Source of truth for status semantics |
| Agent runtime responsibilities | [AGENT_OPERATING_MODEL.md](./AGENT_OPERATING_MODEL.md) | How agents execute, retry, and audit |
| Autonomy policy and legal handoff | [AUTONOMY_AND_ESCALATION.md](./AUTONOMY_AND_ESCALATION.md) | V1 policy: AI detects, company reviews, lawyer + AI enforce |
| Step-by-step build roadmap | [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Numbered execution plan for implementation |
| Epic/ticket delivery backlog | [EXECUTION_BACKLOG.md](./EXECUTION_BACKLOG.md) | Ordered backlog with acceptance criteria |
| Current implementation status | [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | Completion tracker for steps E1-E12 |
| Agent quality and release gates | [AGENT_EVALS.md](./AGENT_EVALS.md) | Precision, enforcement quality, and operational metrics |
| Schema and enum contracts | [DATA_CONTRACTS.md](./DATA_CONTRACTS.md) | Canonical values, provider IDs, and event shapes |
| External provider behavior | [INTEGRATIONS_MATRIX.md](./INTEGRATIONS_MATRIX.md) | Reverse image and enforcement channel capabilities |
| Incident response playbooks | [INCIDENT_RUNBOOK.md](./INCIDENT_RUNBOOK.md) | On-call actions for quality and reliability failures |

## Editing Rules

1. Update the canonical file for a topic first.
2. If a status or enum changes, update [DATA_CONTRACTS.md](./DATA_CONTRACTS.md) in the same change.
3. If autonomy behavior changes, update both [AUTONOMY_AND_ESCALATION.md](./AUTONOMY_AND_ESCALATION.md) and [AGENT_EVALS.md](./AGENT_EVALS.md).
4. Keep [FLOW.md](./FLOW.md) concise. Put execution detail in [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) and [EXECUTION_BACKLOG.md](./EXECUTION_BACKLOG.md).
5. Prefer Mermaid diagrams over large ASCII blocks for maintainability.
