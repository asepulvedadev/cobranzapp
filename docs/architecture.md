# Application Architecture and API Contracts

> **Status:** Planning draft v0.5 — not implementation authorization.
> **Updated:** 2026-10-11.

Owns module boundaries, dependency direction, runtime processes, repository proposal and integration contracts.

## Architecture and module boundaries

Use a **modular monolith** for transactional business logic, with separate API, worker, identity provider processes. These process boundaries do not imply a microservice per business module.

The public marketing surface and the private tenant system are separate application concerns. The
public site contains product education, original resources and lead contact. The private system
requires authentication and exposes only the four product roles: tenant owner, supervisor,
collector, and customer. Internal platform operations are service administration, not a fifth
tenant-facing role.

```text
Android / iOS                 Responsive web console
       \                              /
        ---- TLS reverse proxy -------
                      |
               Application API -------- OIDC identity provider
                      |
        Domain use cases + authorization
                /             \
       PostgreSQL          Private object storage
       ledger + outbox           |
                |          manual document review
         Background worker
                |
         Versioned rules + schedules
                |
         Reports / alerts / authorized operational tasks
```

| Module | Owns |
|---|---|
| Tenancy and access | Workspace lifecycle, memberships, invitations, scoped authorization |
| Configuration | Branding, onboarding, business policy versions |
| Borrowers | Identity, contacts, addresses, consent evidence, dossier |
| Documents | Metadata, uploads, quarantine, manual identity review, retention |
| Loan origination | Product versions, applications, approvals, contract snapshots |
| Loan servicing | Schedules, obligations, allocations, delinquency, restructuring |
| Collections and routes | Assignments, route runs, interactions, captured collection events |
| Treasury and ledger | Disbursement, payment posting, accounts, journals, settlements, reconciliation |
| Risk registry | Evidence-backed cases, restrictions, disputes, review |
| Analytics | Rebuildable projections, metric definitions, controlled exports |
| Rule automation | Versioned conditions/actions, schedules, execution logs and approval-gated tasks |
| Audit and notifications | Business audit, delivery attempts, retention-safe notifications |

Within each module: domain rules → application use cases → ports → database/HTTP/provider adapters. Domain logic must not depend on Next.js, Fastify, Drizzle, or a map provider. Modules call explicit use cases, not each other's internal tables ad hoc.

Current repository layout:

```text
apps/mobile/        apps/web/         services/api/
services/worker/    packages/contracts/
infrastructure/     docs/
```

`packages/domain`, `packages/design-tokens`, and `database/migrations` will be added with the first approved vertical slices rather than as empty abstractions.

Share contracts, pure rules where safe, and visual tokens; do not force mobile/web widget sharing. Client-side loan previews are advisory; the server recomputes and authorizes all financial results. Scheduled reports and notification failures cannot block collection posting.

### API and integration contract

- Versioned `/v1` API with generated documentation, cursor pagination, permission-aware field filtering, and explicit money/timezone formats.
- Representative commands: create borrower draft, review identity data, submit/approve/disburse loan, capture payment, request reversal, open/close cash session, submit settlement, assign route, sync events, request report, schedule an approved automation rule.
- Use command endpoints for financial transitions; no unrestricted CRUD for balances, posted payments, or risk approvals.
- Return stable error codes such as `SCOPE_DENIED`, `POLICY_NOT_APPROVED`, `IDEMPOTENCY_CONFLICT`, `STALE_VERSION`, and `RECONCILIATION_REQUIRED` with correlation IDs.
- Upload through short-lived scoped authorizations; asynchronously inspect files before reviewer access.
- Process durable jobs with leases, bounded retries, dead-letter review, and idempotent consumers. External delivery remains at-least-once unless provider guarantees allow stronger semantics.
- Any future payment provider callback requires signature/replay checks and transaction reconciliation. Notification delivery is separate from debt posting.

### Implemented contract baseline

The shared package `@cobranzapp/contracts` is the source of truth for health, stable error,
authenticated-user, tenant-membership, session and MFA payloads. The API imports the same Zod
request schemas that clients compile against, so username/email login and account-security
validation cannot drift into separate web and server definitions.

The API publishes its current OpenAPI 3.1 document at `/v1/openapi.json`. The documented surface
covers service status, the complete first-party web authentication lifecycle, and the developer's
paginated platform-audit query. Administrative and business operations must be added to the document
together with their vertical slice; the current document must not be represented as coverage of
endpoints that it does not list.

## Related documents

- [Domain](domain.md)
- [Stack](stack.md)
- [Database](database.md)
- [Financial rules](financial-rules.md)
- [Offline synchronization](offline-sync.md)
