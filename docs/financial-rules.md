# Loan Calculations and Financial Integrity

> **Status:** Planning draft v0.5 — preview engine implemented; posting and disbursement remain gated.
> **Updated:** 2026-10-12.

Owns nominal/net amounts, charge/interest treatment, schedule arithmetic, allocations, decimal/ledger invariants and approval boundaries.

## Reported loan example — discovery only, not an approved product

The user provided this example on 2026-10-11. Record it accurately; do not disguise the retained charge, declare it lawful, or activate the stated pricing for production.

| Component | Formula / described meaning | COP |
|---|---|---:|
| Nominal contractual amount | User's stated base | 100,000 |
| Documentation charge withheld | 10% × nominal amount | 10,000 |
| Net money delivered | Nominal amount − withheld charge | 90,000 |
| Described flat interest | 30% × nominal amount for the reported loan term | 30,000 |
| Scheduled future repayments | Nominal amount + described interest | 130,000 |
| Repayments minus net money delivered | Total future repayments − cash delivered | 40,000 |

The COP 40,000 difference is a borrower cash-flow cost, not automatically net lender profit or legally classified interest. Actual documentation costs and accounting recognition remain unverified. The 10% charge is already deducted at origination in the example; do not add it again to the COP 130,000 repayment total.

For the single end-of-month payment, the cash-flow difference relative to the COP 90,000 actually received is `40,000 / 90,000 = 44.444…%` over that loan period. This is not an annual rate or an amortizing-schedule IRR. Daily and fortnightly cash flows need their own date-based effective-rate calculation; the same total paid at different dates is not the same effective financing cost.

### Reported repayment variants

| Variant | Description from user | Arithmetic allocation of COP 130,000 |
|---|---|---|
| Daily | Divide across 30 days/installments | 30 installments averaging COP 4,333.333… |
| Fortnightly | Divide into two fortnightly installments | 2 × COP 65,000 |
| Monthly | Pay one month after origination | 1 × COP 130,000 |

No calendar has been approved. Thirty consecutive days, thirty permitted collection days and one calendar month are not equivalent. “Fortnightly” may mean every 15 elapsed days or fixed semi-monthly dates; confirm exact date semantics and first due date. A daily due date must not automatically generate a daily home/work visit.

### Proposed exact rounding examples, pending business approval

- Cent precision: 29 installments of COP 4,333.33 plus COP 4,333.43 = COP 130,000.00.
- Whole-peso field cash: 29 installments of COP 4,333 plus COP 4,343 = COP 130,000.
- Choose one rounding/remainder policy and disclose the final installment before approval; never silently charge COP 4,334 for all 30 days (that would total COP 130,020).
- Component-level allocations must also reconcile exactly; equal installment totals do not determine the principal/interest/fee allocation policy.

### Required amount and term distinctions

Persist nominal contractual amount, charge amount/rate/basis, withheld amount, net disbursement, described interest amount/rate/period/basis, term/calendar, repayment frequency/count, scheduled total, rounding policy, and regulatory review result separately. “Principal” alone cannot represent all these values.

Cash/bank outflow is the actual net amount delivered. How the nominal receivable and retained documentation amount are posted depends on approved accounting and legal classification; do not invent fee income or falsely record COP 100,000 physically delivered. Store approved posting templates before activating the product.

Use configurable, jurisdiction-approved products rather than hardcoding 10% or 30%. Until compliance review and applicable-category checks pass, the described example remains planning/simulation evidence, not an enabled live product. Preserve historical facts where lawfully required, without using them as authorization for new lending.

## Configurable owner preview

The owner or supervisor can adjust a product while it is still a draft. The catalog supports:

- Daily, weekly, fortnightly and monthly due dates.
- Flat total interest, simple interest per period on the opening balance, or effective annual interest converted to the selected frequency.
- A configurable documentation charge withheld from the nominal amount and shown separately as net disbursement.
- Exact COP-cent output with the remainder absorbed by the final installment.
- Monthly dates that preserve the end of month (for example, January 31 → February 28).

The web panel exposes **Ajustar intereses y cobro** for drafts and a non-binding **Ver proyección de cuotas** action. The API endpoint `/v1/tenants/{tenantId}/loan-products/{productId}/schedule-preview` only calculates a preview; it never creates a debt, journal, receipt, payment or disbursement. Editing a draft resets its compliance state and requires the product to be reviewed again.

This preview is deliberately not the final financial engine. Before activation, the owner and legal/accounting reviewers must approve the rate basis, day-count convention, first due date, rounding policy, component allocation, early/late/partial/overpayment handling and posting templates. Approved terms must be snapshotted before any money movement is enabled.

### Accounting and loan invariants

- Money uses `numeric(20,2)` for the proposed single-currency pilot and decimal arithmetic; API money values are strings, never JavaScript binary floating-point numbers. Scale must be reviewed before supporting currencies with other minor units.
- Rates use explicit decimal units, basis, effective dates, day-count convention, and rounding policy. No unspecified “20%” field or baked-in assumed lawful interest rate.
- Choose exactly one initial interest/amortization model with legal/accounting approval. Flat interest and declining-balance interest are not interchangeable; final choice remains open.
- Separate agreed interest, accrued/earned interest, due interest, collected interest, fees, outstanding principal, and borrower credit. Total collections are not profit.
- Freeze approved terms and schedules; allocations identify installment/component and policy version. Define early payment, partial payment, overpayment, holiday handling, missed payment, and rounding remainder behavior before coding.
- Double-entry journals must balance per tenant and currency; principal disbursement, collection, treasury transfers, fees, write-offs, and reversals have reviewed posting templates.
- Posted journals cannot be updated/deleted; draft journals may be edited before posting. A database-enforced posting routine/deferred validation checks multi-line balance atomically; a single-row `CHECK` is not enough.
- Correct posted payments through authorized compensating entries and reversal references. Restrict deletion/cascades on posted financial history.
- Every disbursement/payment command has a unique idempotency key and canonical request fingerprint. A retry returns its recorded result; reusing a key with a different payload is rejected.
- Lock the relevant loan/account state in a stable order, recompute eligibility, and commit payment, allocations, journal, receipt metadata, audit event, and outbox event atomically.
- Cash collection credits the borrower's obligation and increases collector cash held. A later collector-to-treasury transfer must not reduce the loan a second time.
- Bank screenshots remain pending until verification. Overpayments go to explicitly managed borrower credit or a reviewed refund workflow, not silent negative principal.
- Store capital contributions/withdrawals and operating expenses separately from revenue. Lender net-return reporting requires an approved expense and recognition model; no unsupported investment-return promise.

## Related documents

- [Approved membership and owner-only percentage permissions](memberships.md)
- [Compliance gate](compliance.md)
- [Database representation](database.md)
- [Analytics definitions](analytics-automation.md)
- [Field cash operations](operations.md)
