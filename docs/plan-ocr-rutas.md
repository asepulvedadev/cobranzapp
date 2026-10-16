# Plan de implementación: OCR de identidad y rutas con Waze

## Objetivo

Reducir el tiempo de alta de clientes sin perder control humano, privacidad ni
trazabilidad. El OCR propone datos; un usuario autorizado confirma. Las rutas
guardan direcciones y coordenadas, pero Waze sigue siendo la navegación final.

## Fases

### 1. Captura y datos básicos — implementada

- Alta de cliente dividida en cuatro pasos.
- Captura móvil del frente obligatorio, reverso opcional y selfie obligatoria del cliente.
- Almacenamiento privado de las imágenes en el VPS.
- La carga móvil se puede reanudar: si falla una imagen o la reautenticación, el expediente ya
  creado no se duplica y solo se vuelven a enviar los documentos pendientes.
- WhatsApp separado del teléfono principal.
- Una o dos referencias.
- Enlaces de navegación a Waze por dirección.

### 2. OCR con confirmación — implementada en el VPS

- El worker procesa imágenes y la primera página de PDF con Tesseract 5.5 y español.
- El procesamiento es asíncrono mediante `outbox_events`, sin bloquear el alta.
- Se extraen sugerencias de nombre y número de documento, con confianza estimada.
- La vista de ficha permite editar y confirmar cada extracción.
- No se guarda ningún campo extraído en la identidad hasta la confirmación del usuario.
- ML Kit queda como mejora futura si se empaqueta una aplicación Android nativa.

### 3. Persistencia segura del OCR — implementada

- Tabla de extracciones con estados `pending`, `processing`, `ready`, `confirmed`, `rejected` y `failed`.
- Cifrado de número completo y campos sensibles.
- Versión del modelo, confianza, usuario y fecha de confirmación.
- Hash del texto OCR, auditoría y worker con reintentos.
- El almacenamiento de documentos continúa siendo privado en el volumen del VPS.

### 4. Rutas operativas — base implementada

- Las direcciones completas de casa y trabajo se guardan en el expediente.
- La creación exige confirmar por separado que casa y trabajo fueron verificadas con el cliente;
  cada confirmación queda fechada y asociada al usuario que la hizo.
- Web y móvil permiten corregir ambas direcciones en una sola operación; una corrección invalida
  las coordenadas anteriores antes de volver a ubicarlas.
- El tablero muestra la dirección y un enlace Waze por parada.
- La vista independiente **Rutas** está enlazada desde el sidebar para propietarios,
  supervisores y cobradores; carga clientes y rutas después de la reautenticación necesaria.
- En móvil, **Rutas** es una vista separada de Inicio y cada parada abre Waze usando coordenadas
  verificadas o la dirección completa como respaldo.
- Se puede asignar la ruta a un cobrador y activar/archivar la ruta.
- Se puede reordenar manualmente cada parada con controles subir/bajar.
- Se puede marcar cada parada como pendiente, realizada u omitida, con auditoría.
- La ubicación se puede consultar bajo demanda y queda cacheada por dirección; Waze usa
  coordenadas cuando existen y conserva el texto completo como respaldo.

### 6. Optimización opcional

- Si se requiere ordenar automáticamente las visitas: integrar Google Routes API
  con `optimizeWaypointOrder`, o desplegar OSRM/GraphHopper en el VPS.
- Mantener Waze como aplicación de navegación y no como motor de optimización.
- La geocodificación actual usa Nominatim con límite de una solicitud por segundo y solo se
  ejecuta cuando un usuario autorizado pulsa «Ubicar dirección».

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
- Si se corrige una dirección, sus coordenadas anteriores se invalidan antes de volver a ubicarla.

### 5. Verificación operativa — implementada

- La verificación vive en una vista independiente del inicio.
- Propietarios, supervisores y cobradores consultan únicamente con el número de cédula.
- La respuesta se limita al nombre, créditos vigentes, calificación de pago y reporte negativo.
- En móvil se usa la misma búsqueda rápida; no se expone el flujo avanzado de tokens y propósitos
  de la red consentida, que permanece reservado para una activación legal posterior.
