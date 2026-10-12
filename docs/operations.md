# Onboarding and Field Operations

> **Status:** Planning draft v0.4 — not implementation authorization.
> **Updated:** 2026-10-11.

Owns operational journeys, borrower dossier/document capture, routes, supervision, internal risk review and business configuration.

## Main user journeys

### Tenant onboarding

1. Owner registers and verifies identity-provider login; organization identity is a separate business verification workflow.
2. Create workspace and legal/business profile; choose jurisdiction, currency, timezone, and locale.
3. Review platform terms, data-processing responsibilities, and approved operating policy.
4. Set logo, colors, display name, receipt identity, and support contact; preview accessible branding.
5. Configure one approved loan product, repayment calendar, allocation policy, approval limits, and cash handling.
6. Create branches/teams, invite supervisors and collectors, and assign scoped roles.
7. Practice with clearly separated demo data or review an anonymized sample workflow.
8. Activate operational mode only when mandatory policy and financial configuration checks pass.

Persist resumable steps and configuration versions. Invitations expire, are single-use, and grant only the assigned membership. Demo values must never appear in live portfolio totals. A tenant may be provisioned while remaining blocked from disbursement.

### Borrower registration and dossier

Capture only justified fields: legal name, document country/type/number, contact channels, home/work addresses, optional workplace information, verified location, and approved supporting documents. Capture lawful basis/consent evidence appropriate to the jurisdiction and purpose.

The dossier shows identity verification state, document and manually entered identity review, address history, loans, payment history, authorized contacts, collection interactions, promises to pay, risk cases, and access-controlled notes. An address being available does **not** authorize a collection visit or disclosure to an employer.

Deduplicate within the tenant using reviewed identity data. References/guarantors require their own permitted-data handling; never upload phone contact books or expose debt to unrelated third parties.

### Origination and disbursement

`Draft → Submitted → Reviewed → Approved → Disbursed → Active → Closed`

Rejection and cancellation are explicit branches. Approval is not disbursement. Show principal, rate and basis, total expected cost, schedule, fees if lawful, allocation rules, and contract evidence before approval. Freeze the approved terms and schedule version. Require a funded cash/bank account and disbursement evidence before activating the loan.

Delinquency is a calculated collection condition, not a destructive change to the contract. Restructuring creates a linked agreement and revised schedule; it does not overwrite prior obligations or erase old allocations.

### Collection and receipt

1. Collector opens an assigned route and borrower obligation with visible balance freshness.
2. Record a visit/contact outcome, even when no payment occurs.
3. Capture payment amount, method, event time, and any justified evidence.
4. Online: server authorizes, validates, allocates, posts the ledger, and returns an immutable receipt.
5. Offline, if enabled: retain an encrypted collection event and provisional acknowledgment; clearly show **Pending confirmation**.
6. Payment enters the appropriate collector cash account or verified bank workflow, then daily settlement/reconciliation.

Transferred-payment screenshots are evidence, not proof of settlement. Payment confirmation requires a verified bank transaction or approved reconciliation. A provisional acknowledgment may evidence physical cash received but must not misrepresent the server's confirmed debt balance.

### Routes and supervision

- Build reusable route templates and dated route runs with ordered stops, borrower/loan references, and selected permitted address.
- Assign collectors and supervisors; preserve assignment history and changes.
- Show expected amount, scheduled tasks, visit outcomes, promises, incidents, and pending synchronization.
- First pilot: manual ordering and external navigation links. Geocoding/maps/routing require a provider, budget, privacy review, and coverage test.
- A route may include many obligations for one borrower; avoid duplicate visits and aggregate contact limits at borrower level.
- Supervisors review missing visits, pending events, cash discrepancies, reversal requests, and unusual operational patterns.
- Optional location capture at an action requires appropriate permissions and purpose; no continuous tracking by default.

### Ficha operativa de supervisores y cobradores

La primera ficha operativa ya está disponible dentro de cada empresa para que el integrante
complete sus datos sin mezclar información entre tenants. Incluye celular, direcciones de casa y
trabajo, hasta dos contactos de emergencia y una referencia opcional a una foto de perfil privada.
La foto es una imagen designada por la persona; no es selfie, biometría ni prueba de identidad.

El tipo de sangre es opcional, está separado del resto de la ficha y solo se guarda cuando existe
una versión de consentimiento explícita. Propietarios y supervisores pueden revisar fichas según
su alcance; cada cambio genera auditoría sin registrar los valores sensibles en los metadatos del
evento. La carga real de imágenes permanece detrás del almacenamiento privado aprobado y no se
aceptan rutas de objetos arbitrarias.

### Captura inicial de clientes

La consola empresarial ya incluye una captura rápida de clientes con nombre legal, tipo y número
de documento, celular, direcciones de casa/trabajo, uno o dos contactos de emergencia, referencia
de consentimiento y los archivos de frente, reverso y foto designada de perfil. El número se cifra
en reposo y se busca mediante HMAC con alcance de tenant; las respuestas solo muestran los últimos
cuatro dígitos. La captura crea primero el expediente y luego carga cada archivo al prefijo privado
del cliente; si una carga falla, la ficha queda disponible para reintento y nunca se presenta como
identidad revisada. Esta etapa no hace OCR ni afirma autenticidad documental.

La revisión manual ya cuenta con un historial append-only por cliente. Propietario o supervisor
deben confirmar por separado el nombre, frente, reverso y foto designada antes de marcar la
identidad como revisada; si falta un documento aceptado, la API rechaza la aprobación y conserva
el estado pendiente. Un rechazo requiere una nota de al menos diez caracteres y también queda
auditado. La revisión no equivale a una certificación de autenticidad.

La carga de documentos ya pasa por un endpoint multipart con límite de 10 MB, validación de tipo
declarado contra los bytes iniciales, clave opaca por tenant/cliente y permisos de archivo
restringidos. El archivo se escribe en cuarentena privada con estado `pending`; no se entrega una
URL pública ni se permite reutilizar una ruta arbitraria. La foto designada de perfil del personal
usa un prefijo privado separado por tenant/integrante y requiere reautenticación para reemplazarse.
La integración de antivirus externo y la copia off-site/versionada siguen siendo un requisito
operativo antes de almacenar datos reales.

### Shared verification network (replacement for “blacklist”)

The product now has a consent-gated foundation for a shared verification network. It returns only minimal categories and counts, records every query, requires evidence and expiry for each observation, and supports a correction request. It never shares documents, balances, addresses, photos or the reporting company name.

The network is disabled until the Colombian privacy policy, participant agreements, retention schedule and correction procedure are approved. A reported late/default event is not an automatic denial, does not block existing payments, and cannot be the sole credit decision factor. The tenant-local review lifecycle remains `Observation → Under review → Restricted / Dismissed → Resolved / Expired` for operational decisions inside the company.

### Catálogo de crédito en preparación

La consola de propietario y supervisor permite registrar productos de crédito como borradores con
montos COP, plazo, frecuencia, base de tasa, cargo documental y referencia normativa. Cuando la
referencia está registrada, el producto puede enviarse a `under_review`; ese cambio exige
reautenticación y queda auditado. La API no permite todavía aprobar, calcular cuotas, originar,
desembolsar ni registrar pagos. Esto evita convertir una tasa o ejemplo comercial en una regla
financiera vigente sin revisión legal, contable y de calendario.

### Solicitudes de crédito en borrador

Propietarios, supervisores y cobradores pueden registrar una solicitud asociando un cliente activo
con un producto disponible. La API valida el rango de monto y el máximo de periodos del producto,
guarda el estado `draft` y registra el actor en auditoría. Una solicitud solo puede enviarse a
revisión cuando la identidad del cliente está revisada y el producto está en `under_review` o
`approved`; el envío también queda auditado. Propietarios y supervisores pueden tomar una
solicitud `submitted` y moverla a `under_review` con reautenticación reciente; ese cambio también
queda auditado. La interfaz deja claro que esto no aprueba,
desembolsa, calcula cuotas ni registra pagos; esas decisiones requieren los controles legales,
contables y de calendario de las siguientes fases.

## Document capture and manual identity review — no AI

The latest instruction supersedes the earlier OCR/Hermes request. The baseline contains **no OCR/AI extraction**. Model-based OCR, such as the models documented for ML Kit, is excluded from a strict no-AI product. This is a conservative scope boundary, not a claim that all text recognition is AI. [ML Kit model deployment documentation](https://developers.google.com/ml-kit/vision/text-recognition/v2/android)

Proposed flow: `Authorized camera/file capture → Private quarantine → File checks → Manual structured entry → Human review → Verified fields`.

- Support guided front/back camera capture and file upload, crop/rotation, explicit reshoot, and manual entry. No model-based blur/glare detection is assumed.
- Capture document country/type/number and required legal-name fields by hand; keep original document and corrected-field history with restricted access.
- Require a second reviewer where the approved risk/identity policy calls for one; apply normalization and tenant-local exact duplicate checks deterministically.
- Barcode/QR parsing is a possible non-AI convenience only if the target document exposes a supported format and its use is approved. Use a selected non-model decoder and explicit field mapping; never assume jurisdiction-wide coverage or identity authenticity.
- Minimize collected fields; avoid face matching, biometrics, document fraud models, and third-party AI extraction services.
- File integrity, actual content-type validation, size limits, quarantine/scanning, private access and retention remain mandatory without AI.
- Pilot validation measures entry errors, correction frequency, capture failure rate, and reviewer time. No “confidence score” is fabricated.

## Confirmed fieldwork and access requirements

Collectors and supervisors travel to borrower points and need addresses and operational information. Preserve this as a fieldwork requirement, subject to approved visit eligibility. The requested “complete information” means a complete operational view for assigned work, not unrestricted access to every document, identity field or borrower across the tenant.

- Collector sees assigned borrower name, authorized contact, selected permitted point/address, relevant due obligations, receipt history and necessary visit notes.
- Supervisor sees the corresponding assigned team/route portfolio, exceptions and evidence needed for review.
- Full identity documents, bulk exports, unrelated borrowers and privileged finance/security data require separate permissions.
- A stop displays visit-authorization status and restrictions before navigation/contact. Do not turn a home/work address into an automatically executable collection visit.
- Cash physically received is evidenced immediately and reconciled according to [offline synchronization](offline-sync.md) and [financial rules](financial-rules.md).

## Business configuration and onboarding controls

Business settings include currency, timezone, locale, branches, working calendar, product versions, approvals, receipt numbering, notification preferences, authorized-contact policy, retention and automation schedules/limits. Financial/policy changes are versioned with effective dates and approvers; existing loans retain their snapshots.

Tenant configuration cannot disable isolation, immutable history, required legal safeguards, logging or minimum permission restrictions. Currency becomes locked after financial posting; changing it is a separate migration. Visual controls belong in [design](../design.md), not this document.

## Related documents

- [Domain](domain.md)
- [Security](security.md)
- [Compliance](compliance.md)
- [Offline synchronization](offline-sync.md)
- [Visual design](../design.md)
