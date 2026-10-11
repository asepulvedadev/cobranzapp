# VPS Deployment and Recovery

> **Status:** Planning draft v0.4 — not implementation authorization.
> **Updated:** 2026-10-11.

Owns hosting topology, environment separation, delivery/migration operations, monitoring, backup/restore targets and cost hypotheses.

## VPS deployment, resilience, and operating plan

### Proposed topology

One dedicated initial application VPS: Caddy, web, API, worker, Keycloak, and PostgreSQL on private container networks, with persistent encrypted/protected volumes and independent backup credentials. Private document storage and offsite backups must not depend solely on the application VPS disk.

Provisional capacity hypothesis: 4 vCPU, 8–16 GB RAM, SSD storage sized from document/database retention, and an explicit disk growth alarm. This is not a sizing guarantee or price quote; measure memory/CPU/IO under the approved workload, including identity, backup, and reporting load. No GPU or model runtime is needed for the proposed application.

- Use separate staging and production databases, credentials, identity clients, storage prefixes/buckets, and secrets; preferably separate hosts. No live borrower data in development/staging without an approved anonymization process.
- Public ingress only through HTTPS; PostgreSQL and internal services are not publicly exposed. SSH restricted by keys and network controls; no open DB administration endpoints.
- Build images in CI, pin digests, run non-root where supported, drop capabilities, restrict mounts/network egress, and do not expose the Docker socket to application services.
- Keep secrets out of Git, images, logs, and mobile binaries; use restricted runtime secret delivery and a rotation/recovery procedure.
- Health/readiness checks, restart policy, resource limits, structured redacted logs, metrics, alerts, and dependency patching.
- Caddy provides automatic HTTPS under documented prerequisites; certificate/DNS/renewal operations still need monitoring. [Caddy HTTPS](https://caddyserver.com/docs/automatic-https)
- Compose can support an initial production setup, but it does not make one host highly available. [Docker Compose production guidance](https://docs.docker.com/compose/how-tos/production/)

### Delivery and migrations

The engineering foundation was authorized on 2026-10-11. Its delivery path is: automated checks → immutable GHCR images → restricted GitHub Actions deployment → production health checks. Future schema delivery remains: reviewed staging migration/acceptance → approved production release → smoke checks → monitored rollout. Use reviewed expand/contract migrations, a migration role separate from runtime, lock/time limits, and backups before destructive changes. Never auto-run irreversible migrations on every API restart.

Roll back application images only when compatible with the current schema. Database rollback needs an explicit forward-fix or restoration procedure; restoring a backup loses later transactions unless recovered/reconciled. Mobile clients need backwards-compatible API windows and a minimum-supported-version policy.

### Backups and recovery

- Encrypted offsite PostgreSQL base backups plus continuous WAL archiving for point-in-time recovery; include global roles/configuration where required.
- Independent protected copies/versioning of documents, receipt artifacts, identity configuration/data, and encryption-key recovery material.
- Separate credentials and access domain for backup deletion; local Docker volumes and provider snapshots alone are not sufficient.
- Proposed targets for approval: database RPO ≤15 minutes and RTO ≤4 hours, subject to measured archive lag and restore drills. Document/object recovery has its own measured target.
- Conduct an isolated full restore drill before pilot launch and periodically afterward; verify ledger totals, source-event uniqueness, identity linkage, documents, and receipt references.
- Recovery reconciliation must consider offline events, external bank transactions, and receipts issued after the restored checkpoint. Avoid double posting and preserve unresolved evidence.

PITR requires an appropriate base backup and an unbroken sequence of archived WAL; a nightly logical dump alone cannot meet the proposed recovery objective. [PostgreSQL continuous archiving](https://www.postgresql.org/docs/current/continuous-archiving.html)

### Observability and scale gates

Track payment failure/duplication, ledger imbalance rejection, reconciliation backlog, sync conflicts, cash discrepancies, outbox age, report latency, DB locks/pool utilization, disk growth, backup lag, certificate expiry, and automation failures/retry backlogs. Alert on cross-tenant access attempts and unusual exports without leaking PII.

Proposed pilot targets, not measured results: online core command p95 below 1 second excluding uploads/provider calls; safe local capture feedback below 500 ms; normal queued sync within 60 seconds of reliable foreground connectivity; 99.5% monthly online service availability. Approve workload/concurrency and device/network matrix before claiming capacity.

Scale when measured contention demands it: separate PostgreSQL host, more API/worker instances, dedicated reporting read paths, and dedicated tenant infrastructure. Preserve identical domain rules and isolation guarantees; Kubernetes, microservices, and a warehouse are not prerequisites for the pilot.

Cost planning must include VPS/backup/storage/egress, email/SMS/WhatsApp if enabled, geocoding/routing, native build distribution, signing/store accounts, monitoring, support, and compliance review. Provider selection and spending cap are open, so no unsupported total is quoted.

## Related documents

- [Architecture](architecture.md)
- [Stack](stack.md)
- [Security](security.md)
- [Roadmap](roadmap.md)
