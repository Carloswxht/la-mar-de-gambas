# Lista de pruebas · Fase 5 (pedidos desde la mesa)

Hacer **antes de imprimir los QR**. Mientras no haya QR en las mesas, ningún cliente puede enviar pedidos: solo quien tenga el enlace con el código.

Necesitas dos aparatos: **A** = móvil "cliente" (mejor un iPhone) y **B** = móvil o tablet con el panel abierto.
Marca cada casilla cuando salga bien. Si algo falla, haz una captura y mándamela.

## Preparación
- [ ] 1. En **B**, entra en `carloswxht.github.io/la-mar-de-gambas/panel/` como admin. Toca la pantalla una vez (activa el sonido).
- [ ] 2. En **B**: menú → **Mesas** → Mesa 1 → **Copiar enlace**. Mándatelo a **A** (por WhatsApp a ti mismo, por ejemplo) y ábrelo en **A**.
- [ ] 3. En **A**, arriba debe poner **"MESA 1 · PIDE DESDE TU MESA"** y abajo del todo **"Carta v6"**.

## Pedido normal
- [ ] 4. En **A**: añade 2 productos (uno con nota, por ejemplo "sin sal") y pulsa **Enviar pedido a barra**. Sale "PEDIDO ENVIADO".
- [ ] 5. En **B**: aparece el pedido de la Mesa 1 con pitido, la nota y el total correcto.
- [ ] 6. En **A**, antes de 3 minutos: **Ver tique** → pulsa **+** en un producto. En **B** el pedido cambia (pitido corto) y el total sube.
- [ ] 7. En **B**: **Aceptar pedido**. En **A**, en unos segundos el tique pone **"EN PREPARACIÓN"** y ya no salen − / +.
- [ ] 8. En **B**: **Marcar como servido**. En **A** pone **"SERVIDO ✓"**.

## Casos especiales
- [ ] 9. **Anular:** en **A** haz otro pedido de 1 producto y, en el tique, pulsa **−** hasta 0 → pregunta "¿Anular el pedido?" → Aceptar. En **B** desaparece.
- [ ] 10. **Paso solo a preparación:** haz un pedido y no lo aceptes. A los 3 minutos **B** lo pasa a "en preparación" y **A** ya no deja cambiarlo.
- [ ] 11. **Dos pedidos seguidos:** envía dos pedidos con menos de 20 segundos entre ellos → el segundo dice "Acabas de enviar un pedido. Espera unos segundos."
- [ ] 12. **Agotado:** en **B** → Lista de precios → marca un producto **Agotado**. En **A** (en 1 minuto, o cerrando y abriendo la carta) sale en gris con "AGOTADO" y no se puede añadir.
- [ ] 13. **Precio:** en **B** (admin) cambia un precio y guarda. En **A** sale el precio nuevo (en 1 minuto, o al volver a abrir). Luego déjalo como estaba.
- [ ] 14. **QR falso:** en **A**, cambia una letra del final del enlace (lo que va detrás de `c=`) → arriba pone **"QR NO VÁLIDO · AVISA AL CAMARERO"** y no deja enviar.
- [ ] 15. **Sin QR:** en **A** abre `carloswxht.github.io/la-mar-de-gambas/carta/` → se ve la carta pero no hay botón de enviar ("Enséñale este tique al camarero").
- [ ] 16. **Sin cobertura:** en **A** añade algo, pon el **modo avión** y pulsa enviar → "No hay conexión…". Quita el modo avión y vuelve a enviar → sale bien.
- [ ] 17. **Desde el panel:** en **B**, "+" → Mesa 2 → pide algo → entra como NUEVO.

## En el otro tipo de móvil
- [ ] 18. Repite los pasos 2 a 8 con un **Android** (Chrome) como **A** si el primero era iPhone, o al revés.

## Al terminar
- [ ] 19. Dime **"borra los pedidos de prueba"** y los quito de la base (no se pueden borrar desde el panel).
- [ ] 20. Crea la etiqueta de versión **`carta-v6`** igual que hiciste con `carta-v5-estable` (GitHub → Releases → nueva → etiqueta `carta-v6` sobre `main`).

## Antes de poner los QR en las mesas (lista de seguridad y legal)
- [ ] Precios y platos aprobados por escrito por el local.
- [ ] Alérgenos en la carta (pedir la lista al local).
- [ ] Aviso legal y política de privacidad enlazados en el pie.
- [ ] Mesas reales (nombres y números) creadas en el panel → Mesas; desactivar las de ejemplo que sobren.
- [ ] Probar un día de partido (bloqueo de LaLiga) y con mala cobertura dentro del local.
- [ ] Copias de seguridad de la base.
- [ ] Revisar el plan gratis de Neon según las horas que abre el local.
