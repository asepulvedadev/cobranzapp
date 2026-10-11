# Source Register

> **Status:** Planning draft v0.5 — not implementation authorization.
> **Updated:** 2026-10-11.

Owns source provenance and primary reference links. Interpretation and operational requirements remain in their responsible documents.

## Primary references

References were consulted on 2026-10-11. They support platform constraints, not a claim that this draft has been implemented, tested, legally approved, or accepted by the user.

- [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) — RLS behavior and bypass caveats.
- [PostgreSQL backup/PITR](https://www.postgresql.org/docs/current/continuous-archiving.html) — base backups and continuous WAL recovery.
- [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) — native persistence, SQLCipher configuration and browser limitations.
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/) — native-library build boundary.
- [Fastify documentation](https://fastify.dev/docs/latest/) — proposed HTTP framework.
- [Drizzle documentation](https://orm.drizzle.team/docs/overview) — proposed SQL-oriented TypeScript data layer.
- [Keycloak OIDC](https://www.keycloak.org/securing-apps/oidc-layers) — proposed identity integration.
- [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting) — web-console hosting.
- [Docker Compose production](https://docs.docker.com/compose/how-tos/production/) and [Caddy HTTPS](https://caddyserver.com/docs/automatic-https) — initial VPS services.
- [SIC Law 1581](https://sedeelectronica.sic.gov.co/transparencia/normativa/ley-estatutaria-1581-de-2012), [SIC Law 1266](https://sedeelectronica.sic.gov.co/transparencia/normativa/ley-estatutaria-1266-de-2008), and [Law 2300](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=213990) — confirmed Colombia market review, not a legal opinion.
- [SFC October 2026 interest publication](https://www.superfinanciera.gov.co/publicaciones/10116267/superfinanciera-certifica-el-interes-bancario-corriente/) — dated rate reference; applicable product category still unresolved.
- [Law 45 of 1990, Article 68](https://cancilleria.gov.co/normograma/compilacion/docs/ley_0045_1990.htm) — legal classification of charges as interest.
- [Law 2300 of 2023, official compilation](https://normativa.colpensiones.gov.co/compilacion/docs/ley_2300_2023.htm) — field-collection restrictions/exceptions and contact policy.
- [ML Kit Android model documentation](https://developers.google.com/ml-kit/vision/text-recognition/v2/android) — supports exclusion of model-based OCR, not a technology selection.

- [User-selected Aura reference](https://personal-finance.aura.build/) — rendered preview and style observations on 2026-10-11, including a 390×844 phone viewport; not a feature specification.
- [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) — proposed palette/interaction acceptance targets, not a completed app audit.

## Related documents

- [Technology stack](stack.md)
- [Compliance](compliance.md)
