# Operations Runbook

> **Status:** Active development infrastructure, 2026-10-11.

## Service map

| Component | Location |
|---|---|
| Private source repository | `github.com/asepulvedadev/cobranzapp` |
| GitHub Actions | `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` |
| VPS | AutoKing shared host `2.24.115.58` |
| Runtime directory | `/srv/cobranzapp` |
| Temporary HTTPS URL | `https://cobranzapp.2.24.115.58.sslip.io` |
| Web/API loopback ports | `127.0.0.1:13200` / `127.0.0.1:18200` |
| nginx site | `/etc/nginx/sites-available/cobranzapp.conf` |
| Deployment entrypoint | `/usr/local/sbin/cobranzapp-deploy-entry` |
| Backup script | `/usr/local/sbin/cobranzapp-backup` |

The GitHub Actions SSH key is forced to the deployment entrypoint. It cannot request a shell, forward ports, or execute arbitrary commands. The entrypoint validates the commit SHA and authorized actor before invoking the root-owned deployment script.

## Normal release

Push an approved commit to `main`. GitHub Actions:

1. Runs formatting, type checking, unit tests, and builds.
2. Builds API, worker, and web images and pushes commit-SHA tags to private GHCR packages.
3. Connects with the restricted deployment key.
4. Pulls the exact SHA, waits for healthy containers, and runs smoke tests.
5. Records the release in `/srv/cobranzapp/.deployed-release`.

The deployment script restores the previous image tag when a later release fails and a previous release exists. Database migrations are intentionally absent until a reviewed migration strategy and first physical schema are approved.

## Verification

```bash
curl --fail https://cobranzapp.2.24.115.58.sslip.io/health
curl --fail https://cobranzapp.2.24.115.58.sslip.io/api/ready
curl --fail https://cobranzapp.2.24.115.58.sslip.io/api/v1/status
```

On the VPS:

```bash
cd /srv/cobranzapp
docker compose --env-file .env --env-file .release.env -f compose.yaml ps
./smoke-test.sh http://127.0.0.1:13200 http://127.0.0.1:18200
docker compose --env-file .env --env-file .release.env -f compose.yaml logs --tail=100
```

## Backups

A daily PostgreSQL custom-format dump runs at 04:40 UTC and retains 14 days in `/var/backups/cobranzapp`. Run and inspect it manually with:

```bash
sudo /usr/local/sbin/cobranzapp-backup
sha256sum -c /var/backups/cobranzapp/postgres-*.dump.sha256
```

This local backup is sufficient only for the development foundation. **Do not introduce real borrower or financial data** until encrypted offsite copies, continuous WAL archiving/PITR, key recovery, and an isolated restore drill meet the approved RPO/RTO.

## Security boundaries

- Only nginx exposes public ports; web and API bind to loopback, PostgreSQL stays inside the private Docker network.
- Runtime secrets live in `/srv/cobranzapp/.env` with mode `0600`; they are absent from Git, images, logs, and GitHub Actions.
- GHCR credentials are job-scoped and use a temporary Docker configuration removed after deployment.
- Application images run as UID/GID `10001`; pinned base-image digests and resource limits are configured.
- The current public URL is a temporary development endpoint, not authorization for a live lending pilot.

## Incident first actions

1. Confirm the deployed SHA and container state.
2. Capture relevant redacted logs and timestamps before restarting anything.
3. If a new release caused the incident, rerun the previous SHA through the deployment entrypoint or restore `.release.env` and start the previous compatible images.
4. Never roll back an incompatible database schema by image alone. Use an approved forward fix or database restoration/reconciliation procedure.
5. Verify J4 and AutoKing health after any shared-host networking or nginx change.
