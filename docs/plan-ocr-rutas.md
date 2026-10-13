# Plan de implementación: OCR de identidad y rutas con Waze

## Objetivo

Reducir el tiempo de alta de clientes sin perder control humano, privacidad ni
trazabilidad. El OCR propone datos; un usuario autorizado confirma. Las rutas
guardan direcciones y coordenadas, pero Waze sigue siendo la navegación final.

## Fases

### 1. Captura y datos básicos — implementada

- Alta de cliente dividida en cuatro pasos.
- Captura móvil de frente y reverso del documento.
- Almacenamiento privado de las imágenes en el VPS.
- WhatsApp separado del teléfono principal.
- Una o dos referencias.
- Enlaces de navegación a Waze por dirección.

### 2. OCR con confirmación — siguiente entrega

- Scanner nativo en Android con ML Kit Document Scanner.
- Reconocimiento de texto en español en el dispositivo.
- Lectura de frente, reverso y PDF417 cuando el dispositivo lo soporte.
- Normalización específica para cédulas colombianas.
- Vista de resultados con confianza por campo y edición manual.
- No se guarda ningún campo extraído hasta la confirmación del cobrador o supervisor.

### 3. Persistencia segura del OCR

- Tabla de extracciones con estado `pending`, `confirmed` o `rejected`.
- Cifrado de número completo y campos sensibles.
- Versión del modelo, confianza, usuario y fecha de confirmación.
- Auditoría y política de retención/borrado.
- Worker para procesar documentos sin bloquear el formulario.

### 4. Rutas operativas

- Geocodificar direcciones y guardar latitud/longitud con estado de precisión.
- Mostrar dirección, coordenada y enlace Waze por parada.
- Reordenar paradas manualmente.
- Asignar ruta a cobrador y marcar visita.
- Generar navegación a la siguiente parada.

### 5. Optimización opcional

- Si se requiere ordenar automáticamente las visitas: integrar Google Routes API
  con `optimizeWaypointOrder`, o desplegar OSRM/GraphHopper en el VPS.
- Mantener Waze como aplicación de navegación y no como motor de optimización.

## Criterios de seguridad

- Las imágenes nunca son públicas.
- El OCR no reemplaza la revisión humana.
- Los datos de identidad se minimizan y se pueden eliminar según retención.
- Cada confirmación, corrección y rechazo queda auditado.
- Las claves de mapas/OCR se mantienen solo en el backend o en la compilación móvil segura.

## Criterios de aceptación

- Un cobrador captura dos caras en menos de un minuto.
- El sistema prellena los campos y muestra los errores de confianza.
- Un usuario puede corregir antes de guardar.
- Una parada abre Waze en móvil y web.
- La ruta conserva el orden y el responsable incluso si Waze no está instalado.
