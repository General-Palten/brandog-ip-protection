# Integrations Matrix

## Purpose

Track provider capabilities, constraints, and fallback behavior used by Brandog agents.

## Reverse Image Providers

| Capability | Google Vision | SerpApi Google Lens |
| --- | --- | --- |
| Config value | `google_vision` | `serpapi_lens` |
| Persisted provider value | `google_vision` | `serpapi_google_lens` |
| Input requirement | Image bytes are sufficient | Externally reachable image URL required |
| Typical cost model | Lower per-scan estimate | Higher per-scan estimate |
| Strength | Stable baseline web detection | Lens-style discovery coverage |
| Common failure mode | API key/config errors | URL reachability or provider quota issues |

## Provider Selection Rules

1. Use selected provider from configuration.
2. If SerpApi Lens is selected, ensure a signed/public image URL is available.
3. If provider requirements are not met, fail clearly and schedule retry according to policy.

## Enforcement Channels

| Channel | Automation Suitability | Human Dependence |
| --- | --- | --- |
| Platform API submission | High | Medium for disputes |
| DMCA template + submission | Medium | High for legal review |
| Manual platform reporting | Medium | High |
| Legal notice/escalation | Low | Very high |

## Storage and Environment Dependencies

| Dependency | Purpose | Failure Impact | Fallback |
| --- | --- | --- | --- |
| `assets` bucket | Source media for scans | Scans cannot access uploaded assets | Demo/local fallback where available |
| `ip-documents` bucket | Legal evidence files | Enforcement packet quality drops | Manual evidence upload path |
| `avatars` bucket | User profile assets | Cosmetic impact | Default avatar |

## Auth and Accessibility Constraints

1. SerpApi Lens requires reachable URLs; local-only or private data paths cannot be submitted directly.
2. In auth bypass/demo contexts, provider requirements may block certain autonomous scans.
3. Agent logs must record provider and failure reason for every blocked scan.

## Integration Readiness Checklist

Before enabling a provider for autonomous mode:

1. Key management and quota monitoring are in place.
2. Error classes are mapped to retry vs fail-fast.
3. Eval baselines exist per provider.
4. Incident runbook has provider-specific playbook entries.

## Related Docs

- [ASSETS.md](./ASSETS.md)
- [AGENT_EVALS.md](./AGENT_EVALS.md)
- [INCIDENT_RUNBOOK.md](./INCIDENT_RUNBOOK.md)

