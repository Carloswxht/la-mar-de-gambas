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

## Estado actual (última versión: v5, separada en archivos)
- Desde la Fase 1 del panel la carta ya no es un archivo único: `carta/index.html` (estructura) + `carta/carta.css` (estilos propios) + `carta/carta.js` (funcionamiento), y usa los archivos compartidos de `comun/`. Se ve exactamente igual que la v5 (comprobado píxel a píxel a 390 px y en tablet).
- El original de un solo archivo está guardado en `versiones/carta-digital-la-mar-de-gambas-v5.html`, y en git con la etiqueta `carta-v5-estable` (ver "Panel de barra").
- Los datos del menú están en **una sola copia**: `datos/menu-datos.json` (la carta lo lee al abrirse). 105 productos, 7 pestañas.
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

## Comportamiento actual de pedidos
- Se puede añadir con + / −, poner nota por producto y ver el tique con el total.
- **El pedido NO se envía a ningún sitio**: el cliente le enseña el tique al camarero. El botón "Enviar pedido a barra" está oculto y el tique dice "Enséñale este tique al camarero para pedir."
- Motivo: este local aún no tiene su propia base de datos ni panel de barra.

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
6. Opcional: **pedidos reales a un panel de barra**. Requiere su propia base de datos (no usar la de El Recreo) y un panel como el de El Recreo; hay que decidir con Carlos antes. Si se hace, avisar de esperar 30–60 s tras crear tablas antes de probar.
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
- `loadMenu()` (en `carta/carta.js`) carga el menú desde `datos/menu-datos.json`; cada producto: `n` (nombre con tamaño), `dn` (nombre a mostrar), `d` (nota), `p` (precio), `size` (Tapa/Plato/Copa/Botella), `only` (solo existe ese tamaño), `sec` (sección original), `dbId` (id único).
- `renderCategories()` agrupa las filas del mismo producto bajo un único nombre y pinta los subtítulos de sección.
- `buildLine()` pinta cada fila y su control +/−; el tique se calcula con `cartLines()`.
- Cabecera fija: el `padding-top` del body se ajusta por JS (no tocar).
- La barra inferior y el tique usan clases `.fixed-bottom`, `.dock`, `.panel`.

## Archivos de este repositorio
- `index.html` → portada provisional del local (raíz).
- `carta/index.html`, `carta/carta.css`, `carta/carta.js` → la carta, publicada en `/carta/`.
- `comun/estilos.css` → colores y fuentes comunes de carta y panel. `comun/fuentes/` → Oswald y DM Sans (woff2, licencia OFL).
- `comun/datos.js` → **único** bloque de acceso a la base de datos y login: `apiRpc` (llama a las funciones de la base), `datosCarta` (menú, mesa, crear/editar pedido, mis pedidos), login del personal (`login`, `logout`, `comprobarSesion`, `cambiarPassword`, `getSesion`), `datosPanel` (pedidos, marcar, agotados, y lo del admin) y `textoError` (mensajes en español). Quedan `apiGet/apiPost/apiPatch/apiDelete` antiguos de El Recreo que ya no sirven (tablas cerradas); se quitan en la Fase 5. Para migrar a Supabase se cambia solo este archivo.
- `datos/menu-datos.json` → datos del menú (única copia).
- `datos/esquema.sql` → tablas de la base. `datos/datos-iniciales.sql` → pestañas, productos y mesas de ejemplo (se genera desde `menu-datos.json`). `datos/seguridad.sql` → permisos, login del personal y todas las funciones que usa la web.
- `panel/index.html`, `panel/panel.css`, `panel/panel.js` → panel de barra, publicado en `/panel/` (Fase 4). Usa `comun/estilos.css` y `comun/datos.js`; no toca la carta.
- `og-gambas5.jpg` → imagen para compartir por WhatsApp.
- `fotos-cartas/` → `carta-1-bodega.jpg`, `carta-2-marisco.jpg`, `carta-3-postres.jpg`, `carta-4-bocados.jpg`, fotos de las cartas físicas. Son la fuente de verdad de los precios.
- `versiones/` → versiones antiguas: `carta-digital-la-mar-de-gambas-v5.html`.

## Panel de barra (en curso, una rama por fase)
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
  - **Modelo de seguridad:** todas las tablas cerradas a la web (RLS activada, sin permisos). La web (rol `anonymous` de la Data API, `db_anon_role`) solo puede ejecutar 19 funciones `security definer` que comprueban todo: `carta_menu`, `carta_mesa`, `crear_pedido`, `editar_pedido`, `mis_pedidos`, `personal_entrar/yo/salir/cambiar_password`, `panel_pedidos/marcar/modificar_pedido/productos/disponible`, `admin_guardar_producto`, `admin_usuarios`, `admin_guardar_usuario`, `admin_mesas`, `admin_guardar_mesa`. Las funciones del personal reciben el token de sesión y comprueban el rol. Los ayudantes y pgcrypto están en el esquema `privado`, que la web no ve.
  - Reglas: el precio lo pone la base; código secreto de mesa obligatorio; límites anti-spam (20 s y 10/hora por móvil, 6 cada 10 min por mesa, 30 líneas, 1–20 unidades, nota ≤ 140); editar solo si `enviado` y < 3 min (lista vacía = anular); un producto agotado no se puede pedir (sí mantener en una edición); Deshacer = un paso atrás; no se puede quedar sin admin activo; productos no se borran (se ocultan); limpieza automática (pedidos > 30 días, notas > 24 h, sesiones caducadas) al crear cada pedido.
  - **Probado por SQL como usuario anónimo** (todo correcto): carta 7 pestañas/105 productos; tablas y esquema `privado` inaccesibles; pedido con precio falso → se cobra el de la base; código de mesa falso; 20 s; límite de mesa; cantidad 21; editar con otro móvil; editar tras Recibido y tras 3 min; agotado; camarero no puede marcar agotados; barra no puede cambiar precios; admin cambia precio y la carta lo ve; quitar el último admin; 5 fallos → bloqueo; token inventado. Datos de prueba borrados.
  - **Usuarios de prueba creados** (contraseña provisional dada a Carlos por el chat, NO guardada en el repo; deben cambiarla al entrar): `carloswxht+admin@gmail.com` (admin), `carloswxht+barra@gmail.com` (barra), `carloswxht+camarero@gmail.com` (camarero).
  - El usuario de prueba que se creó en Neon Auth al principio de la fase se borró con el visto bueno de Carlos (Neon Auth queda sin usuarios). Neon Auth sigue activado solo por si hiciera falta el token anónimo.
  - Los correos de los usuarios de prueba son **alias de Gmail** (`carloswxht+…`): llegan al buzón de Carlos. Hoy el panel no envía ningún correo (no hay "olvidé mi contraseña": las contraseñas las resetea el admin).
  - No se ha podido probar desde aquí la llamada real por internet (el proxy de Claude Code bloquea neon.tech): se probará desde el móvil de Carlos con la pantalla de login de la Fase 4.
- **Fase 4 (hecha a falta de aprobar el diseño, 6 oct, rama `fase-4-panel`):** panel en `panel/` (`/panel/`, con `noindex`).
  - Login (correo + contraseña) y pantalla obligatoria para cambiar la contraseña provisional. La sesión se guarda en el móvil (localStorage, 16 h).
  - **Pedidos** (todos los roles): consulta cada 4 s; contador de pendientes (nuevos + recibidos) en la cabecera, naranja si hay nuevos; filtros Nuevos / Recibidos / Servidos / Todos con su número; en "Todos" van primero los nuevos (más antiguos arriba), luego recibidos y al final los servidos plegados en gris (se despliegan tocando). Tarjeta: número de mesa grande, hora, minutos esperando (en rojo desde 10 min), etiquetas NUEVO / RECIBIDO / SERVIDO / EDITADO, aviso "el cliente aún puede cambiarlo (m:ss)", productos con cantidad y tamaño de color (Tapa/Plato/Copa/Botella), notas destacadas "⚠ NOTA", total. Botones de 58 px: nuevo → RECIBIDO / SERVIDO; recibido → SERVIDO / Deshacer; servido → Deshacer.
  - **Avisos:** botón "Toca aquí para activar el sonido y la vibración" (Safari no deja sonar sin un toque); pitido generado por el navegador (sin archivos), vibración (solo Android: el iPhone no vibra desde una web), destello naranja de la cabecera y número de nuevos en el título de la pestaña; pide mantener la pantalla encendida (Wake Lock, iOS 16.4+). Con la pantalla bloqueada no hay avisos: recomendado una tablet fija enchufada.
  - **Carta** (admin) / **Agotados** (barra): buscador, botón HAY/AGOTADO por producto; el admin además ve precio, "Editar" (nombre, descripción, precio, tamaño, pestaña, sección, visible, disponible) y "+ NUEVO".
  - **Usuarios** (admin): lista con rol y estado; crear (con contraseña provisional generada) y editar (rol, activo, contraseña provisional nueva).
  - **Mesas** (admin): enlace de cada mesa con su código (el que va en el QR), copiar, editar nombre/activa, cambiar código, crear mesa.
  - Todo el texto que viene de la base se escapa (las notas las escribe el cliente).
  - Probado en Chromium a 390×844 y tablet 1180×820 con la base simulada (el proxy de Claude Code no deja llegar a Neon): login, error de login, cambiar contraseña, pedidos, llegada de un pedido nuevo, Recibido, servidos plegados, carta admin, agotados (barra), usuarios, mesas, camarero (solo Pedidos). Sin errores en consola. No probado en Safari real: lo prueba Carlos.
- **Diseño v8 del panel (10 oct, rama `panel-diseno-v8`, encima de la Fase 4):** Carlos no aprobó el diseño oscuro y pidió copiar el aspecto de su referencia "panel la mar de gambas - v8.html" (solo referencia visual; no se trajo su modo demostración, ni el botón de fotos, ni "Eliminar mesa").
  - Fondo blanco; cabecera centrada "LA MAR DE GAMBAS" (azul marino, Oswald), debajo el nombre de la vista en naranja oscuro `#C25E14` y la línea "en línea · hh:mm:ss" (punto verde; rojo si no hay conexión; "toca la pantalla para activar el sonido" hasta el primer toque).
  - Naranja `#F08A3E` solo en botones principales (texto azul marino); rojo `#B0342A` solo para lo urgente (NUEVO, notas, espera ≥ 10 min, contador de nuevos del menú). Tarjetas blancas con borde fino gris, esquinas redondeadas, sin franjas laterales. Botones ≥ 48 px; ancho máximo 760 px.
  - **Pedidos:** 3 recuadros (Pendientes = nuevos + en preparación, Servidos hoy, Total hoy); "PEDIDOS PENDIENTES" (nuevos primero, luego en preparación, más antiguos arriba) y "SERVIDOS" (apagados). Tarjeta (cambio del 10 oct): "Pedido N" (id del pedido) va **dentro**, como franja de cabecera con el color del estado (rosado `#FBE4E1` si es NUEVO, naranja claro `#FFF1E3` en preparación, gris `#F4F6FA` servido) y el resto de la tarjeta siempre en **fondo blanco**; debajo "Mesa N" + hora; fila de estado + "hace N min"; productos con línea de puntos y precio; notas en rojo; TOTAL; botones.
  - **Estados (ver también los ajustes de abajo):** NUEVO (etiqueta roja, borde rojo, fondo `#FFF8F7`; botones "Aceptar pedido" naranja y "Servido" con borde azul) · EN PREPARACIÓN (etiqueta `#FFF1E3`/texto `#A94E0E`/borde `#F3C9A3`, tarjeta con borde naranja claro; "Marcar como servido" y "Deshacer"; si pasó solo, etiqueta "SIN ACEPTAR · AUTOMÁTICO" con borde punteado) · SERVIDO (apagado, "✓ Servido hh:mm · quién" y botón pequeño "Deshacer"). Etiqueta amarilla "MODIFICADO hh:mm" si el cliente lo editó.
  - **Menú:** botón naranja redondo abajo; hoja blanca con las vistas según el rol (camarero: Pedidos; barra: Pedidos, Lista de precios —solo Hay/Agotado—, Resumen del día; admin: todo + Mesas + Usuarios) y "Salir".
  - **Lista de precios** (admin): precio editable en cada fila, "Guardar cambios" en una barra fija con el número de cambios; tocar el nombre abre la edición completa; "Añadir producto". **Resumen del día:** pedidos, unidades, ventas totales y por artículo (de más a menos vendido), calculado en el panel con los pedidos de hoy. **Mesas:** enlace de cada mesa, "Copiar enlace", "Editar" (nombre, activa, cambiar código) y "Añadir mesa" por nombre (número siguiente automático). **Usuarios:** como antes, con el nuevo estilo.
  - **Cambio en la base (aplicado el 10 oct, con el OK de Carlos; `datos/cambios/2026-10-10-en-preparacion.sql`):** estado `recibido` → `en_preparacion`; columnas `orders.nuevo_desde` y `orders.auto_aceptado`; función `privado.auto_aceptar()` (los NUEVOS con más de 3 min sin aceptar pasan solos a en_preparacion con `auto_aceptado`), llamada desde `panel_pedidos` y `mis_pedidos`; "Deshacer" a NUEVO vuelve a contar 3 min; `panel_pedidos` devuelve desde las 00:00 de Madrid (o 12 h si es más); `pedido_json` devuelve `en_preparacion`, `aceptado_por` y `auto`. Probado por SQL y datos de prueba borrados.
  - **Ajustes del 10 oct (pedidos de Carlos):** sin etiquetas NUEVO ni EN PREPARACIÓN (el estado se sabe por el color de la tarjeta y por el botón principal: "Aceptar pedido" = nuevo, "Marcar como servido" = en preparación); tampoco "MODIFICADO" (quitada también a petición de Carlos: el cliente solo puede cambiar el pedido mientras está NUEVO, en los 3 primeros minutos; si lo cambia, el panel sigue avisando con un pitido corto). La etiqueta "SIN ACEPTAR · AUTOMÁTICO" también se quitó a petición de Carlos (da igual si lo aceptó alguien o pasó solo; la base sigue guardando `auto_aceptado`, pero el panel no lo muestra). Pedido NUEVO en familia rosa (sustituye al rojo del borde): franja `#FCE4EA`, borde `#C8375A` y botón "Aceptar pedido" rosa intenso `#C8375A` con texto blanco (variables `--rosa*` en `panel/panel.css`); en preparación (cambio posterior del 10 oct) en familia azul: franja `#E6EFFB`, borde `#B7CBEA` y botón "Marcar como servido" azul `#2556A3` con texto blanco (variables `--prep-*` y `--azul*`). Las notas ya no llevan la barrita lateral: solo fondo rosado claro con texto rojo.
  - **Modificar pedido desde el panel (10 oct, con el OK de Carlos; `datos/cambios/2026-10-10-modificar-pedido.sql`):** camarero, barra y admin pueden modificar un pedido en **cualquier estado, también servido** (la mesa dice que ya no quiere algo). Enlace "✎ Modificar pedido" bajo los botones de cada tarjeta → ventana con − / + por línea y "Añadir producto" (desplegable por pestañas, cantidad y nota; los **agotados no se pueden añadir**, igual que desde la carta). Quitar deja la línea a **0**: en la tarjeta sale en **gris clarito**, "0× … 0,00€" y sin su nota; lo añadido sale normal. El total lo recalcula la base. En la base: `order_items.quantity` admite 0 (solo el personal; el cliente sigue 1–20) y función nueva `panel_modificar_pedido(token, pedido, {lineas:[{id,cantidad}], nuevas:[{producto,cantidad,nota}]})` (máx. 40 líneas). En `datos.js`: `datosPanel.modificar`. El Resumen del día no cuenta las líneas a 0. Probado por SQL (quitar, añadir, pedido servido, agotado rechazado, token falso) y en Chromium.
  - El cliente solo puede cambiar su pedido mientras está NUEVO (3 primeros minutos y antes de "Aceptar pedido"); ya lo impedía la base.
  - Probado en Chromium a 390 px y 1024 px con la base simulada; sin errores.
- **Siguiente:** Carlos revisa las capturas y fusiona el PR del diseño v8 (incluye la Fase 4), prueba el login real en `/panel/`. Luego Fase 5 (activar en la carta: enviar pedidos, `?mesa=N&c=CÓDIGO`, edición 3 min, quitar funciones antiguas de `datos.js`, lista de pruebas). En la Fase 5, la carta debe mostrar "En preparación" en vez de "Recibido".
- Al añadir el dominio propio: añadirlo también como dominio de confianza en Neon Auth.
