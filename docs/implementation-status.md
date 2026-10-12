# Estado de implementación

> **Actualizado:** 2026-10-12. Este documento refleja el estado real del repositorio y no sustituye las autorizaciones de [la hoja de ruta](roadmap.md).

## Entregas verificadas

| Bloque | Estado | Evidencia |
|---|---|---|
| Plataforma y autenticación | Completado | Inicio por usuario o correo, sesiones HttpOnly, cambio obligatorio de contraseña inicial, MFA y reautenticación |
| Multitenencia | Completado | Empresas, membresías, roles, sedes, equipos, invitaciones, RLS y claves compuestas por empresa |
| Alta comercial | Completado | El desarrollador registra propietarios, emite códigos únicos por suscripción y cada propietario crea varias empresas desde su panel |
| Consola de desarrollador | Completado | Directorios paginados, registro de propietarios, emisión de códigos, planes, cupos, estados, actividad, estado técnico y soporte temporal auditado |
| Expediente de cliente | Completado | Identidad manual, teléfonos, direcciones, contactos de emergencia, foto designada y documentos privados |
| Personal operativo | Completado | Perfil de supervisores y cobradores, identidad cifrada, últimos cuatro dígitos, tipo de sangre con consentimiento y documentos privados |
| Verificación compartida | Completado con activación controlada | Consentimiento, propósito, vencimiento, consulta mínima, correcciones, disputas y auditoría; no es lista negra |
| Rutas de cobranza | Completado | Plantillas, paradas, estados y asignación de cobradores con alcance por empresa |
| Originación preliminar | Completado como borrador | Catálogo configurable, edición por propietario/supervisor, proyección de cuotas y solicitudes; no aprueba, desembolsa ni registra obligaciones |
| Entrega VPS | Completado para el entorno actual | Imágenes inmutables transferidas por SSH, orden estricto de despliegue, health/readiness, Caddy y roles PostgreSQL separados |

## Bloques deliberadamente protegidos

Estos bloques no se deben activar con valores inventados:

1. Activación contable del motor de cuotas, intereses, recargos, redondeos y asignación de pagos.
2. Aprobación, contrato, desembolso, recibos, reversos y conciliación de efectivo.
3. Captura offline de dinero y resolución de conflictos.
4. Informes financieros y automatizaciones que dependan de saldos contables.

La proyección configurable ya está disponible para comparar escenarios, pero no crea obligaciones. Para liberar estos bloques hacen falta, como mínimo, la categoría legal del producto, ejemplos financieros aprobados, calendario de vencimientos, tratamiento de cargos, flujo de efectivo y política offline. Hasta entonces, la interfaz y la API mantienen los estados de producto y solicitud en preparación/revisión.

## Evidencia de calidad de la última entrega

- `pnpm check` pasa formato, tipos, pruebas y compilación.
- Contratos: 30 pruebas aprobadas.
- Web: 40 pruebas aprobadas.
- API: 88 pruebas aprobadas y 2 suites de integración omitidas cuando no hay PostgreSQL de CI.
- Producción: `https://cobranzaap.tech/api/health` responde con la versión desplegada y los servicios API, web, worker y PostgreSQL están activos.

## Próximo desbloqueo

Definir el destino principal del crédito piloto y someterlo a revisión legal/contable. Después se puede convertir el producto en un conjunto de reglas versionadas y construir el motor financiero con ejemplos dorados, sin alterar los datos ya capturados.
