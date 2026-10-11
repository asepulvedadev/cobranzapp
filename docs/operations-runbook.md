# Manual de operaciones

> **Estado:** Infraestructura activa de desarrollo, 2026-10-11.

## Mapa de servicios

| Componente | Ubicación |
|---|---|
| Repositorio privado | `github.com/asepulvedadev/cobranzapp` |
| GitHub Actions | `.github/workflows/ci.yml` y `.github/workflows/deploy.yml` |
| VPS | Servidor compartido AutoKing `2.24.115.58` |
| Directorio de ejecución | `/srv/cobranzapp` |
| Dirección HTTPS temporal | `https://cobranzapp.2.24.115.58.sslip.io` |
| Puertos locales web/API | `127.0.0.1:13200` / `127.0.0.1:18200` |
| Sitio nginx | `/etc/nginx/sites-available/cobranzapp.conf` |
| Punto de entrada de despliegue | `/usr/local/sbin/cobranzapp-deploy-entry` |
| Script de copia de seguridad | `/usr/local/sbin/cobranzapp-backup` |

La clave SSH de GitHub Actions está limitada al punto de entrada de despliegue. No puede solicitar una consola, reenviar puertos ni ejecutar órdenes arbitrarias. El punto de entrada valida el SHA y el actor autorizado antes de invocar el script de despliegue, propiedad de `root`.

## Lanzamiento normal

Envíe una confirmación aprobada a `main`. GitHub Actions:

1. Ejecuta formato, comprobación de tipos, pruebas unitarias y compilaciones.
2. Construye las imágenes de la API, el procesador y la web, y publica etiquetas con el SHA en paquetes privados de GHCR.
3. Se conecta mediante la clave restringida de despliegue.
4. Descarga el SHA exacto, espera contenedores saludables y ejecuta pruebas de humo.
5. Registra la versión en `/srv/cobranzapp/.deployed-release`.

El script restaura la etiqueta anterior cuando falla una versión posterior y existe una versión previa. Las migraciones de base de datos no se incluyen hasta aprobar su estrategia y el primer esquema físico.

## Verificación

```bash
curl --fail https://cobranzapp.2.24.115.58.sslip.io/health
curl --fail https://cobranzapp.2.24.115.58.sslip.io/api/ready
curl --fail https://cobranzapp.2.24.115.58.sslip.io/api/v1/status
```

En el VPS:

```bash
cd /srv/cobranzapp
docker compose --env-file .env --env-file .release.env -f compose.yaml ps
./smoke-test.sh http://127.0.0.1:13200 http://127.0.0.1:18200
docker compose --env-file .env --env-file .release.env -f compose.yaml logs --tail=100
```

## Copias de seguridad

Cada día a las 04:40 UTC se genera un volcado PostgreSQL en formato personalizado y se conservan 14 días en `/var/backups/cobranzapp`. Para ejecutarlo y validarlo manualmente:

```bash
sudo /usr/local/sbin/cobranzapp-backup
sha256sum -c /var/backups/cobranzapp/postgres-*.dump.sha256
latest=$(ls -1t /var/backups/cobranzapp/postgres-*.dump | head -n1)
docker exec -i cobranzapp-postgres-1 pg_restore --list < "$latest"
```

La inspección del catálogo se ejecuta dentro del contenedor para usar la misma versión principal de PostgreSQL que creó el volcado. El `pg_restore` instalado en el anfitrión puede ser anterior y rechazar un archivo válido.

Esta copia local solo es suficiente para la base de desarrollo. **No se deben introducir datos reales de clientes ni información financiera** hasta contar con copias externas cifradas, archivado continuo de WAL con recuperación a un punto en el tiempo, recuperación de llaves y una prueba aislada de restauración que cumpla los RPO/RTO aprobados.

## Límites de seguridad

- Solo nginx expone puertos públicos; la web y la API escuchan en la interfaz local, y PostgreSQL permanece en la red privada de Docker.
- Los secretos de ejecución viven en `/srv/cobranzapp/.env`, con modo `0600`, y no aparecen en Git, imágenes, registros ni GitHub Actions.
- Las credenciales de GHCR existen únicamente durante el trabajo y usan una configuración temporal de Docker que se elimina al finalizar.
- Las imágenes de aplicación se ejecutan con UID/GID `10001`; las imágenes base están fijadas por resumen y los recursos tienen límites.
- La dirección pública actual es un entorno temporal de desarrollo, no una autorización para operar un piloto real de crédito.

## Primeras acciones ante incidentes

1. Confirme el SHA desplegado y el estado de los contenedores.
2. Capture los registros pertinentes, sin secretos, y las horas exactas antes de reiniciar servicios.
3. Si la versión nueva causó el incidente, vuelva a ejecutar el SHA anterior mediante el punto de entrada o restaure `.release.env` e inicie las imágenes compatibles anteriores.
4. Nunca revierta un esquema incompatible únicamente cambiando la imagen. Use una corrección progresiva aprobada o el procedimiento de restauración y conciliación de la base de datos.
5. Verifique la salud de J4 y AutoKing después de cualquier cambio de red o nginx en el servidor compartido.
