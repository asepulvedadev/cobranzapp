# cobranzapp

> **Status:** Development foundation v0.1. Updated 2026-10-11. The monorepo, web/mobile shells, API, worker, PostgreSQL runtime, container delivery, and CI/CD foundation are implemented. Borrower and financial features remain gated by the approvals in the roadmap.

Mobile-first, multi-tenant loan/collection operations for independent lenders in **Colombia**, with **no AI**. This index replaces the former all-in-one design document. The documentation structure is confirmed; technology and product proposals remain unapproved unless explicitly marked otherwise.

## Where each decision belongs

| Document | Owns |
|---|---|
| [Visual design](design.md) | UI/UX, mobile navigation, screens, branding presentation, accessibility |
| [Brand assets v2](assets/brand-v2/README.md) | Approved isotype, revised bold geometric wordmark, transparent lockup, variants and export instructions |
| [Application-ready brand files](assets/brand-app/README.md) | Approved artwork separated into transparent symbol, name and combined files for light/dark surfaces |
| [Product](docs/product.md) | Pain, customer, offer, scope and confirmed requirements/assumptions |
| [Domain](docs/domain.md) | Vocabulary, actors, roles, business relationships and lifecycle |
| [Financial rules](docs/financial-rules.md) | Nominal/net amounts, described charge/interest example, schedules, allocations and ledger invariants |
| [Architecture](docs/architecture.md) | Modules, dependency direction, runtime boundaries and API contracts |
| [Technology stack](docs/stack.md) | Proposed libraries/frameworks, alternatives and compatibility constraints |
| [PostgreSQL model](docs/database.md) | Logical tables, relationships, isolation keys, constraints and indexes |
| [Operations](docs/operations.md) | Onboarding, borrower dossier/documents, field routes, supervision and risk workflows |
| [Offline synchronization](docs/offline-sync.md) | Capture queue, reconciliation, conflict/device recovery and server authority |
| [Security](docs/security.md) | Tenant isolation, scoped data access, authentication, device and document protections |
| [Colombia compliance](docs/compliance.md) | Rate/charge review, contact/visit limits, borrower rights and launch policy gates |
| [Analytics and automation](docs/analytics-automation.md) | Deterministic metrics, reports, scenarios, scheduled rules and execution audit |
| [VPS deployment](docs/deployment.md) | Hosting, release/migration planning, monitoring, backups and recovery |
| [Development plan](docs/development-plan.md) | Ordered implementation phases, work units, quality gates, VPS launch and pilot completion |
| [Operations runbook](docs/operations-runbook.md) | Repository, CI/CD, VPS runtime, health checks, backup and incident commands |
| [Roadmap](docs/roadmap.md) | Open decisions, verification evidence, risk register and construction authorization |
| [References](docs/references.md) | Primary source register and provenance |

## Current confirmed discoveries

- Application name: **cobranzapp**, confirmed by the user. The isotype and revised bold geometric wordmark are approved. Separate transparent application files are in `assets/brand-app/`. Only the approved identity is retained in the project.
- Initial market: Colombia. Example currency: COP. Proposed locale/timezone: `es-CO`, `America/Bogota`.
- No Hermes, assistants, LLMs, learned models or model-based OCR. Data entry/review is manual; automation uses explicit rules.
- Reported example: COP 100,000 nominal, COP 10,000 retained for documentation, COP 90,000 delivered, COP 130,000 total future repayment.
- Reported cadences: 30 daily installments, two fortnightly installments, or one end-of-month payment.
- Collectors and supervisors operate in the field and need scoped borrower/address information.
- User-selected visual reference: [Aura personal-finance](https://personal-finance.aura.build/); warm dark/cream/yellow/mint bento language adapted phone-first. Detailed specifications live only in [design.md](design.md).

The example is **not approved live pricing or visit authorization**. Compliance, exact dates, rounding, allocation and cash workflow still require review. Refer to the financial/compliance documents rather than duplicating calculations or legal rules here.

## Documentation convention

One topic has one authoritative owner. Cross-link other documents instead of copying rules. `design.md` contains presentation/interaction only; never add schema, stack, accounting formulas or legal policy there. Clearly distinguish user-confirmed facts, proposed decisions, assumptions and unresolved matters. Keep user-described practices separate from legally/operationally approved rules.

## Development quick start

```bash
cp .env.example .env
corepack enable
pnpm install
pnpm compose:up
pnpm dev
```

See [the development setup](docs/development-setup.md) for local services, validation, and automated delivery details.

- Private repository: `https://github.com/asepulvedadev/cobranzapp`
- Development deployment: `https://cobranzapp.2.24.115.58.sslip.io`

## Next discovery

Determine what borrowers primarily use the funds for; then settle product classification and reviewed legal pricing/collection policy. The engineering foundation is authorized, but business vertical slices remain blocked by the unresolved roadmap gates.
