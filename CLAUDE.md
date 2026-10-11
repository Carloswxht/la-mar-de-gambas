# La Mar de Gambas · Carta digital

Proyecto de Carlos (autonomIA Lab) para el local **La Mar de Gambas Cervecerías** (Sevilla, desde 2007; grupo Puerto Seguro). Carta digital a la que se entra por QR desde el móvil. Es un proyecto aparte de El Recreo: no compartir base de datos, archivos ni repositorio con él.

## Reglas de trabajo (siempre)
- Responder en español. Carlos dicta por voz: interpretar la intención, no el literal.
- Carlos solo tiene móvil, sin ordenador. Dar los pasos uno a uno y explicarlos para alguien que no programa.
- Debe verse y funcionar igual en iPhone (Safari) y Android (Chrome). Avisar de cualquier cosa sensible a Safari.
- Cada entrega con número de versión: etiqueta de git `carta-vN` y número visible en el pie (desde que la carta se separó en archivos). Las versiones antiguas de un solo archivo están en `versiones/`.
- Si Carlos pide "opina" o "analicemos", dar solo opinión, sin ejecutar cambios.
- No reproducir logos, personajes ni marcas de terceros tal cual. El nombre del local va en texto.
- Probar en pantalla de móvil (390 px) con capturas antes de entregar.
- **Cambios acotados:** cuando Carlos pida arreglar o cambiar algo de una parte (carta, panel, ticket, datos), tocar solo los archivos de esa parte. Si hace falta tocar otra, avisar antes y esperar su visto bueno.
- **Antes de una tarea grande:** explicar qué archivos se van a tocar y por qué, y esperar a que Carlos diga que sí. Antes de empezar, dejar guardada la versión estable con una etiqueta (por ejemplo `carta-v5-estable`).
- **Ramas:** trabajar siempre en una rama nueva con el nombre de la tarea, sin tocar `main`; para el panel, una rama por fase (`fase-3-login`, `fase-4-panel`, `fase-5-pedidos`). La web publicada sale de `main`. Al terminar, preparar un pull request para que Carlos lo revise y lo apruebe desde la app de GitHub. Nunca fusionar a `main` sin su aprobación.
- **Estructura:** al empezar el panel, separar en carpetas (`carta/`, `panel/`, `datos/`) y sacar lo común (menú, colores, acceso a la base de datos) a archivos compartidos. Una vez hecho, tocar el panel no debe mover la carta.
- **Al terminar cada sesión:** actualizar este `CLAUDE.md` con lo hecho y lo que falta.

## Lista de seguridad y legal (Carlos no es profesional: guiarle paso a paso y recordársela)
**Antes de publicar la carta (solo lectura)**
- [ ] 2FA en GitHub, correo, dominio y cuentas de base de datos.
- [ ] Alérgenos accesibles en la carta (obligatorio para locales de comida). Pedir la lista al local.
- [x] Fuentes de Google guardadas dentro del repositorio (no cargarlas desde Google) por RGPD. (Hecho en la Fase 1 del panel: `comun/fuentes/`.)
- [ ] Aviso legal y política de privacidad sencillos enlazados en el pie.
- [ ] Dominio a nombre del cliente. Acuerdo por escrito con el local (qué incluye, precio, quién paga dominio y base de datos, mantenimiento mensual).
- [ ] Precios y platos aprobados por escrito por el local antes de publicar.
- [ ] Probar en iPhone y Android reales, con mala cobertura, y un día de partido (bloqueo de LaLiga).
- [ ] `.gitignore` con `.env` y secretos; activar en GitHub la protección contra subida de secretos (secret scanning / push protection).

**Antes de activar pedidos reales (con base de datos)**
- [x] Base de datos separada del resto de clientes, con reglas de seguridad por fila (RLS) y permisos mínimos por rol (cliente de mesa, camarero, barra, admin). (Fase 3: tablas cerradas y solo funciones con control de rol, `datos/seguridad.sql`.)
- [x] Login real para camarero/barra/admin y PIN o login en el panel. Cliente anónimo solo puede crear su pedido. (Fase 3: correo + contraseña; la pantalla de login llega con el panel en la Fase 4.)
- [x] Límite de pedidos por mesa y por tiempo (anti-spam). (Fase 3.)
- [x] No guardar datos personales; si se guardan, informar, minimizar y poder borrarlos. (Fase 3: solo mesa y un número al azar del móvil; notas se vacían a las 24 h y pedidos se borran a los 30 días.)
- [x] Ninguna clave secreta (administrador, `service_role`, cadena de conexión) en el repositorio ni en el HTML. Solo claves públicas con permisos mínimos. (Revisar en cada fase.)
- [ ] Copias de seguridad periódicas fuera de la base y prueba de restauración.

**Al operar**
- [ ] Mantenimiento con cuota mensual aparte (cambios de precios, soporte).
- [ ] Si una clave se filtra: cambiarla de inmediato, no basta con borrarla del repositorio.
- [ ] Revisar y explicar a Carlos cada cambio antes de aprobarlo. No dar claves de administrador de producción a Claude Code si no hace falta; usar un proyecto de pruebas.

## Estado actual (última versión: v6 — pedidos desde la mesa, Fase 5; pendiente de que Carlos la pruebe y fusione)
- Desde la Fase 1 del panel la carta ya no es un archivo único: `carta/index.html` (estructura) + `carta/carta.css` (estilos propios) + `carta/carta.js` (funcionamiento), y usa los archivos compartidos de `comun/`. Se ve exactamente igual que la v5 (comprobado píxel a píxel a 390 px y en tablet).
- El original de un solo archivo está guardado en `versiones/carta-digital-la-mar-de-gambas-v5.html`, y en git con la etiqueta `carta-v5-estable` (ver "Panel de barra").
- El menú se lee de la **base** (`carta_menu`: precios y agotados al día). Si la base no responde en 6 s se usa la copia de reserva `datos/menu-datos.json` (105 productos, 7 pestañas; comprobado el 11 oct que coincide exactamente con la base). Si se cambia un producto en el panel, la copia de reserva queda desfasada: actualizarla de vez en cuando.
- Versiones a partir de ahora (decidido con Carlos el 6 oct): ya no se saca un `carta-digital-…-vN.html`; cada versión se marca con una etiqueta de git (`carta-v6`…) y un número visible en el pie de la carta (se añadirá con la v6).
- Fuentes Oswald y DM Sans guardadas en `comun/fuentes/` (ya no se cargan desde Google: RGPD hecho).
- Colores del local, sacados de sus cartas físicas (`fotos-cartas/`): azul marino `#14295E` (fondo oscuro `#0E1F4D`), naranja `#F08A3E`, blanco. Tipografía: Oswald para títulos y totales, DM Sans para el resto. Variables comunes en `comun/estilos.css`.
- Cabecera fija azul con "LA MAR DE GAMBAS" y "Cervecerías · Desde 2007"; pestañas con raya naranja en la activa; botón + naranja; barra inferior azul con total y botón "VER TIQUE" naranja.
- Los estilos de la carta están en `carta/carta.css`: un bloque `THEME` al final anula los estilos heredados de la carta de El Recreo (tema dorado).

## Pestañas (7)
Marisco y mar · Para picar · Fritos y croquetas · Carne y arroces · Panes · Postres · Bodega.
Dentro de las pestañas que juntan varias secciones, los nombres originales de la carta física salen como subtítulo (por ejemplo "El picoteo del puerto").

## Cómo se modelan los precios
- Muchos productos tienen **Tapa** y **Plato** (T./P. en la carta física) y los vinos **Copa** y **Botella**.
- Cada tamaño es una fila propia bajo el nombre del producto, con su precio y su propio botón + / −. Carlos descartó un selector global Tapa/Plato porque no lo entendía.
- Productos que solo existen en un tamaño salen como línea normal con la etiqueta ("Plato").
- En el tique, cada línea lleva el tamaño: "Croquetas de caña de lomo (Tapa)".

## Comportamiento actual de pedidos (v6, Fase 5)
- Se puede añadir con + / −, poner nota por producto (máx. 140 caracteres, 20 unidades por producto) y ver el tique con el total.
- **Con el QR de la mesa** (`/carta/?mesa=N&c=CÓDIGO`): la cabecera pone "MESA N · PIDE DESDE TU MESA" y salen "Enviar pedido a barra" (barra naranja encima de la barra azul) y el botón grande del tique. El pedido llega al panel como NUEVO.
- **Sin QR o con código falso:** solo mirar, como antes ("Enséñale este tique al camarero para pedir."). Con código falso la cabecera pone "QR NO VÁLIDO · AVISA AL CAMARERO". Si al abrir no hay cobertura para comprobar el código, se deja pedir y la base lo comprueba al enviar.
- **Tique:** cada pedido con su estado ("PEDIDO 1 · ENVIADO" naranja oscuro, "EN PREPARACIÓN" azul, "SERVIDO ✓" verde); mientras está NUEVO (3 min y sin "Aceptar pedido") lleva "puedes cambiarlo m:ss" y − / + por línea; quitar la última línea pregunta "¿Anular el pedido N?". Las líneas que el personal puso a 0 salen tachadas en gris. Los servidos se pliegan en "Ver pedidos anteriores". Se ven solo los pedidos de este móvil en esta mesa (últimas 12 h).
- La carta pregunta el estado cada 6 s mientras hay pedidos sin servir, y los precios/agotados cada minuto (y al volver a la pestaña). Si algo del pedido sin enviar se agota, se quita y se avisa. Un producto nuevo o retirado se ve al recargar.
- **Agotados:** en gris con la etiqueta "AGOTADO" y sin botón +.
- **Avisos** en la tarjeta con sello (reutiliza `.confirm`): "PEDIDO ENVIADO", "NO SE HA ENVIADO" (con el motivo en español de `textoError`), "YA EN MARCHA", "SE HA AGOTADO".
- **Mala cobertura:** cada llamada se corta a los 20 s; si al enviar se pierde la respuesta, la carta pregunta a la base si el pedido llegó antes de decir que falló (evita pedidos repetidos).

## Dudas de transcripción (confirmar con las cartas físicas)
- Carne mechá 6,50 € y Chicharrón de Cádiz 6,50 €: precio medio tapado en la foto.
- "Aliño de huevas": el borde de la foto lo cortaba.
- Presa ibérica, Secreto ibérico y Cachitos ibéricos: solo se leía el precio de plato; el de tapa estaba tachado.
- Alba Martín: la carta dice "D.O. Albariño", puesto como "albariño D.O.".
- Líneas tachadas con rotulador en la carta física: no se incluyeron.
- Mojama extra: solo plato (9,00 €/80 gr); hay un precio de tapa tachado.
- Pimentada de gambas con huevos fritos, Patatas para dipear (4,00 €) y Zamburiñas (2,50 €/ud) están como una línea cada una.

## Pendiente / próximos pasos
1. Publicar en GitHub Pages desde un repositorio propio y generar el **QR** para las mesas.
2. Cambiar la URL de la imagen de WhatsApp (`og:image` y `twitter:image` en el `<head>`): ya apunta a `https://carloswxht.github.io/la-mar-de-gambas/og-gambas5.jpg` (repositorio nuevo); comprobar que carga una vez publicada. Subir `og-gambas5.jpg` (ya hecha, 1200×630).
3. Alérgenos: la carta física los lleva en un QR aparte. Pedir la lista y añadirla (hay un botón "i" por categoría, hoy oculto).
4. Fotos de productos: hay un botón "FOTO" que aparece solo cuando un producto tiene imagen (se mantiene pulsado para verla). Los postres tienen foto en la carta física, pero hay que pedirlas aparte.
5. Opcional: logo de la gamba en la cabecera (usar una foto limpia que dé Carlos).
6. ~~Pedidos reales a un panel de barra~~: hecho (panel + Fase 5, ver "Panel de barra").
7. Opcional: buscador de productos arriba, y una pestaña "Lo mejor de la casa" con los platos estrella (el dueño debe decir cuáles).

## Infraestructura (decidida el 5 oct)
- Carlos trabaja desde el móvil con Claude Code + **GitHub**. Va a comprar un **dominio exclusivo** para el local. No hace falta VPS.
- **Frontend:** el HTML estático (`index.html`) en GitHub Pages. El dominio apunta a GitHub Pages (DNS en el registrador del dominio: 4 registros A a 185.199.108.153, .109.153, .110.153, .111.153 y un CNAME `www` a `carloswxht.github.io`; archivo `CNAME` en el repo con el dominio; activar HTTPS en Settings → Pages).
- **Base de datos (solo si se activan pedidos reales) — plan acordado el 5 oct:** hacer el **prototipo en Neon gratis** (proyecto nuevo, separado del de El Recreo, con Data API y el esquema de El Recreo: categories, products, orders, order_items, mesas) para enseñárselo al cliente. Si el cliente lo aprueba y pasa a producción, migrar a **Supabase** (mejor sistema de login para camarero/barra/admin, o a un plan de pago de Neon). Carlos tiene ya 2 proyectos gratis en Supabase ocupados; Supabase Pro cuesta unos 25 $/mes y cada proyecto extra unos 10 $/mes.
- **Para que migrar sea fácil:** poner TODO el acceso a datos y el login en un único bloque de código del HTML (funciones tipo `apiGet`, `apiPost`, `getAuthToken`, `login`), sin repartir llamadas por el resto del código. El esquema SQL se guarda en el repo (`esquema.sql`) para recrearlo en otra base. Las reglas de seguridad (RLS) se escriben aparte y se rehacen al migrar, porque las funciones de usuario difieren entre Neon y Supabase.
- Preferible que, al operar, la base esté en una cuenta a nombre del cliente o de Carlos con facturación clara.
- Si hay pedidos reales hará falta un panel de barra con PIN (el de El Recreo aún no lo tiene) antes de publicar.
- **Evitar Cloudflare** (proxy, DNS con proxy, Pages, Workers) para lo que ve el cliente: LaLiga bloquea rangos de IP de Cloudflare en España los días de fútbol, justo cuando un bar tiene más gente. Probar la carta un día de partido y comprobar en hayahora.futbol.
- Secretos: nunca subir al repositorio ni al HTML claves con permisos de administrador; solo credenciales públicas con permisos mínimos.

## Estructura de la web (decidida el 5 oct)
- **Raíz (`index.html`)** → web principal del local. Hoy es una portada provisional muy simple (nombre, azul marino y naranja, botón "Ver la carta" que lleva a `carta/`). Más adelante será la web completa del local.
- **`carta/index.html`** → la carta digital, que se ve en `/carta/`. Es una copia de la última versión (`carta-digital-la-mar-de-gambas-vN.html`); al sacar una versión nueva, copiarla aquí como `carta/index.html`.
- **Códigos QR de las mesas** → apuntan siempre a `/carta/` (no a la raíz). Más adelante llevarán el número de mesa: `/carta/?mesa=número`. Así se puede cambiar la portada sin reimprimir los QR.
- **`fotos-cartas/`** → fotos de las cartas físicas (fuente de verdad de los precios).
- **`versiones/`** → versiones antiguas de la carta.
- El enlace de la portada a la carta es relativo (`carta/`), para que funcione igual en `carloswxht.github.io/la-mar-de-gambas/` y en el dominio propio.

## Estructura de la carta (para tocar sin romper)
- `loadMenu()` (en `carta/carta.js`) carga el menú de la base (`datosCarta.menu`) o, si no responde, de `datos/menu-datos.json`; cada producto: `n` (nombre con tamaño), `dn` (nombre a mostrar), `d` (nota), `p` (precio), `size` (Tapa/Plato/Copa/Botella), `only` (solo existe ese tamaño), `sec` (sección original), `dbId` (id único), `agotado` (solo desde la base).
- Pedidos en `carta.js`: `comprobarMesa()` (lee `?mesa`/`c`, activa `body.modo-pedir`), `sendOrder()`, `adjustSentItem()` (editar/anular), `refreshRoundStatuses()` (mis pedidos), `refrescarCarta()` (precios y agotados), `aviso()`. Todo el texto de la base se escapa con `esc()`.
- `renderCategories()` agrupa las filas del mismo producto bajo un único nombre y pinta los subtítulos de sección.
- `buildLine()` pinta cada fila y su control +/−/Agotado (`pintarControles()`); el tique se calcula con `cartLines()`.
- Cabecera fija: el `padding-top` del body se ajusta por JS (no tocar).
- La barra inferior y el tique usan clases `.fixed-bottom`, `.dock`, `.panel`.

## Archivos de este repositorio
- `index.html` → portada provisional del local (raíz).
- `carta/index.html`, `carta/carta.css`, `carta/carta.js` → la carta, publicada en `/carta/`.
- `comun/estilos.css` → colores y fuentes comunes de carta y panel. `comun/fuentes/` → Oswald y DM Sans (woff2, licencia OFL).
- `comun/datos.js` → **único** bloque de acceso a la base de datos y login: `apiRpc` (llama a las funciones de la base), `datosCarta` (menú, mesa, crear/editar pedido, mis pedidos), login del personal (`login`, `logout`, `comprobarSesion`, `cambiarPassword`, `getSesion`), `datosPanel` (pedidos, marcar, agotados, y lo del admin) y `textoError` (mensajes en español). Las funciones antiguas de El Recreo (`apiGet/apiPost/apiPatch/apiDelete`) se quitaron en la Fase 5. Cada llamada se corta a los 20 s (mala cobertura). Para migrar a Supabase se cambia solo este archivo.
- `datos/menu-datos.json` → datos del menú (única copia).
- `datos/esquema.sql` → tablas de la base. `datos/datos-iniciales.sql` → pestañas, productos y mesas de ejemplo (se genera desde `menu-datos.json`). `datos/seguridad.sql` → permisos, login del personal y todas las funciones que usa la web.
- `panel/index.html`, `panel/panel.css`, `panel/panel.js` → panel de barra (diseño v8 aprobado), publicado en `/panel/`. Usa `comun/estilos.css` y `comun/datos.js`; no toca la carta.
- `datos/cambios/` → historial de cambios aplicados a la base después de crearla (un `.sql` por cambio, con fecha).
- `PRUEBAS-FASE-5.md` → lista de pruebas con móviles reales antes de imprimir los QR (y lista de seguridad y legal).
- `og-gambas5.jpg` → imagen para compartir por WhatsApp.
- `fotos-cartas/` → `carta-1-bodega.jpg`, `carta-2-marisco.jpg`, `carta-3-postres.jpg`, `carta-4-bocados.jpg`, fotos de las cartas físicas. Son la fuente de verdad de los precios.
- `versiones/` → versiones antiguas: `carta-digital-la-mar-de-gambas-v5.html`.

## Panel de barra (diseño aprobado y fusionado el 10 oct; Fase 5 hecha el 11 oct, falta probarla y fusionarla)
Ojo: `panel` es el nombre de la **rama** (copia de trabajo de todo el proyecto); la pantalla del camarero/barra/admin irá en la **carpeta** `panel/`.
Plan por fases; Carlos aprueba cada fase antes de pasar a la siguiente y un pull request por fase.
- **Fase 0 (hecha, 6 oct):** plan explicado. Decisiones de Carlos: rama `panel`; un PR por fase; mesas de ejemplo sencillas (mesas 1–10) hasta tener las reales; un usuario por persona; login con correo + contraseña; límites anti-spam propuestos (1 pedido cada 20 s y 10/hora por móvil, 6 pedidos cada 10 min por mesa, 30 líneas y 20 unidades por línea); la carta leerá precios de la base con la copia local de reserva; se activa con los precios de las cartas físicas mientras el local no los aprueba; pedidos se guardan 30 días y notas 24 h (revisar con el cliente al pasar a producción); tablet en la barra aún por decidir. Código secreto por mesa en el QR: **sí** (decidido el 6 oct). Los QR serán `/carta/?mesa=N&c=CÓDIGO`; la base solo acepta pedidos si el código coincide con el de la mesa. Si se cambia el código de una mesa, hay que reimprimir su QR.
- **Fase 1 (hecha, 6 oct):** carpetas `carta/`, `comun/`, `datos/`; fuentes locales; dirección de la base de El Recreo quitada de la carta y cambiada por la nueva. Etiqueta `carta-v5-estable` creada en `main` (si no está en GitHub, ver nota en el PR de la Fase 1).
- **Base de datos nueva (creada el 6 oct):** proyecto Neon `la-mar-de-gambas` (id `snowy-moon-50249964`, rama `main` = `br-restless-cell-b1qoubo5`, base `neondb`), región **AWS Frankfurt** (`aws-eu-central-1`), Postgres 17, en la misma cuenta de Neon de Carlos pero separado de El Recreo. Neon Auth activado (Better Auth) con dominio de confianza `https://carloswxht.github.io` (ya no se usa para el personal, ver Fase 3); Data API activada **sin permisos por defecto** y con `db_anon_role = anonymous`. Direcciones en `comun/datos.js`. Comprobado: sus IPs son de AWS, no de Cloudflare.
- **Fase 2 (hecha, 6 oct):** tablas creadas con `datos/esquema.sql` (categories, products, mesas, orders, order_items, staff) y cargadas con `datos/datos-iniciales.sql` (7 pestañas, 105 productos —comprobado que coinciden exactamente con `menu-datos.json`— y mesas 1–10 de ejemplo con su código secreto generado por la base, que no está en el repositorio). Todas las tablas con RLS activada y **sin ningún permiso para la web** (comprobado: `anonymous` y `authenticated` no pueden leer ni escribir nada). La carta todavía no lee de la base.
  - Pedidos: estados `enviado` → `en_preparacion` (antes `recibido`) → `servido`; cada línea copia nombre, tamaño y precio del momento; `device_key` es un número al azar del móvil (no es dato personal).
  - Plan gratis de Neon: 100 CU-horas al mes por proyecto ≈ 400 h de base despierta a 0,25 CU. Con el panel consultando cada 4 s la base no se duerme mientras el bar está abierto: unas 12 h/día caben justas; si abre más, pasar a plan de pago antes de producción.
  - Desde el contenedor de Claude Code no se puede llamar a la Data API ni a Neon Auth (el proxy lo bloquea); las pruebas de permisos se hacen por SQL (`set local role anonymous`) y las de la web desde el móvil de Carlos.
- **Fase 3 (hecha, 6 oct, rama `fase-3-login`):** seguridad y login aplicados en la base con `datos/seguridad.sql`, y `comun/datos.js` con las llamadas nuevas.
  - **Decisión importante:** el login del personal NO usa Neon Auth sino una tabla propia (`staff`, contraseñas bcrypt con pgcrypto en el esquema `privado`) y sesiones en `privado.sesiones` (se guarda el hash del token; duran 16 h). Motivo: Neon Auth usa cookies de otro dominio (neon.tech) que **Safari/iPhone bloquea** (ITP), así que el login fallaría en iPhone. 5 fallos seguidos bloquean 15 min. Contraseña provisional obligatoria de cambiar al primer acceso.
  - **Modelo de seguridad:** todas las tablas cerradas a la web (RLS activada, sin permisos). La web (rol `anonymous` de la Data API, `db_anon_role`) solo puede ejecutar 21 funciones `security definer` que comprueban todo: `carta_menu`, `carta_mesa`, `crear_pedido`, `editar_pedido`, `mis_pedidos`, `personal_entrar/yo/salir/cambiar_password`, `panel_pedidos/marcar/modificar_pedido/crear_pedido/mesas/productos/disponible`, `admin_guardar_producto`, `admin_usuarios`, `admin_guardar_usuario`, `admin_mesas`, `admin_guardar_mesa`. Las funciones del personal reciben el token de sesión y comprueban el rol. Los ayudantes y pgcrypto están en el esquema `privado`, que la web no ve.
  - Reglas: el precio lo pone la base; código secreto de mesa obligatorio; límites anti-spam (20 s y 10/hora por móvil, 6 cada 10 min por mesa, 30 líneas, 1–20 unidades, nota ≤ 140); editar solo si `enviado` y < 3 min (lista vacía = anular); un producto agotado no se puede pedir (sí mantener en una edición); Deshacer = un paso atrás; no se puede quedar sin admin activo; productos no se borran (se ocultan); limpieza automática (pedidos > 30 días, notas > 24 h, sesiones caducadas) al crear cada pedido.
  - **Probado por SQL como usuario anónimo** (todo correcto): carta 7 pestañas/105 productos; tablas y esquema `privado` inaccesibles; pedido con precio falso → se cobra el de la base; código de mesa falso; 20 s; límite de mesa; cantidad 21; editar con otro móvil; editar tras Recibido y tras 3 min; agotado; camarero no puede marcar agotados; barra no puede cambiar precios; admin cambia precio y la carta lo ve; quitar el último admin; 5 fallos → bloqueo; token inventado. Datos de prueba borrados.
  - **Usuarios de prueba creados** (contraseña provisional dada a Carlos por el chat, NO guardada en el repo; deben cambiarla al entrar): `carloswxht+admin@gmail.com` (admin), `carloswxht+barra@gmail.com` (barra), `carloswxht+camarero@gmail.com` (camarero).
  - El usuario de prueba que se creó en Neon Auth al principio de la fase se borró con el visto bueno de Carlos (Neon Auth queda sin usuarios). Neon Auth sigue activado porque la web necesita su pase anónimo (ver "Arreglo del acceso a la base").
  - Los correos de los usuarios de prueba son **alias de Gmail** (`carloswxht+…`): llegan al buzón de Carlos. Hoy el panel no envía ningún correo (no hay "olvidé mi contraseña": las contraseñas las resetea el admin).
  - No se ha podido probar desde aquí la llamada real por internet (el proxy de Claude Code bloquea neon.tech): se probará desde el móvil de Carlos con la pantalla de login de la Fase 4.
- **Fase 4 (hecha, 6 oct, rama `fase-4-panel`, PR #4):** primer panel con diseño oscuro (azul marino, tarjetas con mesa gigante, filtros Nuevos/Recibidos/Servidos/Todos). **Carlos no lo aprobó**; queda sustituido por el diseño v8. El PR #4 queda incluido en el PR #5.
- **Diseño v8 del panel — APROBADO por Carlos el 10 oct** (rama `panel-diseno-v8`, PR #5, que incluye la Fase 4). Partió de su referencia visual "panel la mar de gambas - v8.html" (no se trajo su modo demostración, ni el botón de fotos, ni "Eliminar mesa") y se fue ajustando en la misma sesión. **Estado actual (no cambiar sin que Carlos lo pida):**
  - **General:** fondo blanco; ancho máximo 760 px (móvil vertical y tablet); botones ≥ 48 px; Oswald para títulos y cifras, DM Sans para el texto; importes al estilo español con `Intl` es-ES ("15,00 €") y cifras alineadas (tabular-nums). Colores en variables al principio de `panel/panel.css`.
  - **Cabecera** centrada: "LA MAR DE GAMBAS" en azul marino; debajo el nombre de la vista en naranja oscuro `#C25E14`; debajo "Sábado, 10 de octubre · en línea 18:13" (punto verde; rojo y "sin conexión · reintentando…" si falla; "toca la pantalla para activar el sonido" hasta el primer toque).
  - **Menú:** botón naranja redondo abajo → hoja blanca con las vistas según el rol (camarero: Pedidos; barra: Pedidos, Lista de precios —solo Hay/Agotado—, Resumen del día; admin: además Mesas y Usuarios), el nombre del usuario y "Salir". La opción Pedidos muestra en rojo cuántos nuevos hay.
  - **Pedidos:** 3 recuadros (Pendientes = nuevos + en preparación, Servidos hoy, Ventas hoy); título "PEDIDOS PENDIENTES" con un **"+" discreto** a la derecha (círculo con borde azul marino → "¿Para qué mesa?" → carta); lista de pendientes (nuevos primero, luego en preparación, más antiguos arriba) y "SERVIDOS" (apagados, más recientes arriba).
  - **Tarjeta de pedido** (todas iguales, sin colores de estado): blanca, borde gris fino, esquinas redondeadas; franja de arriba gris claro `#F4F6FA` con "**Pedido nº N**"; debajo "Mesa N" y la hora; "hace N min" a la derecha (rojo desde 10 min); productos "2× Nombre (Tamaño) ···· 15,00 €" con línea de puntos; **notas** sin fondo, solo el triángulo ⚠ en rojo y el texto en negrita oscuro; línea quitada por el personal en **gris clarito y a 0** ("0× … 0,00 €"); TOTAL; botones; y dos enlaces pequeños "✎ Modificar pedido" y "+ Nuevo pedido". **Sin etiquetas** (ni NUEVO, ni EN PREPARACIÓN, ni MODIFICADO, ni SIN ACEPTAR · AUTOMÁTICO): el estado se sabe por el botón.
  - **Estados y botones** (el color va **solo en el botón principal**): NUEVO → "**Aceptar pedido**" rosa `#C8375A` (texto blanco) + "Servido" con borde azul marino · EN PREPARACIÓN → "**Marcar como servido**" azul `#2556A3` (texto blanco) + "Deshacer" · SERVIDO → tarjeta apagada, "✓ Servido hh:mm · quién" y botón pequeño "Deshacer".
  - **Modificar pedido** (camarero, barra y admin; en cualquier estado, **también servido**): ventana con − / + por producto; quitar deja la línea a 0 (no se borra); no se añaden productos aquí.
  - **Nuevo pedido del camarero:** desde "+ Nuevo pedido" de una tarjeta (la mesa va puesta) o desde el "+" de la pantalla principal (eligiendo mesa). Se abre una **réplica de la carta del cliente dentro del panel** (`#vNuevo`): cabecera azul "MESA N · NUEVO PEDIDO", pestañas con raya naranja, buscador, secciones, Tapa/Plato agrupados, botón + naranja redondo, − n +, nota por producto, barra azul con total y "ENVIAR PEDIDO", ✕ para cancelar (dos toques si hay productos). Los agotados salen en gris y no se pueden pedir. El pedido entra **como NUEVO**, igual que los del cliente (suena en los demás dispositivos, no en el del camarero que lo hizo). No toca `carta/`.
  - **Lista de precios:** buscador; por producto "Hay/Agotado" (agotado en gris, no en rojo) y, para el admin, precio editable con "Guardar cambios" en una barra fija; tocar el nombre abre la edición completa; "Añadir producto".
  - **Resumen del día:** fecha; ventas totales en grande con la **hora con más ventas**; recuadros Pedidos / Unidades / **Ticket medio**; ventas por artículo de más a menos (sin las líneas a 0). Se calcula en el panel con los pedidos de hoy (la base devuelve desde las 00:00 de Madrid).
  - **Mesas** (admin): enlace de cada mesa con su código (el del QR), "Copiar enlace", "Editar" (nombre, activa, cambiar código) y "Añadir mesa" por nombre (número siguiente automático). **Usuarios** (admin): lista con rol y estado, crear y editar.
  - **Acceso:** pantalla blanca con correo y contraseña y la nota "Acceso reservado al personal de La Mar de Gambas. Si has olvidado tu contraseña, pídesela al encargado."; contraseña provisional obligatoria de cambiar.
  - **Avisos:** pitido al llegar un pedido nuevo (pitido corto si el cliente edita el suyo), vibración (solo Android; el iPhone no vibra desde una web), destello de la cabecera, número de nuevos en el título de la pestaña y pantalla siempre encendida (Wake Lock, iOS 16.4+). El sonido se activa con el primer toque (límite de Safari). Con la pantalla bloqueada no hay avisos: recomendada una tablet fija enchufada.
  - **Demo para enseñar el diseño** (datos de ejemplo, sin base real; no está en el repositorio): https://claude.ai/artifact/4KhG8XRaDpR2GxiLqFAW2i — al cambiar el panel, regenerarla desde `panel/` con el simulador del scratchpad o avisar de que está desactualizada.
  - Probado en Chromium a 390 px y 1024 px con la base simulada; sin errores. **No probado aún contra la base real ni en Safari**: lo hará Carlos al fusionar el PR #5.
- **Cambios en la base del 10 oct (todos aplicados en Neon con el OK de Carlos; historial en `datos/cambios/`; `esquema.sql` y `seguridad.sql` ya los incluyen):**
  - `2026-10-10-en-preparacion.sql`: estado `recibido` → `en_preparacion`; columnas `orders.nuevo_desde` y `orders.auto_aceptado`; `privado.auto_aceptar()` pasa solos a preparación los NUEVOS con más de 3 min sin aceptar (se llama desde `panel_pedidos` y `mis_pedidos`); "Deshacer" a NUEVO vuelve a contar 3 min; `panel_pedidos` devuelve desde las 00:00 de Madrid (o 12 h si es más); `pedido_json` devuelve `en_preparacion`, `aceptado_por` y `auto`.
  - `2026-10-10-modificar-pedido.sql`: `order_items.quantity` admite 0 (solo el personal; el cliente sigue 1–20); `panel_modificar_pedido(token, pedido, {lineas:[{id,cantidad}], nuevas:[…]})` (el panel solo usa `lineas`).
  - `2026-10-10-pedido-desde-panel.sql`: `panel_crear_pedido(token, mesa, lineas)` (entra como NUEVO; sin código de QR ni anti-spam; sin agotados) y `panel_mesas(token)` (mesas sin códigos).
  - El cliente solo puede cambiar su pedido mientras está NUEVO (3 primeros minutos y antes de "Aceptar pedido").
  - En `comun/datos.js`: `datosPanel.modificar`, `datosPanel.crearPedido`, `datosPanel.mesasPanel`.
- **PR #5 fusionado por Carlos (10 oct).** Antes de la Fase 5 se guardó la rama `estable-panel-v8` (copia de `main` con el panel aprobado y la carta v5) por si hay que volver atrás.
- **Fase 5 (hecha el 11 oct, rama `fase-5-pedidos`, con el OK de Carlos):** pedidos desde la mesa en la carta (ver "Comportamiento actual de pedidos"). Archivos: `carta/carta.js`, `carta/index.html` ("Carta v6" en el pie), `carta/carta.css` (bloque "v6" al final), `comun/datos.js` (fuera funciones antiguas; corte a los 20 s), `PRUEBAS-FASE-5.md`. **Sin cambios en la base ni en el panel.**
  - Probado en Chromium a 390 px con la base simulada (misma lógica que `seguridad.sql`): sin QR, QR falso, QR bueno, agotado, enviar, editar, aviso de 20 s, en preparación (bloqueado), se agota en el carrito, cambio de precio, respuesta perdida, anular, servido con línea a 0, sin conexión, base caída al abrir (carta de reserva). Sin errores en consola. El panel sigue igual (comprobado). Comprobado por SQL que `carta_menu` de la base coincide exactamente con `menu-datos.json`. **No probado aún en Safari real ni contra la base por internet** (el proxy de Claude Code lo impide): lo hace Carlos con `PRUEBAS-FASE-5.md`.
- **Siguiente:**
  1. Carlos fusiona el PR de la Fase 5 y hace `PRUEBAS-FASE-5.md` con un iPhone y un Android. Después: borrar los pedidos de prueba (por SQL, con su OK) y crear la etiqueta `carta-v6` (desde Releases, como `carta-v5-estable`).
  2. Antes de imprimir los QR: lista de seguridad y legal (precios aprobados, alérgenos, aviso legal, mesas reales, copias de seguridad, plan de Neon). Los QR llevan el enlace de cada mesa que da el panel (Mesas → Copiar enlace).
  3. Ideas propuestas y no hechas (esperan a Carlos): icono propio para la pantalla de inicio; resumen de días anteriores; generar los QR imprimibles desde el panel.
- **Arreglo del acceso a la base (11 oct, rama `arreglo-acceso-base`):** al probar el panel real, el login falló con "missing authentication credentials: required authorization bearer token in JWT format". La Data API de Neon **exige siempre un pase JWT**, también para el visitante anónimo, y `apiRpc` solo lo pedía tras un 401. Ahora `comun/datos.js` pide el pase anónimo a Neon Auth (`GET /token/anonymous`) antes de cada llamada (guardado en memoria; si la base da 401 se renueva y se reintenta una vez). Si no se consigue el pase sale "No se ha podido conectar con la base de datos (pase …)". Afecta a carta y panel por igual (solo cambia `comun/datos.js`). Por eso **Neon Auth tiene que seguir activado** y con `https://carloswxht.github.io` como dominio de confianza. Probado con la base simulada exigiendo el pase; no se puede probar desde aquí contra Neon (proxy).
- Al añadir el dominio propio: añadirlo también como dominio de confianza en Neon Auth (si no, el pase anónimo no llegará y ni la carta ni el panel funcionarán).
