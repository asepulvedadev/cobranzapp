# Deterministic Analytics and Automation

> **Status:** Planning draft v0.4 — not implementation authorization.
> **Updated:** 2026-10-11.

Owns metric definitions, reproducible reporting/scenarios and explicit scheduled/event-driven rules. No AI is included.

## Deep analytics and metric definitions

All analyses use explicit SQL queries, decimal calculations, defined aggregations and approved formulas. Use fixed labels/explanations in reports; no natural-language assistant, statistical learning or model inference.

| Metric | Proposed definition / caveat |
|---|---|
| Outstanding principal | Disbursed principal less posted principal allocations, adjusted by approved write-off/restructure rules; interest excluded |
| Due unpaid amount | Contractually due components less posted applicable allocations and approved corrections at the report cutoff |
| PAR30 | Outstanding principal of loans more than 30 days overdue divided by total eligible outstanding principal; inclusion rules/version displayed |
| Collection attainment | Due obligations satisfied in the selected due-date window divided by collectible obligations due in that same window; show prepayment/arrears recovery separately |
| Collector cash held | Opening float plus posted cash collections and transfers in, less confirmed transfers out and authorized expenses/refunds |
| Cash discrepancy | Declared/received cash minus expected cash for a defined session; sign convention displayed |
| Interest income | Earned/accrued or received interest under the approved accounting basis; principal recovery excluded |
| Net operating result | Recognized income minus approved expenses, losses, and adjustments; capital contributions excluded |
| Borrower payment behavior | On-time/late/partial history with defined observation window; insufficient evidence explicitly shown |
| Scenario cash recovery | Sum approved scheduled obligations under user-selected recovery percentages and dates; show formulas and assumptions, not a learned forecast or guaranteed outcome |

Later analyses: origination cohorts/vintages, roll rates, cure rates, concentration by branch/product/route, operating cost per collection, promises kept, collector productivity contextualized by route difficulty, and data-quality trends.

Rule-based exception examples: reversal count above an approved threshold, repeated evidence hash, cash difference beyond a configured amount, conflicting timestamps, or action time outside an approved window. Show the exact rule and evidence; these are review signals, not findings of wrongdoing. Avoid unfair employee rankings or credit profiling based on unsupported proxies.

Every report states filters, timezone, currency, as-of time, accounting basis, and metric version. Projection totals reconcile to the ledger; historical snapshots are reproducible. Exports require explicit permission, audited creation, short-lived access, and revocation on scope change.

## Deterministic systematization and automation — no AI

**Confirmed constraint:** Hermes is limited to two isolated, narrow paths: identity-field extraction and ordering preselected route stops from opaque IDs and coordinates. It cannot approve customers, select who is due, score credit, perform biometrics, judge authenticity, record payments, change balances, or make autonomous collection decisions. The worker owns deterministic due-date selection and validates every returned route permutation; conversational assistants, learned credit scoring, vector/RAG services and autonomous business decisions remain excluded.

Systematization means explicit, testable business workflows: `Event or schedule → Approved rule version → Validated scope/state → Permitted action → Audit/result`.

### Proposed automation catalog

| Trigger | Deterministic action | Boundary |
|---|---|---|
| Business day starts | Build due-work route suggestions from approved assignments/calendar | Supervisor reviews assignment changes; no AI route optimizer |
| Installment passes due date with unpaid amount | Recompute delinquency bucket and create a review task | Never automatically create a permanent risk restriction |
| Cash discrepancy exceeds approved amount | Create supervisor/finance incident | No presumption of theft; human investigation |
| Promise-to-pay date expires without applicable payment | Add follow-up task within permitted contact policy | No unauthorized or unlimited outreach |
| Approved daily/weekly report schedule fires | Generate versioned tenant/scope-specific report | Visible as-of time and freshness; no direct unrestricted export |
| Captured collection event arrives | Validate and execute authorized payment/reconciliation use case | Financial invariants remain authoritative; exceptions need review |
| Allowed reminder becomes due | Queue a fixed-template message after channel/time/frequency checks | Provider setup and lawful authorization required; disabled until approved |
| Operational job fails repeatedly | Retry within limits, then create a dead-letter incident | No unbounded retries, duplicate receipts, or silent loss |

### Rule engine boundaries

- Start with coded, typed business rules and fixed configuration fields. Do not build an arbitrary user scripting platform.
- Tenant owners can configure approved thresholds, recipients, templates, working calendar and schedules within platform/legal limits.
- Every rule has an immutable version, effective date, tenant/resource scope, author/approver, enabled state and execution history.
- Rules execute through existing authorized use cases, not direct financial table updates. Revalidate permissions/state when each job runs.
- Idempotency is per rule version and source event/occurrence. Handle timezone changes, daylight-saving transitions where applicable, repeated delivery and delayed jobs explicitly.
- Show why each task/alert exists: triggering event, exact threshold, source records and calculation timestamp. Identical inputs and versions produce identical decisions, except for explicitly supplied clock/provider state.
- Provide audited pause/disable, retry limits, cancellation and per-tenant fairness. Rule failure must not block core loan servicing.
- Sensitive actions remain human-approved: origination decisions, disbursement authorization, financial-policy changes, reversals, write-offs, refunds, risk restrictions and role grants. Approved routine calculations/payment posting may execute automatically after authorization and validation.
- No no-code visual builder is required for the pilot; a typed settings screen and execution log are sufficient.

### Reproducible scenarios instead of prediction

Example report inputs: selected obligations, cutoff date, scenario recovery percentage, and scheduled expenses. Calculate `scenario collections = eligible scheduled amount × selected recovery percentage`, round according to the report policy, and separately display principal/interest components. A human supplies the assumptions; the system does not learn them or present them as a credit decision.

## Related documents

- [Financial rules](financial-rules.md)
- [Database](database.md)
- [Compliance](compliance.md)
- [Operations](operations.md)
