# Estado de implementación

> **Actualizado:** 2026-10-13. Este documento refleja el estado real del repositorio y no sustituye las autorizaciones de [la hoja de ruta](roadmap.md).

## Entregas verificadas

| Bloque | Estado | Evidencia |
|---|---|---|
| Plataforma y autenticación | Completado | Inicio por usuario o correo, sesiones HttpOnly, cambio obligatorio de contraseña inicial, MFA y reautenticación |
| Multitenencia | Completado | Empresas, membresías, roles, RLS y claves compuestas por empresa; la operación del propietario se presenta como una empresa con empleados, sin sedes ni equipos en el flujo principal |
| Alta comercial | Completado | El desarrollador registra propietarios, emite códigos únicos por suscripción y cada propietario crea varias empresas desde su panel |
| Consola de desarrollador | Completado | Directorios paginados, registro de propietarios, emisión de códigos, planes, cupos, estados, actividad, estado técnico y soporte temporal auditado; la activación de membresías muestra suscripciones disponibles, plan asignado y fecha/hora de inicio en Colombia |
| Expediente de cliente | Completado | Identidad manual, teléfonos, WhatsApp, direcciones de casa y trabajo normalizadas y obligatoriamente confirmadas con el cliente antes de guardar o corregir, ubicación por texto o GPS del dispositivo para rutas Waze, contactos de emergencia, foto designada y documentos privados; alta móvil por pasos dentro de un modal cerrable, captura desde cámara o galería, validación Zod y reanudación segura de cargas si falla un documento |
| OCR asistivo de documentos | Completado con revisión humana | Tesseract en el worker, imágenes/PDF privados, sugerencias cifradas, reintento y confirmación auditada; controles de consulta, confirmación y reintento disponibles también en móvil |
| Personal operativo | Completado | Perfil de supervisores y cobradores, identidad cifrada, últimos cuatro dígitos, tipo de sangre con consentimiento y documentos privados; propietarios pueden crear empleados desde un modal con usuario/teléfono/clave y toda edición de perfil se abre en una ventana independiente; móvil también permite editar el perfil de cuenta del propietario o desarrollador |
| Verificación compartida | Completado con activación controlada | Vista independiente para propietario, supervisor y cobrador con búsqueda simple por cédula; exige confirmar que el cliente autorizó la consulta y deja esa confirmación en auditoría; devuelve únicamente nombre, créditos vigentes, calificación derivada de pagos y reporte negativo; la red consentida avanzada, correcciones, disputas y auditoría permanecen controladas; no es lista negra |
| Rutas de cobranza | Completado | Vista independiente en sidebar, direcciones geocodificadas bajo demanda, Waze, optimización por cercanía, visitas auditadas y asignación por empresa; móvil puede ubicar casa/trabajo desde el expediente |
| Reportes operativos | Completado como vista operativa | Vista independiente web y móvil para propietarios, supervisores y cobradores con créditos activos, solicitudes en revisión, cuotas vencidas acumuladas, frecuencias y prioridades de cobro; no presenta saldos ni ingresos contables |
| Solicitudes web resilientes | Completado | Las mutaciones de autenticación, onboarding, configuración, empleados, verificación y créditos tienen un límite de 20 segundos y devuelven un mensaje accionable en lugar de dejar botones bloqueados indefinidamente |
| Solicitudes móviles resilientes | Completado | La API móvil cancela consultas que superan 20 segundos, amplía cargas de documentos a 60 segundos y muestra un error accionable para evitar formularios bloqueados |
| Originación operativa protegida | Completado como piloto | Catálogo configurable en vista independiente de Créditos, reglas de monto/interés desde modales, frecuencias y plazos de un mes/5 semanas, calendario determinista, próxima cuota y cuotas vencidas como proyección operativa, renovación desde la segunda cuota y marcadores de cuotas; el inicio muestra créditos activos, solicitudes en revisión y cuotas vencidas acumuladas; disponible en web y móvil; los créditos piloto se activan operacionalmente sin registrar dinero; no aprueba contabilidad, desembolsa ni registra recibos financieros |
| Entrega VPS | Completado para el entorno actual | Imágenes inmutables transferidas por SSH, orden estricto de despliegue, health/readiness, Caddy, roles PostgreSQL separados, timer diario de respaldo local y verificación mensual de restauración aislada |

## Bloques deliberadamente protegidos

Estos bloques no se deben activar con valores inventados:

1. Activación contable del motor de cuotas, intereses, recargos, redondeos y asignación de pagos.
2. Aprobación, contrato, desembolso, recibos, reversos y conciliación de efectivo.
3. Captura offline de dinero y resolución de conflictos.
4. Informes financieros y automatizaciones que dependan de saldos contables.

Los marcadores operativos de `loan_payments` no son recibos ni asientos contables: solo confirman el avance de una cuota esperada y permiten calcular una calificación conservadora para la verificación compartida. La activación contable sigue bloqueada hasta contar con las reglas aprobadas.

La proyección configurable ya está disponible para comparar escenarios, pero no crea obligaciones. Para liberar estos bloques hacen falta, como mínimo, la categoría legal del producto, ejemplos financieros aprobados, calendario de vencimientos, tratamiento de cargos, flujo de efectivo y política offline. Hasta entonces, la interfaz y la API mantienen los estados de producto y solicitud en preparación/revisión.

## Evidencia de calidad de la última entrega

- `pnpm check` pasa formato, tipos, pruebas y compilación.
- Contratos: 38 pruebas aprobadas.
- Financiero: 8 pruebas aprobadas.
- Worker: 2 pruebas aprobadas y 5 omitidas cuando no hay PostgreSQL de CI.
- Web: 45 pruebas aprobadas.
- Móvil: 4 pruebas aprobadas.
- API: 102 pruebas aprobadas y 2 suites de integración omitidas cuando no hay PostgreSQL de CI.
- Integración PostgreSQL de aislamiento: 1 escenario aprobado localmente con las migraciones completas; CI lo omite cuando no hay `TEST_DATABASE_URL`.
- Producción: `https://cobranzaap.tech/api/health` responde con la versión desplegada y los servicios API, web, worker y PostgreSQL están activos.

## Próximo desbloqueo

Definir el destino principal del crédito piloto y someterlo a revisión legal/contable. Después se puede convertir el producto en un conjunto de reglas versionadas y construir el motor financiero con ejemplos dorados, sin alterar los datos ya capturados.
