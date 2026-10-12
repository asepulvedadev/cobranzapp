# Configuración de desarrollo

## Requisitos

- Node.js 22.22 o superior
- pnpm 10.33.2 mediante Corepack
- Docker con Compose

## Inicio local

```bash
cp .env.example .env
corepack enable
pnpm install
pnpm compose:up
pnpm dev
```

La aplicación web se ejecuta en `http://localhost:3000`, la API en `http://localhost:3001` y PostgreSQL escucha únicamente en la interfaz local, puerto `5432`.

El contrato OpenAPI 3.1 disponible se consulta en
`http://localhost:3001/v1/openapi.json`. Sus esquemas de autenticación se generan desde
`packages/contracts`, que también consumen la API y la aplicación web.

Inicie por separado el entorno de Expo:

```bash
pnpm dev:mobile
```

## Control de calidad

```bash
pnpm check
```

## Entrega a producción

El despliegue no depende de GitHub Actions. Desde una máquina autorizada, `pnpm deploy:direct` ejecuta el control de calidad, construye imágenes inmutables con el SHA exacto, las transfiere por SSH y aplica el orden estricto de PostgreSQL → migraciones → servicios → pruebas de humo. PostgreSQL permanece privado en la red de Docker; nginx solo accede a los puertos locales de la web y la API.

El entorno desplegado está disponible en `https://cobranzaap.tech`. La dirección técnica `https://cobranzapp.2.24.115.58.sslip.io` se conserva únicamente como respaldo operativo.

Los comandos operativos y los límites de recuperación están documentados en el [manual de operaciones](operations-runbook.md).
