# PostgreSQL Data Model

> **Status:** Planning draft v0.4 — not implementation authorization.
> **Updated:** 2026-10-11.

Owns the logical tables, relationships, composite tenant keys, financial constraints and proposed access-path indexes. This is not executable SQL or a migration.

## PostgreSQL data model blueprint

This is a logical schema with key columns and relationships, **not executable migrations or a complete physical schema**. Required/optional fields, retention, enumeration definitions, posting templates, and final indexes must be finalized after discovery. All tenant-owned tables inherit `tenant_id`, ID, timestamps, and appropriate actor/version metadata; immutable event tables use event timestamps rather than editable-record semantics.

### Platform, organization, and access

| Table | Important fields / relationships |
|---|---|
| `tenants` | `id`, slug, legal/display names, jurisdiction, currency, timezone, locale, lifecycle status; the current foundation also records the selected Pro/Ultra commercial plan without treating it as billing state |
| `users` | Global ID, unique identity-provider issuer/subject, minimal login profile; no global tenant role |
| `tenant_memberships` | Tenant + user, status, membership version; unique tenant/user |
| `roles`, `permissions`, `role_permissions` | Controlled role definitions and capability catalog; platform templates separate from tenant role instances |
| `membership_roles`, `membership_scopes` | Membership-to-role and branch/team scope assignments |
| `branches`, `teams`, `team_memberships` | Branch hierarchy, supervised teams, effective dates |
| `invitations`, `device_sessions` | Hashed invitation token, expiry, membership scope; device binding and revocation metadata |
| `tenant_branding` | One active branding record per tenant, logo object, validated theme tokens, receipt appearance |
| `tenant_setting_versions`, `policy_versions` | Schema version, effective time, settings, author/approver; typed financial policy fields |
| `onboarding_progress` | Step, status, completion evidence, last successful action |
| `tenant_subscriptions` | Platform commercial plan/limits/status; not borrower financial debt |

Global identity records are not readable by arbitrary tenants; expose only allowed user profiles through membership-aware operations. The identity provider uses its own database/role, with no application borrower-table access.

### Borrowers, documents, and risk

| Table | Important fields / relationships |
|---|---|
| `borrowers` | Legal name, lifecycle state, assigned branch, verification state; displayed financial balances are projections |
| `borrower_identities` | Borrower, country/type, encrypted number, tenant-keyed lookup HMAC, key version, verification metadata |
| `borrower_contacts` | Borrower, encrypted value, contact type, verification, preferred/authorized use |
| `borrower_addresses` | Borrower, home/work/other type, structured address, coordinates/accuracy/source, validity dates |
| `borrower_relationships` | Optional guarantor/reference link, declared relationship, permitted-purpose evidence |
| `borrower_consents` | Purpose/lawful basis, policy version, evidence object, timestamp, withdrawal/restriction state |
| `documents` | Borrower, private object key/version, category, media type, hash, scan status, retention/legal-hold state |
| `document_reviews` | Document, manually entered fields, verification checklist, review state/reviewer, correction history |
| `borrower_notes` | Author, subject, visibility classification, factual operational note |
| `risk_cases`, `risk_case_events` | Borrower, category, evidence, review deadline; immutable case decisions/disputes/resolutions |
| `data_subject_requests` | Borrower, request type, deadline, reviewer, outcome and permitted retention exception |
| `loan_products` | Tenant-scoped version seed, COP amount bounds, term/frequency/rate basis, compliance state and review evidence; draft-only until financial approval |
| `loan_applications` | Tenant-scoped request drafts linking an active borrower to a product, with requested amount/term, status and audit actor; no approval or disbursement state is implied |

Identity uniqueness is tenant-local over normalized country/type/number HMAC for active identities; changes are reviewed. Keep document review evidence minimal; do not duplicate full document content in metadata.

The consent-gated shared verification foundation is implemented in migration `0016_verification_network_foundation.sql`. It keeps a global keyed identity reference separate from tenant consents, minimal expiring assertions, query audit events and correction requests. It does not replace the future `borrowers` tables or authorize a credit-bureau integration. `tenant_member_profiles` stores only private profile metadata; `profile_photo_object_key` is an opaque private-storage reference, never a public URL, and `blood_type` is optional sensitive data with a separate consent marker.

Migration `0017_borrower_dossier_foundation.sql` now adds the first tenant-scoped borrower dossier slice. It stores legal name, required contact addresses, consent evidence, a tenant-keyed HMAC plus encrypted document number, masked last four digits, emergency contacts and private document metadata. API responses never return the full document number. Migration `0018_borrower_identity_reviews.sql` adds an append-only manual review history and keeps the current identity state on the borrower identity row. An approval requires accepted front, back and designated profile-photo objects plus explicit reviewer checklist confirmation. The current upload adapter writes opaque objects to a private VPS quarantine volume with `scan_status = pending`; staff profile photos use a separate tenant/member prefix and remain private. Antivirus scanning, off-site versioned storage and the promotion step remain operational gates before production approval.
Migration `0019_loan_product_catalog.sql` adds a tenant-scoped, draft-only product catalog with typed COP bounds, term frequency, rate basis and compliance state. It does not authorize approval, loan origination, schedule calculation or disbursement; those remain separate Phase 4 gates.
Migration `0020_loan_application_drafts.sql` adds controlled tenant-scoped application drafts. It validates borrower/product ownership through composite foreign keys, enforces product amount and term bounds, and records a redacted audit event. Submission, approval, schedule calculation, disbursement and payments remain separate gates.

### Lending and accounting

| Table | Important fields / relationships |
|---|---|
| `loan_products`, `loan_product_versions` | Product identity, approved calculation/fee/allocation/calendar terms, effective period |
| `loan_applications`, `loan_approvals` | Borrower, requested amount, reviewed evidence; decision, limits, approver, reason |
| `loans` | Borrower, branch, currency, lifecycle, nominal amount, net disbursement, scheduled total, interest basis/period/amount, product version, immutable approved-terms snapshot |
| `loan_contracts` | Loan, contract version/object, acceptance evidence and date |
| `loan_schedule_versions`, `loan_installments` | Loan schedule revision, due date, principal/interest/fee components, approval/effective state |
| `loan_accruals`, `loan_adjustments` | Versioned accrual calculation or approved adjustment, source event, journal reference |
| `loan_restructures` | Old/new agreement or schedule links, effective dates, approval, carry-forward handling |
| `loan_charges` | Loan, charge type/rate/basis, amount, withheld/financed/paid treatment, classification evidence and approval; no double charge |
| `regulatory_rate_versions` | Jurisdiction/category, source resolution/link, effective interval, annual limit, reviewer and approval state |
| `loan_compliance_checks` | Loan/product version, actual dated cash-flow inputs, calculated effective rate/convention, regulatory source version, fee classification, review outcome |
| `disbursements` | Loan, source account, actual net amount delivered, related withheld charges, method, state, journal/evidence references |
| `collection_events` | Capture UUID, device/user, client/server times, cash/session/loan references, reconciliation state |
| `payments` | Accepted payment, collection event or verified bank source, amount/currency/method, state, journal |
| `payment_allocations` | Payment, installment/component, exact amount, applied policy version |
| `payment_reversals` | Original payment, approved reason, reversing journal; refund implications recorded separately |
| `borrower_credits` | Unapplied/overpaid amount, source journal, later allocation/refund references |
| `ledger_accounts` | Account code/type/currency, owner context such as collector cash, treasury cash, bank, principal receivable |
| `journal_entries`, `journal_lines` | Source event, posting state/time; account, debit/credit, currency, exact amount |
| `cash_sessions` | Collector/account, opening float, opened/closed timestamps, declared amount, approval state |
| `cash_settlements`, `cash_settlement_items` | Session, received treasury amount, included events/payments, reviewer, transfer journal, discrepancy |
| `bank_transactions`, `reconciliation_matches` | Verified transaction/source ID, amount/date, match to payment/disbursement/settlement |
| `capital_movements`, `operating_expenses` | Owner capital inflow/outflow or categorized expense, evidence, approval, journal |
| `receipts` | Tenant-local unique number, accepted payment or approved correction, immutable artifact/hash, issue time |

Every installment allocation must belong to the payment's loan and currency; enforce with suitable composite keys or checked posting logic, not tenant equality alone. Reconciliations/settlement items must be unique per included source event unless modeling an explicit correction. Opening float and cash transfers are not borrower payments.

### Routes, operations, analytics, and automation

| Table | Important fields / relationships |
|---|---|
| `route_templates`, `route_template_stops` | Branch/team, ordered borrower/address references; active period |
| `route_runs`, `route_assignments`, `route_stops` | Scheduled date, collector/supervisor, status; address snapshot and applicable obligations |
| `visit_authorizations`, `contact_policy_checks` | Borrower/address, approved exception/legal basis where required, consent/evidence, effective/expiry dates; per-action channel/time/frequency policy result |
| `collection_interactions`, `payment_promises` | Borrower/loan, permitted channel, outcome, occurred/received time; promised amount/date |
| `operational_incidents` | Lost device, rejected offline cash, missing money, suspected duplicate; evidence/resolution |
| `notification_jobs`, `notification_attempts` | Policy/consent checks, destination reference, provider status, retry/idempotency |
| `idempotency_records` | Tenant, command family, key, request fingerprint, durable outcome; uniqueness over tenant/family/key |
| `outbox_events`, `background_jobs` | Tenant, source transaction, event/version, lease/retry/dead-letter metadata |
| `audit_events` | Actor, tenant, action, target, request ID, redacted change evidence, happened/received time |
| `portfolio_daily`, `collection_daily`, `cash_daily` | Tenant/date/scoped dimensions, metric version, as-of checkpoint, rebuild metadata |
| `report_exports` | Tenant/requester, filters, authorized snapshot, private artifact, expiry |
| `automation_rules`, `automation_rule_versions` | Tenant, typed trigger/condition/action, scope, approver, enabled state, effective dates |
| `automation_runs`, `automation_action_results` | Rule version, input checkpoint/event, result, idempotency key, retry/approval state |

### Relationships and constraints

```text
Tenant ──< Membership >── User
Tenant ──< Branch ──< Team ──< Dated route assignment
Tenant ──< Borrower ──< Identity / Contact / Address / Document / Risk case
Borrower ──< Loan application ──> Approved product version
Borrower ──< Loan ──< Schedule version ──< Installment
Loan ──< Disbursement / Accrual / Payment
Payment ──< Allocation >── Installment component
Payment / Disbursement / Settlement ──> Journal entry ──< Journal line >── Account
Route run ──< Stop ──< Interaction / Collection event
Collection event ──> Accepted payment OR Reconciliation incident
Cash session ──< Settlement item ──> Treasury transfer journal
```

- Proposed IDs: UUIDs, with random client event UUIDs for offline capture. Preserve uniqueness; do not trust identifier secrecy for authorization.
- Operational time: `timestamptz`; contractual due dates: `date` plus tenant calendar/timezone policy. Record source-event and server-receipt time separately.
- Use `UNIQUE (tenant_id, id)` on referenced tenant tables and composite FKs on descendants. Currency/account/loan consistency needs additional checks.
- Use non-negative amount checks, legal state transitions, unique receipt numbers per tenant, and one accepted financial outcome per source event.
- Normalize financial relations; reserve JSONB for versioned snapshots, branding preferences, bounded rule configuration, and bounded metadata—not financial line items or arbitrary schema-free settings.
- Do not cascade-delete financial records. Soft archival is not a substitute for a lawful retention/deletion workflow.
- Initial indexes follow access patterns: loans `(tenant_id, borrower_id)` and `(tenant_id, branch_id, status)`; installments `(tenant_id, due_date, loan_id)` for due work; payments `(tenant_id, loan_id, posted_at)`; route runs `(tenant_id, collector_id, scheduled_date)`; risk cases `(tenant_id, borrower_id, state)`; audit `(tenant_id, target_type, target_id, happened_at)`.
- Index composite FK columns where joins/deletes require it; validate plans using representative data. Introduce partial overdue/open indexes only after query definitions and measured plans are available.
- Use bounded connection pools, statement timeouts, stable lock order, pagination, and per-tenant job fairness. Do not add sharding/partitioning without evidence.
- Analytics projections are tenant-scoped tables with RLS. Avoid shared unrestricted materialized views or unrestricted BI credentials as a shortcut around tenant isolation.

## Example-specific integrity requirements

- `loan_charges` stores the retained documentation amount separately from future installment components. A charge cannot be both fully withheld and collected again without an explicitly different approved agreement.
- Reconcile nominal amount, withheld/financed treatment and actual net transfer using the approved product; never equate nominal amount with actual delivery by default.
- Product versions retain exact period, rate unit, frequency, calendar and rounding/remainder conventions; schedule dates are persisted, not inferred from the word “monthly.”
- Regulatory rate sources have effective intervals and reviewed categories. Missing, expired or unapproved compliance data prevents approval/disbursement of new products; it does not prevent accepting an existing borrower's payment.
- Route-stop authorization links to the actual borrower/address and effective policy evidence; it is not granted by an address's mere existence.

## Related documents

- [Domain](domain.md)
- [Financial rules](financial-rules.md)
- [Security](security.md)
- [Compliance](compliance.md)
