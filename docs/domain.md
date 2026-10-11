# Domain, Vocabulary and Roles

> **Status:** Planning draft v0.4 — not implementation authorization.
> **Updated:** 2026-10-11.

Owns business concepts, relationships, actor responsibilities and resource-scope semantics.

## Domain language

| Concept | Meaning |
|---|---|
| Tenant | Independent lending business and isolation boundary |
| Borrower | Person responsible for an obligation; distinct from a platform user |
| Collector | Staff member assigned to field collection work |
| Supervisor | Staff member overseeing scoped teams/routes and exceptions |
| Loan product | Versioned template defining approved contractual terms |
| Nominal amount | Stated contractual amount; not automatically the cash delivered |
| Withheld charge | Separately evidenced deduction at origination; legal/accounting classification must be approved |
| Net disbursement | Actual cash/bank amount delivered to the borrower |
| Contractual interest | Explicit amount/rate with period and calculation basis |
| Installment | Scheduled obligation; does not itself represent a visit or confirmed payment |
| Collection point | Selected physical address/location; its existence does not authorize a visit |
| Collection event | Captured operational fact, potentially pending reconciliation |
| Payment | Accepted and posted financial event with component allocations |
| Cash settlement | Transfer/reconciliation of collector money, not a second borrower repayment |
| Risk case | Evidence-backed tenant-local review, not a public blacklist |

## Core relationships and lifecycle

A tenant has memberships, branches, teams, borrowers, loan products and accounts. A borrower can have multiple loans, contacts, addresses and documents. A loan has approved terms, a schedule, disbursement evidence and allocations. A dated route has scoped assignments and stops. A collection event may produce an accepted payment or an incident requiring reconciliation.

Loan lifecycle: `Draft → Submitted → Reviewed → Approved → Disbursed → Active → Closed`, with explicit rejection/cancellation branches. Delinquency is a calculated condition. Approval is not delivery of funds. Reported business parameters do not become approved product rules until financial and compliance gates pass.

A repayment frequency and a field-contact frequency are different concepts. The contractual due date, lawful visit availability and cash confirmation each have their own state and evidence.

## Roles, permissions, and organization

Use **RBAC + resource scope**: a role alone is insufficient. Every action also checks tenant membership, branch/team, route assignment, record visibility, and operation state.

| Role | Main responsibilities | Restrictions |
|---|---|---|
| Platform operator | Tenant lifecycle, service health, subscription administration | No default access to borrower documents or financial records; time-limited, approved support access only |
| Tenant owner | Business administration, loan approval, portfolio, staff, configuration | Tenant only; sensitive changes require reauthentication and audit |
| Tenant administrator | Borrower administration, users, routes, operational settings | Cannot self-grant ownership or bypass configured financial approvals |
| Supervisor | Assigned teams/routes, collection incidents, cash review, risk review | Approval capability must be explicitly granted; cannot approve their own exceptions |
| Collector | Assigned borrower essentials, today's route, visits, payment capture, receipts | No unrestricted borrower export, bulk identity document download, term changes, or payment reversal |
| Finance staff | Disbursements, settlements, reconciliation, authorized exports | No identity/security administration by default |
| Auditor | Read-only financial evidence and history within approved scope | No modifications; document access separately permissioned |

Hierarchy: `Tenant → Branch → Team → Route assignment`. Supervisors oversee teams, and collectors can have dated assignments to more than one route. Use tenant memberships, not global role columns on user records.

Illustrative permissions: `borrower.read_assigned`, `loan.approve`, `payment.capture`, `payment.reverse_request`, `cash.reconcile`, `risk.review`, `report.export`, `settings.financial.update`.

## Related documents

- [Financial rules](financial-rules.md)
- [Operations](operations.md)
- [Security](security.md)
- [Database](database.md)
