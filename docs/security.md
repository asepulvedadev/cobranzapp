# Tenant Isolation and Security

> **Status:** Planning draft v0.4 — not implementation authorization.
> **Updated:** 2026-10-11.

Owns tenant isolation, scoped access, identity sessions, privacy protections, document/device controls and support access.

## Multi-tenancy and security model

### Isolation invariants

1. Every tenant-owned record has a non-null `tenant_id`; platform-global identity and tenant catalog records have narrowly defined separate access paths.
2. Verify token signature, issuer, audience, expiry, and active membership before selecting a tenant. A hostname, URL, header, or client-supplied tenant ID is a routing hint, never authorization.
3. Use server-controlled tenant context inside the same PostgreSQL transaction/connection as the query, with transaction-local settings. Missing context must deny access.
4. Enable RLS with explicit `USING` and `WITH CHECK` policies; force RLS on tenant tables. Runtime roles are not table owners, superusers, or `BYPASSRLS` roles.
5. RLS protects the tenant boundary; use-case authorization separately enforces collector/branch/document scope. Do not treat “same tenant” as permission to read everything.
6. Use composite references such as `(tenant_id, borrower_id) → borrowers(tenant_id, id)` to prevent cross-tenant relationships, including joins and attachments.
7. Scope object storage keys, signed-link issuance, jobs, exports, logs, automation rules, caches, notifications, and synchronization by tenant and authorized user/resource scope.
8. Revalidate memberships and scopes when queued jobs run, and when offline events arrive. A worker must not trust an arbitrary tenant field from a payload.
9. Support access is approved, time-bound, purpose-limited, and audited; no unrestricted “impersonate anyone” operator account.

PostgreSQL documents that owners normally bypass RLS and superusers/`BYPASSRLS` always bypass it; `FORCE ROW LEVEL SECURITY` alone is not sufficient. Referential integrity checks also bypass RLS, reinforcing the need for tenant-aware keys and sanitized errors. [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

### Identity, privacy, and device protections

- Mobile: OIDC authorization-code flow with PKCE through the system browser; no embedded credential form or secret in the app binary.
- Web: server-managed sessions with secure HttpOnly cookies, CSRF defenses, strict redirects, and server-side token handling. No long-lived tokens in browser local storage.
- MFA for owners, finance, and sensitive approvals; reauthentication for role grants, exports, and financial policy changes.
- Short-lived access tokens, rotation/revocation policy, per-device session management, and immediate membership checks for sensitive operations.
- Tenant-specific document-number lookup uses keyed HMAC over normalized country/type/number plus encrypted original value; ordinary hashing is insufficient for low-entropy identifiers. Key versioning and rotation need migration support.
- Encrypt sensitive files and local data; keep decryption keys outside the database and app bundle. Mask identity values by role and redact PII from telemetry.
- Minimize offline data to assigned work with expiration; separate caches by tenant/user/device. Wipe on authorized logout/tenant switch only after protecting unresolved physical-cash evidence through a defined recovery workflow.
- Remote device revocation cannot instantly erase an offline phone. Define offline unlock lifetime, managed-device options, and incident procedures; do not promise impossible immediate revocation.
- Quarantine uploads, inspect actual content type, size-limit, scan, and use private short-lived links; never public identity-document URLs.
- Notifications contain minimal sensitive information. Uploaded files, form values and imported data are untrusted input; validate them and never execute embedded content.

### Implemented session-security baseline

As of 2026-10-11, the web application uses server-managed opaque sessions in secure HttpOnly,
SameSite cookies. A password confirmation is required again when the latest credential proof is
older than ten minutes before platform lifecycle changes, invitations, membership changes, or team
scope assignments. Successful confirmations are bound to the current session, rate-limited, and
recorded as account-scoped audit events; no password or session token is included in audit data.
Invitation links expire after 72 hours and are single-use. Tenant owners can revoke pending
non-owner invitations, while owner invitations remain protected behind platform administration;
revocation requires recent password confirmation and creates a tenant-scoped audit event.
Employee-seat activation is checked inside the same database transaction as invitation acceptance
or membership reactivation. A tenant-scoped transaction advisory lock prevents concurrent
acceptances from exceeding the versioned entitlement; a narrowly scoped database function returns
only the active employee count needed for that check.

The developer console also provides a paginated identity directory. Disabling a tenant identity
requires recent password confirmation, immediately revokes every active session and records a
global audit event without credentials or session tokens. Developer identities are protected from
this general-purpose control to prevent accidental platform lockout.

The developer can search and paginate the global audit directory by actor, company, action text or
an exact action type. This view is read-only, requires the platform developer role, and returns actor
and tenant context without exposing event metadata that may contain internal operational details.

Users can enroll TOTP verification from the security screen. Setup and removal require password
confirmation when the latest credential proof is older than ten minutes. TOTP secrets are encrypted
with AES-256-GCM using the deployment key in `MFA_ENCRYPTION_KEY`; recovery codes are stored only as
one-way hashes and work once. Password login for an enrolled account creates a five-minute challenge
instead of a session. The challenge allows at most five failed attempts, accepts either a current
TOTP code or a recovery code, prevents TOTP replay, and creates the authenticated session only after
successful verification. Enabling MFA revokes the account's other sessions and records the security
event. Recovery codes are displayed once for immediate download and are never returned again.

The production MFA encryption key must be a base64-encoded 32-byte secret kept outside source
control. Losing this key makes enrolled TOTP secrets unusable; rotation therefore requires a
documented re-enrollment or key-rewrapping procedure before the old key is removed.

This is an interim first-party identity baseline, not completion of the identity roadmap. Mandatory
MFA enrollment policy for privileged roles is not enforced yet. OIDC with PKCE for mobile, approved
support access, key-rotation operations, and an independent security review remain required before
the corresponding launch gate can pass.

Successful sign-in, sign-out, password change, reauthentication, individual remote-session
revocation, and bulk session revocation create account-scoped audit events with the request
correlation identifier. The security screen exposes only the authenticated user's latest account
events; it never stores or displays the submitted password, raw IP address, or session token.
Unsuccessful login identifiers are deliberately excluded from this audit stream to avoid turning
the audit table into an unbounded store of attacker-controlled personal data.

Organization visibility is also role scoped in PostgreSQL. Owners and supervisors can inspect the
tenant organization, collectors can read only teams assigned to their user and the branches that
contain those teams, and customers cannot read branches, teams, team membership or organization
counts. The API returns zeroed internal metrics for collectors and customers rather than exposing
tenant-wide counts that their role does not need. Inactive teams and branches are removed from a
collector's database-visible scope even when the historical assignment remains stored.

### Implemented worker-security baseline

The API and background worker use different PostgreSQL login roles. The API role can insert
tenant-scoped outbox events but cannot lease, complete, retry, or dead-letter them. The worker role
can lease and update outbox records, expire approved support access, and write only the associated
audit event; it cannot read global users or arbitrary tenant tables. Every handler reloads the
authoritative tenant and aggregate identifiers from the leased database row instead of trusting
tenant values inside the payload. Leases, bounded attempts, exponential retry, dead-letter state,
and `FOR UPDATE SKIP LOCKED` provide the current durable-job baseline.

Only support-access expiry is registered as a handler today. Additional handlers must add their own
least-privilege grants, RLS policies, idempotency behavior, and cross-tenant integration tests.

### Dependency-security posture

Production dependency auditing is enforced in CI at the `high` severity threshold. The current
Expo toolchain needs three transitive dependencies that require explicit treatment:

- `uuid` is forced to `11.1.1`, the first patched CommonJS-compatible release, because `xcode`
  only uses its `v4()` API.
- `node-forge` `1.4.0` carries a repository patch that rejects extra nested
  `DigestAlgorithm` elements during RSA PKCS#1 v1.5 verification. The patch mirrors the pending
  upstream fix and remains until an official patched release is available.
- `braces` `3.0.3` is accepted temporarily as a monitored risk: no patched release exists, and it
  is only reachable through Metro's trusted build-time glob processing, not from application input
  or any deployed server runtime.

The audit command ignores only the two documented CVEs for the locally patched or build-only
packages. Any other high or critical production advisory fails CI. Reassess and remove each
exception when the Expo dependency graph or upstream releases change.

## Branding asset security

Sanitize uploaded logo/receipt assets and prohibit arbitrary HTML, CSS, JavaScript or untrusted template execution. Custom domains require verified ownership and tenant-aware routing; a domain is not proof of membership. Branding presentation belongs in [visual design](../design.md).

## Related documents

- [Membership permissions and bounded customer links](memberships.md)
- [Domain roles](domain.md)
- [Compliance](compliance.md)
- [Database](database.md)
- [Offline synchronization](offline-sync.md)
