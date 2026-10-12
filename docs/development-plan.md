# Development and VPS Delivery Plan

> **Status:** Execution plan v0.2 — engineering foundation authorized; business vertical slices still require the applicable authorization gates in [the roadmap](roadmap.md).
> **Updated:** 2026-10-11.

This plan turns the existing product, financial, security, offline, and deployment documents into an ordered delivery program for **cobranzapp**. The recommended path is a modular monolith, delivered in auditable vertical slices, and deployed to a hardened VPS with Docker Compose and Caddy.

## Executive plan

Build a narrow operational pilot first: one approved Colombian loan product, multi-tenant access, borrower records, controlled origination, collections, receipts, cash reconciliation, routes, and essential reports. Do not begin financial implementation until the product's legal, accounting, calendar, allocation, and exception rules are approved.

| Item | Planning baseline |
|---|---|
| Delivery horizon | 24–28 weeks after construction authorization |
| Recommended team | 1 technical lead/backend, 1 backend, 1 web, 1 mobile, 1 QA/automation; part-time product/UX, DevOps, and Colombian legal/accounting reviewers |
| Architecture | TypeScript modular monolith; separate web, mobile, API, worker, identity, PostgreSQL, and object-storage boundaries |
| Deployment | Immutable containers on a production VPS; Caddy ingress; private service networks; encrypted offsite backups |
| Release strategy | Internal environment → staging → controlled pilot → stabilization → production expansion |
| Pilot boundary | One country, currency, approved loan product, and reviewed operating policy; no AI, payment custody, credit bureau, or unconsented/public blacklist |

The calendar is a forecast, not a commitment. A smaller team should reduce parallel work rather than weaken testing or financial controls; expect roughly 32–40 weeks with two full-time engineers.

## Non-negotiable start gates

The user authorized repository, engineering foundation, CI/CD, and VPS work on 2026-10-11. Before borrower or financial vertical slices begin, record approval evidence for:

- Colombian legal/data/contact policy and the applicable credit category.
- One loan product: dated cash flows, charge classification, rate basis, calendar, rounding, allocation, partial/early/late/excess payment, reversal, and restructuring examples.
- Cash, bank, settlement, refund, receipt, and separation-of-duties workflows.
- Whether offline cash capture is required for the pilot, on which devices, and under what limits.
- Tenant structure, launch volume, providers, data regions, monthly operating ceiling, RPO, and RTO.
- Reviewed phone flows for collector, supervisor, owner/administrator, and finance roles.

These are not paperwork afterthoughts. Coding a financial engine before these rules are settled would encode guesses into balances, contracts, and collection behavior.

## Delivery principles

1. **Vertical slices over technical layers.** Each work unit includes contract, authorization, domain rule, persistence, UI, audit, and tests needed to make one behavior usable.
2. **Server-authoritative finance.** Clients may preview, but only the API posts payments, allocations, journals, and confirmed receipts.
3. **Isolation by construction.** Tenant context, resource scope, composite tenant keys, RLS, storage prefixes, background jobs, exports, and logs are tested together.
4. **Immutable financial history.** Posted records are corrected with compensating entries, not edits or deletion.
5. **Offline capture is reconciliation.** A device records evidence and a provisional state; it does not become an autonomous accounting system.
6. **One deployable monolith first.** Keep domain modules explicit without introducing microservices, Kubernetes, Redis, or a warehouse before measured need.
7. **Operations are part of the feature.** Health checks, audit events, metrics, backup behavior, and runbooks ship with the use case they protect.
8. **Small reviewable changes.** Commits and PRs represent complete work units with their tests and documentation; split changes that become difficult to review.

## Target repository and environments

Create the proposed structure only after authorization:

```text
apps/mobile/                 Expo React Native application
apps/web/                    Next.js management console
services/api/                Fastify HTTP application
services/worker/             Durable jobs and outbox consumers
packages/contracts/          OpenAPI schemas and generated clients
packages/domain/             Framework-independent financial/domain rules
packages/design-tokens/      Shared visual tokens, not shared widgets
database/migrations/         Reviewed forward SQL migrations
infrastructure/              Images, Compose, Caddy, backup and deploy scripts
docs/                        Product, architecture, runbooks and ADRs
```

Use four isolated environments:

| Environment | Purpose | Data rule |
|---|---|---|
| Local | Fast development and component/integration tests | Generated fixtures only |
| CI | Repeatable build, test, migration, and security checks | Ephemeral generated data |
| Staging | Release candidate, device/E2E, migration and restore rehearsal | Synthetic or approved anonymized data only |
| Production | Controlled pilot and live operations | Real data with audited access |

Staging and production require different databases, identity clients, storage prefixes/buckets, credentials, keys, and backup policies. Prefer a separate staging host; if the budget initially prevents it, document the risk and enforce hard network/resource separation.

## Phased implementation roadmap

Durations assume the recommended team and include review/testing. Phases overlap only after their dependency and exit gates pass.

### Phase 0 — Product and policy closure (2–4 weeks, no application code)

**Objective:** replace unresolved business assumptions with approved, testable rules.

**Work units**

- Interview at least five lenders and observe at least two permitted collection days.
- Approve the pilot persona, tenant hierarchy, volume envelope, borrower purpose/category, and supported devices.
- Produce a financial acceptance pack with dated golden examples and balanced posting templates.
- Approve Colombian data, identity-document, contact/visit, retention, complaint, and borrower-rights policies.
- Decide offline scope, object storage, map/notification providers, hosting budget, RPO/RTO, and support ownership.
- Review clickable phone-first flows and all pending/denied/offline/reconciliation states.
- Convert the logical database blueprint into a reviewed physical-schema proposal and ordered backlog.

**Exit evidence:** signed decision log, approved golden examples, UX review record, threat model, provider/data-region decision, and explicit construction authorization.

### Phase 1 — Engineering and delivery foundation (2 weeks)

**Objective:** make every later slice buildable, testable, observable, and releasable.

**Work units**

- Initialize the monorepo, formatting, linting, type checking, test runners, dependency update policy, and architecture boundaries.
- Establish OpenAPI-first contracts, generated clients, stable error envelopes, correlation IDs, money-as-string and date/time conventions.
- Create multi-stage non-root images, `.dockerignore`, health/readiness endpoints, local Compose, and environment validation.
- Provision CI for unit/integration/E2E checks, image build and scan, migration verification, and signed/immutable image tags.
- Create baseline PostgreSQL migrations, separate migration/runtime roles, RLS test harness, audit/outbox primitives, and generated seed data.
- Add structured redacted logging, metrics, error tracking, and secret/key rotation runbooks.
- Prove backup, WAL archive, and isolated restore on staging before feature data is valuable.

**Exit gate:** a tagged empty-system release can be deployed and rolled back in staging; a database restore is timed and verified; no service runs as database owner or exposes PostgreSQL publicly.

### Phase 2 — Tenancy, identity, authorization, and onboarding (3 weeks)

**Objective:** establish the security boundary before storing borrower or financial data.

**Work units**

- Integrate OIDC: mobile authorization code + PKCE and server-managed web sessions.
- Implement tenant, membership, invitation, branch/team, RBAC plus resource-scope checks, device sessions, and support-access approval.
- Apply transaction-local tenant context, forced RLS, composite tenant keys, permission-aware fields, and scoped storage/job conventions.
- Build workspace creation, policy-gated onboarding, branding/settings versions, and operational activation.
- Add MFA/reauthentication for sensitive administration and comprehensive audit events.

**Required tests:** adversarial tenant IDs, missing context, pooled-connection reuse, owner/bypass roles, expired invitation, revoked membership, scope changes, support access expiry, and cross-tenant objects/jobs/exports.

**Exit gate:** independent security review finds no path for one pilot tenant to access another tenant's records, files, jobs, analytics, or identifiers.

### Phase 3 — Borrower dossier and manual documents (3 weeks)

**Objective:** create a controlled, role-filtered borrower record without AI or unsupported authenticity claims.

**Work units**

- Borrower identity, contacts, permitted addresses, consents/lawful-basis evidence, notes, and lifecycle.
- Tenant-keyed HMAC lookup plus encrypted original identity values and key-version support.
- Private upload authorization, quarantine, media/hash/size checks, scanning, retention state, and short-lived access.
- Manual document entry, correction history, reviewer workflow, tenant-local deduplication, and data-subject request tracking.
- Collector/supervisor dossier views limited to assigned operational data.

**Exit gate:** uploads never become public; PII is absent from telemetry; duplicate/correction/access cases pass with real roles; retention and subject-request workflows have an accountable owner.

### Phase 4 — Loan origination and financial core (4 weeks)

**Objective:** implement exactly one approved loan model with auditable accounting.

**Work units**

- Versioned loan product, regulatory source/check, application, review, approval, contract snapshot, disbursement, and lifecycle transitions.
- Decimal schedule engine with persisted dates, calendar, rounding/remainder, and component allocation rules.
- Ledger accounts, atomic balanced journal posting, disbursement templates, capital/expense separation, and immutable history.
- Idempotency key plus canonical request fingerprint, stable locking order, concurrency controls, and outbox event creation.
- Mobile/web term presentation that distinguishes nominal amount, charge, net delivery, total repayment, and review state.

**Required tests:** approved golden schedules; decimal/property tests; missing/expired compliance data; double approval/disbursement; concurrent commands; unbalanced journal rejection; charge withheld versus financed; rollback and migration compatibility.

**Exit gate:** every displayed balance is reproducible from approved terms and posted journals; the reviewed golden examples reconcile exactly to schedules, cash movement, and accounting entries.

### Phase 5 — Collections, receipts, and cash control (4 weeks)

**Objective:** safely move from obligation to confirmed collection and collector settlement.

**Work units**

- Online payment capture, exact allocations, immutable confirmed receipt, and duplicate/replay protection.
- Partial, early, late, excess, rejected, and reversed payment workflows using approved policies.
- Cash-session opening/closing, collector cash account, settlement submission, finance review, discrepancy incident, and treasury transfer.
- Verified-bank evidence/reconciliation boundary; screenshots remain evidence, not settlement proof.
- Approval/reauthentication for reversals, refunds, write-offs, and sensitive corrections.

**Required tests:** timeout retry, idempotency-payload mismatch, two collectors, same obligation concurrency, overpayment credit/refund, compensating reversal, cash settlement not reducing debt twice, receipt numbering, and ledger reconciliation.

**Exit gate:** a complete borrower payment can be traced from command to allocation, journal, receipt, cash custody, settlement, audit, and report projection without mutable posted data.

### Phase 6 — Routes and field reliability (3–4 weeks)

**Objective:** make the approved collection workflow usable on supported phones and unreliable networks.

**Work units**

- Route templates/runs, assignments, ordered stops, operational interactions, promises, visit/contact eligibility, and supervisor exceptions.
- Collector Today/Routes/Borrowers flows with freshness, scope, address, balance, and action-restriction states.
- If approved for the pilot: encrypted scoped cache and event queue, provisional acknowledgment, bounded idempotent sync, per-event outcomes, conflicts/incidents, tombstones, and remote scope removal.
- Device revocation, expired cache, logout with pending cash, lost-device procedure, and manual retry/recovery.

**Required tests:** two devices, duplicate retry after timeout, wrong clock, revoked collector offline, reassignment, stale schedule, closed cash session, lost phone, expired cache, and rejected captured cash that must retain evidence.

**Exit gate:** a supervised field rehearsal completes a route and cash settlement under the approved connectivity profile with no lost event, false confirmed receipt, or unauthorized borrower disclosure.

If offline collection is not approved for the pilot, ship an explicit online-only state that blocks capture safely; do not silently imitate offline reliability.

### Phase 7 — Reporting and deterministic automation (3 weeks)

**Objective:** give owners and supervisors reproducible operational visibility without bypassing the ledger or authorization model.

**Work units**

- Versioned portfolio, due, collection, cash, discrepancy, income, and operating-result definitions with filters and cutoff labels.
- Rebuildable tenant-scoped projections and report-to-ledger reconciliation.
- Permissioned, expiring, audited exports.
- Typed scheduled/event rules for due tasks, cash discrepancy, promises, reports, reminders, retries, and dead-letter incidents.
- Execution history, explainable trigger evidence, approval gates, per-tenant fairness, pause/disable, and retry limits.

**Exit gate:** identical inputs and versions reproduce the same report/rule result; principal is never reported as income; failed automation cannot block core collection posting.

### Phase 8 — Hardening, VPS launch, and controlled pilot (3 weeks)

**Objective:** prove the complete system and operating model before live expansion.

**Work units**

- Full threat-model review, tenant-isolation suite, dependency/container scan, rate limits, upload abuse tests, and access-log review.
- Representative load tests for API, reports, jobs, identity, PostgreSQL pool/locks, storage, and backup IO.
- Accessibility and device matrix for collector/supervisor/owner flows; verify long names, large amounts, large text, keyboards, and offline/pending states.
- Production DNS/TLS, firewall, SSH keys, runtime secrets, resource limits, alerts, dashboards, offsite backups, and certificate/disk/backup monitoring.
- Staging migration rehearsal, production backup, approved release, smoke checks, monitoring window, and documented rollback/forward-fix decision.
- Isolated full restore drill covering PostgreSQL, identity, documents, keys, receipts, offline events, and ledger/bank reconciliation.
- Train pilot users and run incident, support-access, lost-device, reconciliation, and borrower-correction exercises.

**Exit gate:** go-live checklist signed by product, engineering, operations, security, finance/accounting, and legal/compliance owners; measured restore meets approved objectives; no unresolved severity-1/2 issue.

### Phase 9 — Pilot stabilization and expansion decision (4 weeks after launch)

**Objective:** measure real operations before adding product breadth.

- Start with one or two tenants and capped users/loans.
- Run daily reconciliation and support review during the first week, then reduce only when evidence supports it.
- Measure sync conflicts, payment/reversal defects, cash discrepancies, report reconciliation, p95 latency, job backlog, backup lag, disk growth, user task time, and support load.
- Fix critical workflow problems before adding providers, products, automation, or more tenants.
- Decide whether to scale vertically, separate PostgreSQL, add API/worker replicas, or keep the initial topology based on measured contention.

## Production VPS blueprint

```text
Internet
   |
 Caddy :443                 Only public application ingress
   |------------------ web
   |------------------ API
                         |---- PostgreSQL (private network + volume)
                         |---- worker
                         |---- Keycloak (separate DB/role)
                         |---- private S3-compatible object storage

Off-host security domain: encrypted DB/WAL backups, object versions,
identity backup, configuration manifests, and key-recovery material.
```

### Baseline host and controls

- Start sizing validation at 4 vCPU, 8–16 GB RAM, and SSD storage with explicit disk/IO alarms; load tests, retention, Keycloak, and report behavior determine the final size.
- Expose only `80/443` publicly; restrict SSH to keys and approved networks. Keep PostgreSQL, identity administration, metrics, and container control endpoints private.
- Run pinned image digests as non-root where supported, with dropped capabilities, read-only filesystems where practical, bounded CPU/memory, restart policies, and health checks.
- Keep runtime secrets outside Git and image layers. For Compose, use root-owned `0600` secret files mounted read-only or an approved external secret store; document rotation and disaster recovery.
- Do not mount the Docker socket into application containers. Do not use `latest` tags. Do not run irreversible migrations on API startup.
- Store documents outside the database through the approved private S3-compatible provider. Neither documents nor backups may depend only on the production VPS disk.

### Release sequence

1. CI runs static checks, unit/property tests, real-PostgreSQL integration tests, web/native E2E tests, migration checks, and image/dependency scans.
2. CI publishes an immutable image tagged with commit SHA and records its digest and schema compatibility.
3. Staging takes a backup, applies the reviewed migration with the migration role, deploys the digest, and runs smoke/E2E checks.
4. An authorized operator promotes the exact digest to production during a monitored window.
5. Production backup health is confirmed, migration is applied separately, services are deployed, and smoke checks exercise login, tenant context, one read path, job processing, and monitoring.
6. Observe error rate, latency, DB locks/pool, outbox age, disk, and authentication before closing the release.
7. Roll back the image only if schema-compatible. Otherwise use an approved forward fix or restore/reconciliation plan.

### Backup and recovery plan

- PostgreSQL: encrypted base backups plus continuous WAL archiving; proposed target RPO ≤15 minutes and RTO ≤4 hours until measured and approved.
- Objects: provider versioning or protected copies with retention and restore verification.
- Identity/configuration: Keycloak data/config, tenant-independent deployment manifests, secret/key recovery instructions, and credential inventory.
- Access: backup deletion credentials are separate from application/VPS credentials.
- Verification: automated archive-lag/failure alerts plus periodic isolated restore drills. A successful upload is not a successful backup until restoration and reconciliation are proven.

## Quality gates and test strategy

| Layer | Minimum evidence |
|---|---|
| Domain | Unit and property tests for money, calendars, allocations, state transitions, and permissions |
| Database | Real PostgreSQL migrations, constraints, RLS, transaction/concurrency, posting, and query-plan tests |
| Contracts | OpenAPI compatibility, generated-client compile, stable error, money/date, pagination, and idempotency tests |
| API/worker | Integration tests for authorization, audit, outbox, retries, dead letters, and provider failure |
| Web | Component accessibility plus browser E2E for administration, finance, and reporting paths |
| Mobile | Supported-device E2E for route, payment, receipt, sync, secure storage, and recovery paths |
| Security | Tenant adversarial suite, upload abuse, session/revocation, export/object/job isolation, and dependency/image scan |
| Operations | Deployment smoke, alert firing, backup/restore, migration, rollback/forward-fix, and incident drills |

A feature is complete only when its happy path, denied path, failure/retry behavior, audit/observability, migration impact, documentation, and focused test evidence are present.

## Release milestones

| Milestone | Included | Excluded until later |
|---|---|---|
| M0 — Authorized blueprint | Approved rules, UX, physical schema, threat model, backlog | Application code |
| M1 — Secure platform | Foundation, tenancy, identity, onboarding | Borrower finance |
| M2 — Credit operations | Borrower dossier, one product, origination, ledger | Field/offline and advanced reports |
| M3 — Collection pilot candidate | Payments, receipts, cash, routes, required offline behavior | Extra products/providers and autonomous features |
| M4 — Controlled VPS pilot | Reports, essential automation, hardening, restore proof, training | Broad rollout |
| M5 — Stable pilot | Measured reliability and reconciliation; expansion decision | Features unsupported by pilot evidence |

## Go-live definition of done

- [ ] All construction and launch gates have named approvers and attached evidence.
- [ ] One approved loan product passes every golden and exception example.
- [ ] Tenant, resource, file, job, export, analytics, and automation isolation tests pass.
- [ ] Posted payments reconcile through allocations, ledger, receipt, cash/bank, and reports.
- [ ] Field/offline behavior passes the approved device/network and conflict matrix.
- [ ] Colombian contact/visit and data policies are enforced before actions, not merely documented.
- [ ] Accessibility-critical collector, supervisor, owner, and finance flows pass review.
- [ ] Production uses immutable images, private service networks, least privilege, monitored TLS, and protected secrets.
- [ ] Offsite backups and a full isolated restore meet the approved measured RPO/RTO.
- [ ] Dashboards and alerts cover financial failures, isolation attempts, sync/reconciliation backlog, DB health, disk, certificates, jobs, and backups.
- [ ] Runbooks, support ownership, incident contacts, user training, and rollback/forward-fix procedures are exercised.
- [ ] Pilot scope and capacity caps are configured; deferred features remain disabled.

## Immediate next actions

1. Resolve the roadmap's next discovery item: the primary borrower funding purpose and resulting legal product category.
2. Commission Colombian legal/accounting review of the example pricing, documentation charge, contracts, contact/visit policy, and posting treatment.
3. Run lender/field validation and decide whether offline cash capture is a pilot prerequisite.
4. Approve one set of golden financial examples and phone-first flows.
5. Approve providers, data regions, budget, volumes, RPO/RTO, and the proposed stack.
6. Review the physical schema/backlog, then issue explicit construction authorization.

## Related documents

- [Product scope](product.md)
- [Application architecture](architecture.md)
- [Technology stack](stack.md)
- [Financial rules](financial-rules.md)
- [PostgreSQL model](database.md)
- [Offline synchronization](offline-sync.md)
- [Security](security.md)
- [Colombia compliance](compliance.md)
- [VPS deployment](deployment.md)
- [Risk and authorization gates](roadmap.md)
