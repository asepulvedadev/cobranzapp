# cobranzapp

> **Estado:** Base de desarrollo v0.1. Actualizada el 2026-10-11. El monorepositorio, las aplicaciones web y móvil, la API, el procesador de tareas, PostgreSQL, la entrega con contenedores y la integración y el despliegue continuos están implementados. Las funciones de clientes y finanzas siguen condicionadas por las aprobaciones de la hoja de ruta.

Plataforma móvil y multiempresa para gestionar créditos y cobranzas de prestamistas independientes en **Colombia**, sin inteligencia artificial. Este índice reemplaza el anterior documento único de diseño. La estructura documental está confirmada; las propuestas tecnológicas y de producto no se consideran aprobadas salvo indicación explícita.

## Documento responsable de cada decisión

| Documento | Responsabilidad |
|---|---|
| [Diseño visual](design.md) | Interfaz, experiencia, navegación móvil, pantallas, presentación de marca y accesibilidad |
| [Recursos de marca v2](assets/brand-v2/README.md) | Isotipo aprobado, logotipo geométrico, composición transparente, variantes e instrucciones de exportación |
| [Recursos de marca para la aplicación](assets/brand-app/README.md) | Símbolo, nombre y archivos combinados para fondos claros y oscuros |
| [Producto](docs/product.md) | Problema, cliente, oferta, alcance y requisitos o supuestos confirmados |
| [Dominio](docs/domain.md) | Vocabulario, actores, funciones, relaciones de negocio y ciclo de vida |
| [Membresías aprobadas](docs/memberships.md) | Planes Pro y Ultra, límites, cobro de onboarding, permisos y alcance del enlace de cliente |
| [Reglas financieras](docs/financial-rules.md) | Valores nominales y netos, ejemplo de cargos e intereses, calendarios, asignaciones e invariantes contables |
| [Arquitectura](docs/architecture.md) | Módulos, dirección de dependencias, límites de ejecución y contratos de API |
| [Tecnologías](docs/stack.md) | Bibliotecas y entornos propuestos, alternativas y restricciones de compatibilidad |
| [Modelo PostgreSQL](docs/database.md) | Tablas lógicas, relaciones, claves de aislamiento, restricciones e índices |
| [Operaciones](docs/operations.md) | Vinculación, expediente y documentos del cliente, rutas de campo, supervisión y riesgo |
| [Red de verificación compartida](docs/verification-network.md) | Consentimiento, consulta mínima, correcciones, foto de perfil designada y perfiles operativos |
| [Sincronización sin conexión](docs/offline-sync.md) | Cola de captura, conciliación, conflictos, recuperación del dispositivo y autoridad del servidor |
| [Seguridad](docs/security.md) | Aislamiento entre empresas, acceso limitado, autenticación y protección de dispositivos y documentos |
| [Cumplimiento en Colombia](docs/compliance.md) | Revisión de tasas y cargos, límites de contacto y visita, derechos del cliente y condiciones de salida |
| [Analítica y automatización](docs/analytics-automation.md) | Métricas deterministas, informes, escenarios, reglas programadas y auditoría de ejecución |
| [Despliegue en VPS](docs/deployment.md) | Alojamiento, lanzamientos, migraciones, monitoreo, copias de seguridad y recuperación |
| [Plan de desarrollo](docs/development-plan.md) | Fases, unidades de trabajo, controles de calidad, lanzamiento en VPS y finalización del piloto |
| [Estado de implementación](docs/implementation-status.md) | Entregas verificadas, límites actuales y bloques protegidos |
| [Manual de operaciones](docs/operations-runbook.md) | Repositorio, despliegue directo al VPS, verificaciones de salud, copias de seguridad e incidentes |
| [Dominio y correo](docs/domain-email-setup.md) | Registros DNS, Hostinger Email y activación TLS |
| [Hoja de ruta](docs/roadmap.md) | Decisiones pendientes, evidencia, riesgos y autorización de construcción |
| [Referencias](docs/references.md) | Registro de fuentes primarias y procedencia |

## Hallazgos confirmados

- El nombre de la aplicación es **cobranzapp**. El isotipo y el logotipo geométrico están aprobados. Los archivos transparentes están en `assets/brand-app/`.
- El mercado inicial es Colombia, la moneda de referencia es COP, el idioma público es español colombiano (`es-CO`) y la zona horaria es `America/Bogota`.
- No se usarán Hermes, asistentes, modelos de lenguaje, aprendizaje automático ni OCR basado en modelos. El ingreso y la revisión de datos son manuales; la automatización usa reglas explícitas.
- Ejemplo reportado: COP 100.000 nominales, COP 10.000 retenidos por documentación, COP 90.000 entregados y COP 130.000 de pago futuro total.
- Frecuencias reportadas: 30 cuotas diarias, dos cuotas quincenales o un pago al final del mes.
- Cobradores y supervisores trabajan en campo y necesitan acceso limitado a la información del cliente y sus direcciones.
- Referencia visual seleccionada: [Aura personal-finance](https://personal-finance.aura.build/), adaptada primero para teléfonos con superficies oscuras, crema, amarillas y menta. La especificación vive únicamente en [design.md](design.md).

El ejemplo **no constituye una tarifa activa aprobada ni autorización para realizar visitas**. El cumplimiento, las fechas exactas, los redondeos, la asignación y el flujo de efectivo aún requieren revisión. Consulte los documentos financieros y de cumplimiento.

## Convención documental

Cada tema tiene un único documento responsable. Los demás documentos deben enlazarlo, no duplicar sus reglas. `design.md` contiene únicamente presentación e interacción. Se deben distinguir claramente los hechos confirmados por el usuario, las propuestas, los supuestos y los asuntos pendientes.

## Inicio rápido de desarrollo

```bash
cp .env.example .env
corepack enable
pnpm install
pnpm compose:up
pnpm dev
```

Consulte la [configuración de desarrollo](docs/development-setup.md) para conocer los servicios locales, las validaciones y la entrega automática.

- Repositorio público: `https://github.com/asepulvedadev/cobranzapp`
- Aplicación: `https://cobranzaap.tech`
- Dirección técnica de respaldo: `https://cobranzapp.2.24.115.58.sslip.io`
- Correo institucional aprobado: `info@cobranzaap.tech`

## Despliegue directo al VPS

El despliegue de producción se ejecuta directamente desde una máquina autorizada al VPS; no depende de GitHub Actions ni de un registro de imágenes. Use siempre el orden estricto de `pnpm deploy:direct`: control de calidad, construcción, transferencia de imágenes, PostgreSQL, migraciones, servicios y pruebas de humo.

## Despliegue seguro de identidad

Antes de levantar una versión, el servidor ejecuta las migraciones con la cuenta propietaria de
PostgreSQL. La API y el procesador se conectan después con `APP_DATABASE_USER`, una cuenta sin
privilegios de superusuario ni capacidad para omitir RLS.

El desarrollador se crea únicamente con el comando de aprovisionamiento y variables de entorno
temporales; su contraseña no debe guardarse en el repositorio ni en `.env`:

```bash
DATABASE_URL="postgresql://..." \
DEVELOPER_USERNAME="usuario" \
DEVELOPER_EMAIL="correo@ejemplo.com" \
DEVELOPER_DISPLAY_NAME="Nombre" \
DEVELOPER_PASSWORD="contraseña-temporal" \
pnpm db:bootstrap-developer
```

## Próximo descubrimiento

Determinar para qué usan principalmente los fondos los clientes; después, definir la clasificación del producto y someter a revisión legal la política de precios y cobranza. La base de ingeniería está autorizada, pero los flujos verticales de negocio siguen bloqueados por las condiciones pendientes de la hoja de ruta.
