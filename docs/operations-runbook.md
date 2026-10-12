# Manual de operaciones

> **Estado:** Infraestructura activa de desarrollo, 2026-10-11.

## Mapa de servicios

| Componente | Ubicación |
|---|---|
| Repositorio público | `github.com/asepulvedadev/cobranzapp` |
| Despliegue directo | `pnpm deploy:direct` desde una máquina autorizada |
| VPS | Servidor compartido AutoKing `2.24.115.58` |
| Directorio de ejecución | `/srv/cobranzapp` |
| Dirección HTTPS principal | `https://cobranzaap.tech` |
| Dirección técnica de respaldo | `https://cobranzapp.2.24.115.58.sslip.io` |
| Correo institucional | `info@cobranzaap.tech` |
| Puertos locales web/API | `127.0.0.1:13200` / `127.0.0.1:18200` |
| Roles PostgreSQL de ejecución | `cobranzapp_app` para API y `cobranzapp_worker` para trabajos |
| Sitio nginx | `/etc/nginx/sites-available/cobranzapp.conf` |
| Punto de entrada de despliegue | `infrastructure/scripts/deploy-direct-vps.sh` |
| Script de copia de seguridad | `/usr/local/sbin/cobranzapp-backup` |

La contraseña del VPS se lee únicamente desde `~/.autoking-vps-password`. El script exige un árbol Git limpio, ejecuta `pnpm check`, construye imágenes con el SHA completo y transfiere un archivo temporal al VPS. No usa GitHub Actions ni publica imágenes en un registro.

## Lanzamiento normal

Ejecute desde el árbol limpio del repositorio:

```bash
pnpm deploy:direct
```

El comando aplica siempre este orden estricto:

1. Ejecuta formato, comprobación de tipos, pruebas unitarias y compilaciones.
2. Construye las imágenes de la API, el procesador y la web con el SHA exacto.
3. Transfiere y carga las tres imágenes en el VPS.
4. Espera PostgreSQL saludable.
5. Aplica migraciones con el propietario de migración; la API y el procesador conservan roles separados.
6. Levanta API, procesador y web, esperando sus health checks.
7. Ejecuta pruebas de humo y registra la versión en `/srv/cobranzapp/.deployed-release`.

El script restaura la etiqueta anterior cuando falla una versión posterior y existe una versión
previa. Las migraciones progresivas autorizadas se ejecutan antes de reemplazar los servicios. Una
migración irreversible exige copia verificada, revisión específica y estrategia de corrección o
restauración.

## Verificación

```bash
curl --fail https://cobranzaap.tech/health
curl --fail https://cobranzaap.tech/api/ready
curl --fail https://cobranzaap.tech/api/v1/status
```

En el VPS:

```bash
cd /srv/cobranzapp
docker compose --env-file .env --env-file .release.env -f compose.yaml ps
./smoke-test.sh http://127.0.0.1:13200 http://127.0.0.1:18200
docker compose --env-file .env --env-file .release.env -f compose.yaml logs --tail=100
docker compose --env-file .env --env-file .release.env -f compose.yaml logs --tail=100 worker
```

El procesador registra `outbox_processed`, `outbox_failed` y un latido periódico sin incluir el
contenido del evento. Los eventos fallidos usan intentos limitados y pasan a estado `dead`; no se
reintentan indefinidamente.

La consola del desarrollador muestra únicamente agregados de la cola: trabajos vencidos,
programados, en proceso, con arrendamiento vencido y en estado `dead`. Marca **Requieren atención**
cuando existe un trabajo `dead`, un arrendamiento vencido o el trabajo vencido más antiguo lleva
cinco minutos sin procesarse. Un estado **Operativos** con la cola vacía no demuestra por sí solo
que el proceso esté vivo; confirme también el latido en los registros del contenedor `worker`.

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
- La API y el procesador usan credenciales PostgreSQL diferentes. El procesador no puede leer usuarios globales ni tablas ajenas a sus manejadores autorizados.
- Las imágenes se transfieren por SSH en un archivo temporal y se eliminan después del lanzamiento.
- Las imágenes de aplicación se ejecutan con UID/GID `10001`; las imágenes base están fijadas por resumen y los recursos tienen límites.
- El dominio público corresponde todavía a un entorno de desarrollo, no a una autorización para operar un piloto real de crédito.

## Primeras acciones ante incidentes

1. Confirme el SHA desplegado y el estado de los contenedores.
2. Capture los registros pertinentes, sin secretos, y las horas exactas antes de reiniciar servicios.
3. Si la versión nueva causó el incidente, vuelva a ejecutar el SHA anterior mediante el punto de entrada o restaure `.release.env` e inicie las imágenes compatibles anteriores.
4. Nunca revierta un esquema incompatible únicamente cambiando la imagen. Use una corrección progresiva aprobada o el procedimiento de restauración y conciliación de la base de datos.
5. Verifique la salud de J4 y AutoKing después de cualquier cambio de red o nginx en el servidor compartido.
