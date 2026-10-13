# Product, Offer and Scope

> **Status:** Planning draft v0.6 — not implementation authorization.
> **Updated:** 2026-10-11.

Owns the business problem, customer, product boundaries, confirmed requirements and assumptions.

## Executive proposal

**Confirmed application name:** cobranzapp. The user approved the isotype and revised bold geometric lettering. Separate transparent files are available in [the application asset pack](../assets/brand-app/README.md). The engineering/deployment foundation was authorized on 2026-10-11; financial product activation remains blocked by the approval gates below.

Build a mobile-first, multi-tenant loan portfolio and collection management SaaS for independent lenders. Each lending business manages its borrowers, loans, collectors, supervisors, routes, cash reconciliation, documentation, risk records, and analytics in an isolated workspace with its own branding and settings.

**Product promise:** Know who owes what, who collected it, where the money is, and which action needs attention—with auditable numbers rather than spreadsheets or chat messages.

**Latest scope change:** The user explicitly removed generative and autonomous AI. All operations and deep analytics are deterministic; deterministic Tesseract OCR may suggest document fields, but an authorized person must correct and confirm them. Hermes, LLMs, biometrics and authenticity models remain excluded.

This is a lending operations product, not an investment marketplace. The initial scope does not include raising public funds, pooled investments, promised investor returns, a banking wallet, or custody of customer money. Any expansion into those activities requires separate product and legal review.

### Decision labels

- **Required:** Explicitly requested by the user.
- **Proposed:** Architecture or product recommendation; still requires approval.
- **Assumed:** Placeholder for planning, not a verified business fact.
- **Open:** Must be decided through discovery or validation.

| Topic | Status | Planning baseline |
|---|---|---|
| Gated construction | Required | Engineering/deployment foundation authorized; borrower and financial features require the roadmap's policy, legal, accounting, and workflow approvals |
| Mobile-first, multi-platform | Required | Proposed Android/iOS app plus responsive web console |
| Multi-tenancy | Required | Independent lending business = tenant |
| Branding, settings, onboarding | Required | Configurable workspace, shared application |
| PostgreSQL and VPS | Required | Self-hosted application and PostgreSQL |
| No generative/autonomous AI | Required — latest instruction | No Hermes, LLMs, agents, biometrics, authenticity models or automated decisions; deterministic Tesseract suggestions require human confirmation |
| First market | Confirmed by user | Colombia; other jurisdictions are outside the initial scope |
| Currency | Confirmed example | Colombian pesos (COP) |
| Locale and timezone | Confirmed by user | Colombian Spanish (`es-CO`), `America/Bogota` |
| Lending capital | Assumed | Lender's own capital; platform does not supply or hold it |
| Connectivity | Assumed | Intermittent connectivity for field collectors |
| Initial scale | Assumed | Pilot envelope: 10 tenants, 100 staff, 10,000 active loans |

### Latest discovery: reported lending workflow

The user describes COP 100,000 nominal credit, a 10% documentation deduction, COP 90,000 paid out, and COP 130,000 expected repayment. Reported payment frequencies are daily over 30 installments, two fortnightly installments, or one payment a month after origination. Collectors and supervisors physically visit the borrower point and need operational borrower/address information.

This is discovery evidence, not confirmation that the rate, charge, calendar or visits are lawful. Calculation details belong in [financial rules](financial-rules.md); launch restrictions belong in [compliance](compliance.md). No underwriting category is inferred from the small amount or collection cadence.

## Pain, audience, and offer

### Pain to validate

| Current problem | Consequence | Product response |
|---|---|---|
| Borrower data distributed across paper, spreadsheets, and chats | Duplicate records and incomplete history | Searchable borrower dossier with controlled documentation |
| Loan terms and balances calculated manually | Disputes, errors, unclear principal versus interest | Versioned loan terms, schedules, allocations, and ledger |
| Collections depend on collector reports | Delayed visibility and missing cash | Traceable collection events and daily cash reconciliation |
| Routes and supervision organized informally | Missed visits and unclear responsibility | Daily route assignments and supervisor exception queues |
| Risk records consist of informal blacklists | Incorrect restrictions and privacy exposure | Consent-gated shared verification network plus tenant-local review with evidence and correction |
| Decisions rely on total collections alone | Principal recovery mistaken for profit | Defined portfolio, cash, delinquency, and profitability metrics |

**Only paying customer:** The tenant owner. Supervisors, collectors, and end customers use
the workspace created by that owner; they are not separate subscribers.
**Supported product roles:** Tenant owner, supervisor, collector, and customer.
**Customer:** The person responsible for an obligation and recipient of receipts. A bounded
customer view for personal obligations and receipts is part of the target experience; it never
exposes the tenant's internal operation.

The public marketing site remains separate from the authenticated operational system. Public
content lives at the canonical domain, while sign-in is a distinct entry point that will hand off
to the private application once authentication is enabled.

### Approved membership offer

A business subscription for operational control, not a percentage of borrower payments. The owner confirmed two memberships, Pro and Ultra, a recurring charge for each employee above included capacity in either plan, and a separate one-time company creation/onboarding charge. Prices, included/purchased seats, customer limits, shared features, priority-support scope and owner-only percentage/loan-approval requirements are authoritative in [approved memberships](memberships.md). Billing policy, advisor mapping, quota-counting semantics and customer-link lifetimes remain open. Automated workflows use explicit rules; no AI subscription or inference cost is included. The landing presents this commercial scope; it does not implement backend entitlements or financial features.

### Validation evidence to collect

- Interview at least five lenders and shadow at least two collection days, subject to permission.
- Document actual cash handling, repayment cadence, loan contract examples, and exceptions using anonymized data.
- Measure current reconciliation time, missing-data frequency, collection errors, and willingness to pay.
- Validate the need for iOS, offline collection, borrower signatures, printing, and maps rather than assuming all are required at launch.

## Scope and release boundaries

| Release | Included | Explicitly deferred |
|---|---|---|
| First operational pilot | Tenant onboarding, the four approved roles, branding/settings, customer dossier, private document capture with assistive Tesseract OCR, one approved loan model, schedules, collections/receipts, route lists, cash reconciliation, consent-gated verification network, core dashboards, customer receipt view, audit trail | Automated credit approval, external credit bureau reporting, unconsented reputation sharing, native desktop apps |
| Field reliability and automation | Offline capture/reconciliation if validated as essential, manual document review, optional validated non-model barcode parsing, map provider integration, controlled notifications, imports, richer supervisor workflows | Guaranteed background sync, continuous employee tracking, fully autonomous collection |
| Deep analytics and systematization | Cohorts, trend reports, explicit exception thresholds, deterministic scenarios, scheduled reports and task workflows | AI, machine learning, automatic loan denial, unrestricted rule execution |
| Expansion after evidence | Payment integrations, borrower portal, advanced routing, multiple approved loan products, dedicated tenant infrastructure | Banking/custody or capital marketplace without separate approval |

If collectors cannot operate online during the pilot, offline functionality becomes a pilot prerequisite rather than a later enhancement. Decide this during discovery; do not silently ship an online-only field workflow.

## Related documents

- [Domain](domain.md)
- [Financial rules](financial-rules.md)
- [Roadmap and open decisions](roadmap.md)
