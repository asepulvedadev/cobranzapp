---
name: cobranzapp-resend
description: Operate and troubleshoot Resend contact email for cobranzapp, including domain checks, authorized test sends and delivery status. Use for cobranzapp email or contact-form work, not unrelated brands.
---

# cobranzapp email

Public contact is a two-field form: name and phone. Send notifications only to
`info@cobranzaap.tech`, from `cobranzapp <contacto@cobranzaap.tech>`.
Preserve the selected Pro/Ultra plan. Resend handles outbound email; preserve
existing inbound mail and MX records.

From the project root, use this skill's bundled helper:

```sh
python3 <skill-directory>/scripts/resend.py status
python3 <skill-directory>/scripts/resend.py test-email --confirm
python3 <skill-directory>/scripts/resend.py email-status EMAIL_ID
```

`--env-file PATH` selects a protected operator credential file; the default is
`.env.resend.local` in the current directory. Read secrets at runtime, never
copy their values into output, source, skills or chat. Production secrets live
in `/srv/cobranzapp/.env.resend`, loaded only by the API container. Prefer a
sending-only domain-scoped production key when an authorized operator can
create one. Do not revoke shared keys or change DNS without explicit authority.

Ask for authorization before sending an operator test unless the user already
requested an email verification. `--confirm` authorizes that individual send;
status commands are read-only. Do not retry mutations indefinitely or report
provider acceptance as delivery. Check the returned ID's `last_event` before
claiming delivery.

The public endpoint is Fastify `/v1/contact`, exposed as `/api/v1/contact`.
Production nginx bypasses Next handlers under `/api/`. Keep validation,
fixed recipients, allowed Origin, anti-abuse controls and stable per-request
idempotency. Never log submitted names/phones or raw provider failures.
For implementation and operational limits, read the project's
`docs/contact-email.md`. This integration does not enable tenant transactional
emails, campaigns, a new MCP server or product AI. Update the versioned skill
and reinstall its folder into the active Codex skills directory together.
