# Approved Memberships — Pro and Ultra

> **Status:** Commercial scope confirmed by the owner on 2026-10-11. Public landing and audited per-tenant plan assignment are implemented; backend quota enforcement, billing, customer links and financial workflows remain unimplemented.

This document owns subscription prices, included capacity, the separate setup fee and plan-related business permissions. The subscriber is the company owner, not each employee or borrower. Both memberships apply per tenant and have the same core features.

## Commercial catalog

| Item | Pro | Ultra |
|---|---:|---:|
| Monthly membership, COP | 150,000 | 300,000 |
| Employee seats included in the monthly price | 5 | 50 |
| Additional owner seat | 1 | 1 |
| Total included staff users including the owner | 6 | 51 |
| Each additional employee, COP / month | 20,000 | 20,000 |
| Clients, maximum | 100 | 200 |
| Loans | Unlimited | Unlimited |
| Core features below | All included | All included |
| Priority support | Not included | Included |
| Company creation + onboarding, COP | 150,000 once | 150,000 once |

Employee seats can be distributed in any combination of allowed employee roles; there is no fixed collector/supervisor split. Both plans allow additional employee seats at COP 20,000 per person per month; 5 and 50 are included capacity, not hard employee ceilings. The owner does not consume an employee seat or incur an additional-seat charge. Borrower read-only links are not employee seats. Buying additional employees does not expand the client quota or grant Ultra's priority support to Pro. Unlimited loans does not remove the client quota, legal approval gates or operational security limits.

The setup/onboarding fee is separate from the monthly subscription and is charged per company, not per employee. If collected together with the first monthly payment without additional employees, the stated amounts sum to COP 300,000 for Pro and COP 450,000 for Ultra. Additional seats are recurring monthly charges, not an onboarding charge. These are arithmetic examples, not a tax or billing-cycle policy. No annual discount, free trial, SLA or additional setup charge on upgrade has been approved.

### Monthly employee add-ons

The owner confirmed the additional-seat policy on 2026-10-11. Count employees **excluding the included owner**:

`monthly COP = base monthly COP + max(0, employee count − included employee seats) × 20,000`

| Plan | Employees, excluding owner | Additional seats | Total monthly COP |
|---|---:|---:|---:|
| Pro | 5 | 0 | 150,000 |
| Pro | 6 | 1 | 170,000 |
| Pro | 7 | 2 | 190,000 |
| Pro | 8 | 3 | 210,000 |
| Ultra | 50 | 0 | 300,000 |
| Ultra | 51 | 1 | 320,000 |

An employee with several allowed roles is one user/seat, not a charge for each role. Activation of an additional seat must be an authorized commercial action, not an unlimited invitation that silently changes billing. Owner approval, purchased capacity, effective dates, proration and cancellation handling require the billing workflow before enforcement. No new overall employee maximum is defined by this policy.

## Included in both memberships

| Capability | Required scope |
|---|---|
| Customer and loan management | Customer records within the plan quota; unlimited loans for those customers |
| Internal blacklist / risk registry | Private, tenant-local records with evidence, review and role-scoped access; never a public or shared blacklist |
| Real-time analytics | Deterministic analytics over server-confirmed data; offline/pending movements remain visibly provisional |
| Routes | Assigned collectors, supervisors and operational points within authorized scope |
| Daily customer invoice / receipt | User-requested daily record of each customer's movements; receipt/report semantics must be settled before implementation |
| Updated internal customer profile and rating | Staff-authenticated view; the owner and authorized collectors/advisors access only their permitted scope |
| Unique passwordless customer link | Read-only view of that customer's loans, balances, payments and receipts; no internal rating or other customer data |
| Editable business rules, percentages and loan values | Owner-controlled policy; staff input amounts only within approved configuration |
| Loan approval | Collector submits a request; supervisor or owner authorizes it before activation/disbursement |

Ultra adds priority support. Its response times, support channels and operating hours remain undecided; the landing must not invent a 24/7 or guaranteed-response promise.

## Permissions and financial controls

| Operation | Who may perform it |
|---|---|
| Change lending percentages or percentage-based charges | Owner only, with audit and the existing financial/compliance gates |
| Configure lending products and business rules | Owner; non-owner editing of individual non-financial settings remains permission-specific |
| Enter a loan amount and prepare a request | Assigned collector, constrained by the current approved policy |
| Authorize a submitted loan | Supervisor or owner within assigned scope; no automatic collector approval |
| Read internal ratings/risk records | Owner and explicitly authorized internal personnel; never the public customer link |
| View a customer loan through its shared link | Possessor of the scoped bearer link, read-only and limited to that customer |

Approval must capture the exact amount, policy version, percentages and schedule being authorized. Changing a pending request invalidates its prior approval. A policy edit applies to future requests; approved/disbursed loan terms cannot silently change. Supervisor loan approval does not grant permission to edit percentages. The existing [financial rules](financial-rules.md) and [compliance gates](compliance.md) still apply: configurable does not mean unrestricted or automatically lawful.

The user mentioned an **advisor** as an internal rating reader. Current product roles are owner, supervisor, collector and customer; the advisor role/permission mapping is an explicit discovery item, not a newly implemented broad-access role. Supervisor access to ratings must also be explicitly scoped rather than inferred from the ability to approve loans.

## Internal view versus shareable link

An authenticated customer dossier and a passwordless customer view are different authorization surfaces. Do not make an internal dossier public just because staff share its URL.

- Generate a cryptographically random, unguessable bearer token scoped to one tenant and customer; do not use a sequential customer ID or document number as the secret.
- Serve a separate allowlisted response containing only the customer's permitted loan information. Never serialize internal rating, blacklist notes, staff notes, staff contacts or other customer records into public HTML/API responses, even when hidden in the UI.
- Support revocation, rotation and expiry. The exact lifetime and renewal behavior remain open; do not promise permanent links.
- Use HTTPS, no indexing, no shared caching, a restrictive referrer policy and redacted logs. Avoid third-party trackers on tokenized customer pages.
- Rate-limit token lookups and return non-enumerating failures. Link possession is authorization to the bounded view, not proof of customer identity; forwarding is a disclosure risk.

These are design requirements, not implemented controls in the landing update. Staff accounts still require authentication; "without password" applies only to the explicitly scoped customer view.

## Open implementation decisions

1. Whether the customer quota counts all records, active borrowers or another explicit population. The landing says "up to 100/200 customers" and does not silently narrow it to active borrowers.
2. Additional-seat activation, owner approval and quota treatment for pending invitations, suspended users and concurrent invitations. Enforce included plus purchased capacity atomically on the server, not only in the UI; adding an invitation must not silently authorize billing.
3. Advisor mapping, who can issue/revoke customer links and link validity periods.
4. Whether the daily document is a payment receipt, a daily account report or a separately reviewed invoicing function. No electronic tax-invoicing integration is promised or implemented.
5. Billing dates, tax treatment, payment method, failed payments, cancellation, prorating, upgrade/downgrade and over-quota behavior. Do not delete historical customer/loan evidence to satisfy a downgrade.
6. Support service targets and whether dual-role users may approve requests they originated. Preserve maker/approver audit attribution in any case.

## Implementation and verification boundaries

- Public catalog: `apps/web/src/data/memberships.ts`; base prices, included seats, the COP 20,000 recurring employee add-on and customer limits are tested and reused in landing cards and pricing FAQ. `calculateMembershipMonthlyPrice` is a commercial estimate, not a billing or entitlement enforcement service.
- Platform assignment: every newly created tenant records `pro` or `ultra`. The developer can correct that assignment with recent password confirmation, and each change is audited with its previous value, next value and catalog version. A plan is required before activating a new tenant.
- Assignment is commercial metadata only. It does not charge the tenant, buy additional seats, enforce customer limits, determine taxes, prorate a cycle or represent payment status.
- Public presentation: `PricingSection`, navigation and footer links, a visible pricing entry point, per-plan enquiry links and a separate setup-fee block.
- This delivery does not implement database subscription cycles, quota enforcement, billing or live lending authorization. Do not infer that assigning a plan enabled those features.
- Before backend implementation, map this approved catalog into server-controlled entitlements and versioned subscription terms; verify isolation, over-quota concurrency, approved rate permissions and public-link data minimization.

## Related documents

- [Product scope](product.md)
- [Domain](domain.md)
- [Financial rules](financial-rules.md)
- [Security](security.md)
- [Field operations](operations.md)
