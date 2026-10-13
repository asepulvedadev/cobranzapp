# Lanzamiento móvil

La aplicación móvil usa Expo y comparte contratos con la API. Las funciones de cámara,
ubicación y agenda requieren una compilación nativa; exportar la aplicación web no instala esos
permisos en un teléfono.

## Compilación interna

Desde `apps/mobile`, con una cuenta Expo/EAS autorizada:

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

El perfil `preview` genera un APK instalable para validación interna. Para iOS se requiere una
cuenta Apple Developer y certificados gestionados por EAS:

```bash
npx eas-cli@latest build --platform ios --profile preview
```

## Producción

```bash
npx eas-cli@latest build --platform all --profile production
```

No se guardan tokens Expo, certificados ni credenciales de tiendas en el repositorio. Antes de
publicar, validar el flujo de permisos de contactos, cámara y ubicación en equipos físicos y
confirmar que la URL de API apunte al entorno correcto.

El despliegue web/API continúa usando `pnpm deploy:direct` en el VPS; la distribución nativa es
un paso separado porque requiere firma y cuentas de las tiendas.
