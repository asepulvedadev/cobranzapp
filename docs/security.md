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

## Branding asset security

Sanitize uploaded logo/receipt assets and prohibit arbitrary HTML, CSS, JavaScript or untrusted template execution. Custom domains require verified ownership and tenant-aware routing; a domain is not proof of membership. Branding presentation belongs in [visual design](../design.md).

## Related documents

- [Domain roles](domain.md)
- [Compliance](compliance.md)
- [Database](database.md)
- [Offline synchronization](offline-sync.md)
