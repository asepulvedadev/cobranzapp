# Dominio y correo de cobranzapp

> **Dominio aprobado:** `cobranzaap.tech`  
> **Correo institucional:** `info@cobranzaap.tech`

## Registros para la aplicación

| Tipo | Nombre | Valor | TTL |
|---|---|---|---:|
| A | `@` | `2.24.115.58` | `300` |
| A | `www` | `2.24.115.58` | `300` |

Antes de agregarlos, elimine únicamente los registros A, AAAA o CNAME existentes para `@` y `www` que entren en conflicto. No elimine registros de correo.

## Registros para Hostinger Email

| Tipo | Nombre | Prioridad | Valor | TTL |
|---|---|---:|---|---:|
| MX | `@` | `5` | `mx1.hostinger.com` | `300` |
| MX | `@` | `10` | `mx2.hostinger.com` | `300` |
| TXT | `@` | — | `v=spf1 include:_spf.mail.hostinger.com ~all` | `300` |
| CNAME | `hostingermail-a._domainkey` | — | `hostingermail-a.dkim.mail.hostinger.com` | `300` |
| CNAME | `hostingermail-b._domainkey` | — | `hostingermail-b.dkim.mail.hostinger.com` | `300` |
| CNAME | `hostingermail-c._domainkey` | — | `hostingermail-c.dkim.mail.hostinger.com` | `300` |

Debe existir un solo registro SPF. Si Hostinger muestra valores distintos en **Correos → Administrar → Conectar dominio**, prevalecen los valores específicos del plan.

Después de crear el buzón `info@cobranzaap.tech`, agregue inicialmente este registro de monitoreo DMARC:

| Tipo | Nombre | Valor | TTL |
|---|---|---|---:|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:info@cobranzaap.tech; adkim=s; aspf=s` | `300` |

## Activación de TLS

El VPS ya acepta tráfico HTTP para `cobranzaap.tech` y `www.cobranzaap.tech`. Cuando los registros A resuelvan públicamente a `2.24.115.58`, se debe emitir el certificado de Let's Encrypt, activar la redirección HTTPS y ejecutar las pruebas de salud.
