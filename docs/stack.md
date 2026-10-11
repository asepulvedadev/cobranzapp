# Technology Stack and Tradeoffs

> **Status:** Engineering foundation v0.5; business stack validation remains gated.
> **Updated:** 2026-10-11.

Owns technology choices, alternatives, compatibility constraints and distribution boundaries. The Node/TypeScript, Next.js, Fastify, Expo, PostgreSQL, Docker Compose, and nginx-compatible foundation is installed; identity, encrypted native persistence, object storage, maps, and notifications remain unselected or unimplemented.

## Proposed technology stack and tradeoffs

These are recommendations, not installations or final commitments. Pin supported stable versions and container digests when implementation is authorized; do not deploy `latest` tags or assume current cross-library compatibility.

| Layer | Proposed technology | Reason and cost |
|---|---|---|
| Android/iOS | React Native + Expo + TypeScript + Expo Router | Mobile camera/location ecosystem and shared contracts; native encryption may require custom builds and compatibility tests |
| Web console | React + Next.js, responsive from mobile upward | Dedicated management tables, forms, and reports; two presentation layers must be maintained |
| Mobile local storage | Expo SQLite with SQLCipher in a validated development/release build | Encrypted route cache and pending-event queue; key lifecycle and native build work required |
| API | TypeScript on supported Node.js LTS + Fastify | Shared contract language and modular HTTP services; business boundaries must be enforced explicitly |
| Contracts | OpenAPI + schema validation; generated client types | Native/web compatibility and consistent error semantics; contracts need version discipline |
| Data layer | PostgreSQL + Drizzle with reviewed SQL migrations | Relational integrity, explicit queries, and typed access; RLS and accounting constraints still need SQL/testing |
| Identity | Self-hosted Keycloak via OIDC | Avoid custom password/MFA implementation; adds memory, patching, email, and operational work |
| Background work | PostgreSQL outbox/job tables + dedicated worker | Durable tasks without an initial Redis dependency; retries, leases, and dead-letter handling require design |
| Document capture | Camera/file acquisition + manual structured entry and review | No OCR models or document-reading AI; slower entry in exchange for a clear no-AI boundary |
| Document storage | Private object storage through an S3-compatible adapter | Keep binaries out of relational tables; provider, region, retention, and cost remain open |
| Business automation | Typed application rules + schedules + PostgreSQL outbox/jobs | Reproducible conditions/actions with audit, approvals and limits; no agent runtime |
| VPS | Docker Compose + Caddy + dedicated PostgreSQL volume | Simple initial operations; a single VPS is a failure domain, not high availability |
| Verification | Unit/property tests, real-Postgres integration, browser E2E, native device E2E | Financial and tenant guarantees need realistic tests, not ORM mocks alone |

**Meaningful alternative:** Flutter can provide a more unified presentation stack across mobile and web, but introduces Dart and still requires native encryption/offline validation. Proposed React Native + dedicated web console prioritizes field workflows and management usability over “one UI codebase.” Revisit if a unified UI is more important than TypeScript reuse.

**Identity alternative:** Managed OIDC reduces VPS identity operations but adds recurring cost and external dependency. Proposed Keycloak honors the self-hosting direction; capacity and maintenance readiness must be confirmed before approval.

“Multi-platform” currently means Android, iOS, and web browsers on desktop/tablet/mobile. Native Windows/macOS/Linux applications are not assumed. A Linux VPS hosts services; iOS binary creation/distribution still needs an appropriate Apple build/signing environment or build service.

### Verified technical constraints

- Expo documents SQLite web support as alpha. Therefore, native SQLite offline support does not establish production-ready browser offline parity. The proposed web console is online-first. [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- Expo documents native configuration and SQLCipher support; custom native libraries require a suitable development build, not an assumption that everything works in Expo Go. [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- Keycloak supports OIDC integration. Tenant business authorization remains in this application's membership model, not inferred from login alone. [Keycloak OIDC](https://www.keycloak.org/securing-apps/oidc-layers)
- Next.js supports self-hosting and recommends a reverse proxy; the VPS proposal does not require Vercel hosting. [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting)

## Application distribution and technology references

One shared Android/iOS app displays tenant branding after workspace selection. Separate tenant-branded store binaries, signing identities and release pipelines are not included in basic branding. The web console is independently deployed but uses the same API contracts and domain definitions.

- [Fastify](https://fastify.dev/docs/latest/) — proposed HTTP framework.
- [Drizzle](https://orm.drizzle.team/docs/overview) — proposed TypeScript SQL-oriented data layer.
- Exact versions and native/device compatibility remain unapproved until an authorized validation phase.

## Related documents

- [Architecture](architecture.md)
- [Deployment](deployment.md)
- [Offline synchronization](offline-sync.md)
