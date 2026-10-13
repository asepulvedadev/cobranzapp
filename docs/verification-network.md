# Red de verificación compartida

> **Estado:** propuesta implementada como base técnica, deshabilitada por defecto hasta aprobar la política colombiana de tratamiento de datos, los acuerdos entre participantes y el flujo de consentimiento.

La red sustituye la idea de una “lista negra” por una consulta **consentida, mínima, explicable y corregible**. No es una calificación pública, no comparte documentos ni expone el nombre de la empresa que reportó un evento.

## Qué se comparte

- Una identidad se representa con un HMAC con clave del servidor sobre país, tipo y número de documento normalizados; el documento original nunca se guarda en esta red.
- Las únicas observaciones iniciales son `late_payment` y `payment_default`.
- La respuesta contiene únicamente estado (`no_observation`, `reported`, `disputed` o `no_consent`), categorías, cantidad vigente y última actualización.
- Cada observación exige evidencia interna, fecha de observación, vencimiento y consentimiento vigente.
- No se comparten saldos, montos, direcciones, teléfonos, fotografías, documentos, notas libres, etiquetas criminales ni decisiones automáticas.

## Consentimiento y derechos

1. La empresa registra el propósito, versión de política, referencia de evidencia y vencimiento.
2. El token de consentimiento debe entregarse a la persona titular; sin el token la consulta devuelve `no_consent`.
3. La persona puede abrir una corrección. La observación queda auditable y puede pasar a estado disputado.
4. Las empresas participantes deben definir responsable/encargado, retención, atención de consultas y reclamos, revocación y acuerdos de transferencia antes de activar la red.
5. Una respuesta negativa nunca puede ser el único criterio de aprobación o rechazo; debe existir revisión humana y una explicación objetiva.

La Ley 1581 exige consentimiento previo, expreso e informado, finalidad, calidad y transparencia para el tratamiento de datos personales ([SIC, Ley 1581](https://sedeelectronica.sic.gov.co/sites/default/files/normatividad/Ley_1581_2012.pdf)). La información financiera/comercial tiene reglas especiales de hábeas data ([Ley 1266](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?0=&i=34488)); por eso esta base técnica no habilita por sí sola reportes crediticios ni sustitución de operadores autorizados.

## Foto de perfil y personal operativo

La foto de perfil es la imagen que la persona designa para su ficha; **no es una selfie, no verifica identidad y no se usa para reconocimiento facial**. Se guardará como objeto privado con permisos de alcance, retención y eliminación. La migración también prepara perfiles de supervisores y cobradores con teléfono, direcciones, contactos de emergencia y tipo de sangre opcional. El tipo de sangre es un dato de salud sensible: nunca es obligatorio y requiere consentimiento y acceso restringido.

## Activación

La API solo expone la red cuando existe `VERIFICATION_NETWORK_HMAC_KEY` y la política operativa ha sido aprobada. Antes de activarla en producción faltan: revisión jurídica colombiana, texto de consentimiento en la interfaz, acuerdo entre participantes, procedimiento de corrección, retención/borrado, pruebas de aislamiento entre empresas y prueba de restauración de la base.

La interfaz de la empresa ya incluye un panel de piloto para registrar el consentimiento,
entregar el token, consultar el resultado mínimo, publicar una observación con vencimiento y
abrir una corrección. El panel no persiste el token en el navegador y muestra un mensaje de
funcionalidad pendiente cuando la clave operativa todavía no está configurada. La activación
de producción sigue siendo una decisión separada de la entrega de la interfaz.

La búsqueda rápida de cliente por cédula usa un flujo separado y reducido: antes de consultar,
el propietario, supervisor o cobrador debe marcar que el cliente autorizó la consulta; esa
confirmación queda registrada en la auditoría. Esta búsqueda no habilita la red avanzada ni
comparte datos adicionales.
