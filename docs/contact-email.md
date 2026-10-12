# Contact email through Resend

The public contact form asks for name and phone only. Demo, product, support and
membership enquiries point to `/contacto`; selecting Pro or Ultra preserves the
plan in the notification. Email goes to **info@cobranzaap.tech**, from
**cobranzapp <contacto@cobranzaap.tech>**. Legal requests can still be written
directly to the institutional mailbox; inbound email remains with its existing
mail provider, not Resend.

## Run and verify

1. Keep operator credentials in `.env.resend.local` (mode `0600`, ignored by Git).
2. For local API development, Node 22 can load both protected files:
   `node --env-file=.env --env-file=.env.resend.local services/api/dist/server.js`.
   Build the API first. The browser never receives the key.
3. Production uses `/srv/cobranzapp/.env.resend` (mode `0600`) as an API-only
   Compose env file. Use `infrastructure/resend.env.example` as a template.
   The VPS deployment script uses `/srv/cobranzapp/compose.yaml` and does not
   synchronize repository Compose changes. Apply the API-only `.env.resend`
   entry to that live file before deployment, preserving other service settings.
   Updating the repository YAML alone leaves the mailer unconfigured. The live
   entry has been applied and the API recreated with its existing release image.
4. Check the domain:
   `python3 .agents/skills/cobranzapp-resend/scripts/resend.py status`.
5. Explicitly authorize a test send:
   `python3 .agents/skills/cobranzapp-resend/scripts/resend.py test-email --confirm`.
6. Inspect its returned ID with `email-status EMAIL_ID`. `accepted` means Resend
   accepted the request, not that the destination has received or read it.

Production uses a sending-only API key scoped to `cobranzaap.tech`; the supplied
operator key stays in the protected local file. Creating the scoped key did not
revoke the original. Rotate the original through an authorized Resend account
because it was shared in chat; coordinate any other consumers before revocation.

The operator helper sets a project User-Agent. In this environment, Resend's
edge returned HTTP 403 to the default Python-urllib agent but accepted the same
credential with the project agent. Do not misdiagnose that response as missing
key permissions or retry credential creation blindly.

## Request boundary

`POST /api/v1/contact` is proxied to Fastify `/v1/contact`. A Next `/api/contact`
handler would be bypassed by the production nginx `/api/` proxy.

JSON fields: `name` (2–100 characters), `phone` (7–15 digits; formatting is
normalized), `requestId` (UUID), optional `plan` (`Pro` / `Ultra`), optional
`source` (approved public-page identifiers), and `website` (empty honeypot).
No recipient, sender, subject, arbitrary URL or message can be supplied.

Responses: 202 accepted, 400 invalid, 403 invalid/missing Origin, 409 reused
idempotency key with different content, 413 oversized, 429 rate limited, 503
missing configuration or unavailable provider. The form retains values on error.

Protections: 2 KiB body limit, allowed Origin, honeypot, five requests per IP per
15 minutes, thirty sends globally per 15 minutes, two per second, provider
timeout and Resend idempotency per request UUID. Proxy IP selection assumes one
nginx hop, which appends the actual client IP. Limiters are bounded in-memory
and reset on restart; multiple API replicas require a shared limiter. Idempotency
is provided by Resend for its documented 24-hour retention, not a durable lead
queue. The same UUID and body must be retained when retrying uncertain sends.

Only fixed application messages are logged; provider errors, form bodies and
credentials are not logged by the contact handler. The email body is plain text.
Resend outages do not produce fake success. No contact table is created.

## Skill and maintenance

Versioned source: `.agents/skills/cobranzapp-resend`. Copy that folder into the
active Codex skills directory after changes; do not install an external symlink.
The helper needs Python 3 only, never echoes secrets, and permits sending only
to the configured institutional recipient. It does not create an MCP server or
configure Hermes.

This integration handles public contact enquiries, not tenant invitations,
password recovery, billing notices, campaigns or customer-loan notifications.
Those workflows need separate product requirements and tests.

Rollback: restore the public CTA links and contact page, unregister the contact
route and server mailer, and remove the API-only env-file entry. Keep other
platform services and existing inbound email untouched.

Official references: [sending](https://resend.com/docs/api-reference/emails/send-email),
[idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys),
[key permissions](https://resend.com/docs/api-reference/api-keys/create-api-key).

## Verification

- API tests: 75 passed, one existing database integration test skipped locally.
- Web tests: 37 passed. Workspace TypeScript and Biome checks passed.
- Operator helper: four offline safety tests passed; installed skill validates.
- A real test sent with the scoped production key was reported `delivered` by
  Resend, to the institutional mailbox.
- Mobile browser: two visible inputs; a simulated 503 preserved values, retry
  reused the same UUID, and acceptance displayed the confirmation. Desktop
  and mobile layouts were inspected. Production acceptance is checked again
  after CI deployment; no mock is retained in application code.
- The first production submission correctly returned 503 because the live
  Compose file had not loaded the secret file. The API-only env-file entry was
  applied on the VPS, with a config backup and healthy API restart. No database,
  worker, nginx, DNS or other VPS application was changed.

- After the live configuration repair, the production mobile form returned HTTP
  202, showed its success message, retained exactly two visible inputs and had
  no horizontal overflow. Resend reported the resulting notification as
  `delivered` to the configured institutional recipient.
