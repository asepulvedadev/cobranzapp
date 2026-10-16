# Discovery, Risk Register and Delivery Gates

> **Status:** Planning draft v0.5 — not implementation authorization.
> **Updated:** 2026-10-11.

Owns unresolved decisions, future verification evidence, risk/acceptance gates and the boundary between planning and authorized construction.

## Risk register and future verification gates

| Risk | Required mitigation / acceptance evidence |
|---|---|
| Cross-tenant disclosure | API/DB/object/job/analytics/automation isolation tests using real roles and adversarial IDs; missing-context denial and pooled-connection switching |
| Wrong balances or double collections | Golden schedule examples, decimal property tests, balanced journals, concurrent posting, idempotency mismatch/timeout/replay tests |
| Offline cash loss/conflict | Two-device simulations, stale schedules, revoked membership, reassignment, failed logout recovery, provisional receipts, reviewed incident resolution |
| Incorrect manually entered identity | Document/field review, correction history, duplicate checks and role-appropriate verification; no authenticity claims |
| Unauthorized financial corrections | Separation of duties, approval/reauthentication, immutable reversals, compensating journal evidence |
| Illegal collection/contact | Jurisdiction-approved policy, borrower-level contact checks, tested enforcement, exception audit |
| Unsafe or duplicated automation | Version/scope validation, allowlisted rule conditions/actions, replay tests, approval gates, rate limits and execution logs |
| VPS or backup failure | Offsite archive monitoring, isolated restore drill, key recovery and ledger/bank reconciliation |
| Misleading analytics | Definition/version/cutoff labeling and report-to-ledger reconciliation; principal never counted as revenue |
| Scope expansion | Approved phase boundaries; deferred payment/custody/credit bureau/desktop features require new review |

Future financial acceptance pack must include anonymized examples for partial, early, late, excess, reversed, and restructured payments; calendar/rounding boundaries; cash opening/settlement; and expense/capital separation. Colombia is confirmed; these examples still require an approved loan model and local legal/accounting policy.

## Open decisions, ordered by dependency

| Order | Decision | Why it matters |
|---|---|---|
| 1 — resolved | Colombia confirmed | Review local contracts, lawful collection, identity formats, currency, rates and data rights before launch |
| 2 — described, not approved | Nominal/net loan example and three payment frequencies recorded | Pricing legality, charge classification, exact dates, allocations and rounding still require approval |
| 3 | Real cash/bank workflow and approval authority | Ledger templates, reconciliation, receipts and separation of duties |
| 4 | Required offline behavior and supported devices | Pilot viability, data exposure, sync/conflict recovery and build requirements |
| 5 | Tenant organization and expected launch volume | Scope rules, onboarding, capacity/load test envelope |
| 6 | Prioritize deterministic automations and report definitions | Approved thresholds, scheduled tasks, exception ownership and reproducible metrics |
| 7 | Approve native/web/auth/data stack | Team readiness, operational maintenance, reuse versus complexity |
| 8 | Storage/map/notification providers and monthly ceiling | Data region, variable costs, external contracts and feature feasibility |
| 9 | Branding depth, import needs, commercial plan and name | Onboarding, migration process, positioning, quotas and support |

Discuss one decision at a time. Jurisdiction and a reported loan example are recorded; next confirm borrower funding purpose and legal category before approving pricing or collection visits. Do not freeze schema or technology versions from this draft alone.

## Planning completion and construction authorization

### This planning deliverable is complete when

- [x] Requested capabilities are mapped to roles, journeys, and release boundaries.
- [x] Mobile-first experience, multi-tenant branding/settings/onboarding, and proposed architecture are documented.
- [x] A logical PostgreSQL blueprint and financial/isolation invariants are provided.
- [x] Manual document capture, deep analytics, deterministic automation boundaries, and VPS/recovery plan are included.
- [x] Dedicated Hermes OCR profile and Colombian-ID skill extract all legible front/back fields; mandatory human confirmation remains the gate and no credit decision is delegated to the model.
- [x] Dedicated route-ordering profile and skill receive only opaque IDs and coordinates; the worker creates next-day routes at 05:00 tenant-local time from deterministic credit due dates, with validated fallback and manual reordering.
- [x] Assumptions are explicit and distinct from requirements and approved decisions.
- [x] Technical constraints are checked against primary documentation; the current operational pilot is implemented within the protected scope below, while accounting, custody, offline money capture, and full reporting remain gated.
- [x] Documentation is separated by responsibility; visual design is isolated in `design.md`.
- [x] User-selected Aura reference is documented as the whole-app visual direction; mobile-first adaptation and proposed tokens/components are specified. Actual screen mockups and user review remain pending.
- [x] The user-provided nominal/net amount example and daily/fortnightly/monthly cadences are documented as unapproved discovery evidence.

### Planning is not approved for implementation until

- [x] First operating country is confirmed: Colombia.
- [ ] Applicable Colombian operating/legal/data policy and proposed locale/currency defaults are approved.
- [ ] Lender interviews and field workflows validate the pain, offer, and pilot scope.
- [ ] One loan product has legally approved pricing/charge classification and calculation/rounding/allocation/exception examples.
- [ ] Exact first due date, 30-day/calendar-month distinction, fortnightly dates and permitted collection calendar are confirmed.
- [ ] Cash/bank/settlement/refund/reversal handling and permissions are approved.
- [ ] Offline policy, acknowledgment, lost-device, logout, and conflict recovery requirements are settled.
- [ ] Native encryption/offline, identity, and deterministic automation validation requirements are accepted; experiments require separate authorization.
- [ ] Stack, providers, data regions, hosting budget, volumes, and recovery targets are approved.
- [ ] Mobile screens and role-specific flows have been reviewed before UI implementation.
- [ ] Final physical schema/migrations, acceptance plan, and ordered delivery backlog are reviewed.
- [x] User explicitly authorized the engineering repository, development foundation, CI/CD, VPS deployment, borrower dossier, verification, routes, and the protected operational credit pilot on 2026-10-11. Full accounting, custody, offline money capture, and reporting remain gated by the unresolved decisions above.

**Next discovery question:** What do borrowers primarily use the loan funds for? Purpose is discovery evidence; it does not by itself prove eligibility for a legal credit category.

## Related documents

- [Product scope](product.md)
- [Compliance](compliance.md)
- [Financial rules](financial-rules.md)
- [Development and VPS delivery plan](development-plan.md)
- [Documentation index](../README.md)
