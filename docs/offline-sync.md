# Offline Capture and Reconciliation

> **Status:** Planning draft v0.4 — not implementation authorization.
> **Updated:** 2026-10-11.

Owns intermittent-connectivity behavior, event queue outcomes, conflict handling, device recovery and authoritative synchronization boundaries.

### Offline synchronization, if enabled

Treat this as **offline capture with server reconciliation**, not autonomous offline accounting or generic last-write-wins replication.

| Offline allowed | Online required |
|---|---|
| Read authorized cached route/borrower essentials | Loan approval/disbursement and term changes |
| Record a permitted visit or promise-to-pay event | Final payment allocation and confirmed receipt |
| Capture a physical-cash event within approved offline policy | Reversal, write-off, cash settlement approval |
| Save document/borrower drafts with expiry | Final identity verification and risk restriction |

1. Before departure, authenticate, download a scoped route snapshot, and establish permitted offline limits/cash session context.
2. Persist event UUID, tenant/user/device, loan, amount/method, observed schedule version, client event time, and local sequence in an encrypted queue before showing success.
3. Mark captured cash **Pending reconciliation** and issue a provisional reference. Preserve the physical-cash fact independently of any stale loan calculation.
4. When the app can connect, send bounded batches through an idempotent command endpoint; foreground/manual retry is always available. Mobile background execution is opportunistic, not guaranteed.
5. Server verifies current membership, assignment history, cash context, versions, replay limits, and current obligation; it records receipt time independently of the device clock.
6. Return per-event outcomes: accepted, already accepted, conflict requiring review, or authorization/validation incident. Transport acknowledgment is not financial acceptance.
7. A valid captured-cash event against a closed/reassigned loan is not discarded. Resolve through an authorized unapplied-cash/borrower-credit or correction workflow, retaining evidence and provisional reference.
8. Return authoritative balances, changed assignments, tombstones, and scope removals. Queue entries are removed only after durable server outcome and required incident retention.

Explicit test cases: two devices collecting one obligation, duplicate retry after timeout, wrong device clock, revoked collector while offline, route reassignment, lost phone, closed cash session, expired cache, and logout with unsubmitted cash. Recovery rules and legal validity of provisional acknowledgment remain open launch gates.

## Related documents

- [Field operations](operations.md)
- [Financial rules](financial-rules.md)
- [Security](security.md)
- [API contracts](architecture.md)
