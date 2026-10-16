# Pagos, comprobantes y portal privado

## Reglas de integridad

- Cada pago confirmado conserva valor, medio (`cash` o `transfer`), responsable, fecha y saldo restante.
- El valor de la cuota lo calcula el servidor desde las condiciones congeladas del crédito. La interfaz lo muestra antes de confirmar para evitar capturar una cifra distinta por error.
- Las cuotas se registran en orden y una sola vez. El comprobante nace únicamente después de persistir el pago.
- Una imagen de transferencia es opcional y permanece privada para personal autenticado. Nunca se publica en el portal del cliente ni en el comprobante compartible.
- El documento generado se denomina **comprobante de pago**. No se presenta como factura electrónica ni documento tributario.

## Enlaces públicos

- Los enlaces no contienen credenciales ni una sesión del empleado.
- El portal del cliente usa `borrowerId + nonce + HMAC`. El `nonce` puede rotarse o revocarse; al rotarlo, el enlace anterior deja de funcionar.
- El comprobante usa `paymentId + HMAC` y solo expone los datos mínimos del pago.
- Las rutas públicas usan `no-store`, `noindex` y `Referrer-Policy: no-referrer`.
- Los documentos de identidad, la selfie, los contactos de emergencia y la evidencia de transferencia nunca forman parte de las respuestas públicas.

## WhatsApp

El botón de compartir toma el WhatsApp guardado en el cliente y abre la conversación con el valor, saldo restante y enlace del comprobante ya diligenciados. El navegador o el teléfono exige que el operador confirme el envío.
