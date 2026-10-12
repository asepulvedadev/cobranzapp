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

Cada envío a `main` ejecuta el control de calidad, construye imágenes inmutables para la API, el procesador y la aplicación web, las publica en GHCR y despliega el SHA exacto de la confirmación mediante el punto de entrada restringido del VPS. Las solicitudes de integración ejecutan el mismo flujo de calidad sin desplegar. PostgreSQL permanece privado en la red de Docker; nginx solo accede a los puertos locales de la web y la API.

El entorno desplegado está disponible en `https://cobranzaap.tech`. La dirección técnica `https://cobranzapp.2.24.115.58.sslip.io` se conserva únicamente como respaldo operativo.

Los comandos operativos y los límites de recuperación están documentados en el [manual de operaciones](operations-runbook.md).
