# Development Setup

## Requirements

- Node.js 22.22 or newer
- pnpm 10.33.2 through Corepack
- Docker with Compose

## Start locally

```bash
cp .env.example .env
corepack enable
pnpm install
pnpm compose:up
pnpm dev
```

The web application runs on `http://localhost:3000`, the API on `http://localhost:3001`, and PostgreSQL is bound to local loopback on port `5432`.

Start the Expo workspace separately:

```bash
pnpm dev:mobile
```

## Quality gate

```bash
pnpm check
```

## Production delivery

Every push to `main` runs the quality gate, builds immutable API, worker, and web images, publishes them to GHCR, and deploys the exact commit SHA to the restricted VPS deployment entrypoint. Production PostgreSQL is private to the Docker network; nginx reaches only loopback-bound web and API ports.

The temporary development URL is `https://cobranzapp.2.24.115.58.sslip.io`. Replace it with the approved production domain before a live pilot.
