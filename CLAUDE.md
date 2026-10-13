# MultiBar · plataforma de cartas digitales y pedidos (autonomIA Lab)

Repositorio: **`Carloswxht/multibar-platform`** (renombrado por Carlos el 13 oct; antes `la-mar-de-gambas`). Nombre del producto: **MultiBar, de autonomIA Lab**.

Proyecto de Carlos (autonomIA Lab): **una plataforma para muchos bares**, con una sola web y una sola base de datos, cada bar totalmente separado de los demás y con su propio aspecto. Carta digital por QR desde el móvil, pedidos desde la mesa y panel de barra. Primer cliente y piloto: **La Mar de Gambas** (ficha en `datos/bares/lamardegambas/NOTAS.md`). Es un proyecto aparte de El Recreo (otro cliente con su propio repositorio y base): no compartir base de datos, archivos ni repositorio con él.

**Cómo están las notas:** este archivo = la plataforma (reglas, cómo funciona, pendientes generales). Cada bar tiene su ficha en `datos/bares/SLUG/NOTAS.md`. Las notas antiguas están en `archivo/HISTORIAL.md`.

## La idea de la plataforma (Carlos, 12 oct)
- La Mar de Gambas debe seguir funcionando y viéndose como ahora y salir a operar cuanto antes: es lo más importante.
- Una sola base para todos los bares; nadie ve los datos de otro. Cada bar: su carta, sus mesas, sus pedidos y su personal.
- Cada bar se ve distinto (nombre, logo, colores, estilo, textos, organización de la carta) y todo se cambia **sin tocar código**, desde ajustes guardados en la base.
- Panel de autonomIA Lab (de Carlos) para dar de alta un bar y configurarlo con casillas y selectores, con vista previa. El panel de cada bar gestiona productos, precios, agotados y usuarios, pero no el diseño.
- Lo que pida un cliente se añade como **opción para todos, desactivada por defecto**, no como arreglo para uno.
- No tener en cuenta datos fiscales ni TPV por ahora. No borrar nada: lo antiguo se mueve a una carpeta de archivo.
- Repositorio renombrado a **`multibar-platform`** (13 oct); el producto se llama **MultiBar**.
- Firma pequeña "Carta digital por autonomIA Lab" (enlace a www.autonomialab.es) en el pie de cada carta y "Panel por autonomIA Lab" en la entrada del panel (12 oct).

## Plan por fases de la plataforma
- **Fase A (hecha 12–13 oct):** notas separadas (este archivo = plataforma; `datos/bares/SLUG/NOTAS.md` = cada bar; `archivo/HISTORIAL.md` = notas antiguas); `versiones/` y `og-gambas5.jpg` a `archivo/`; `fotos-cartas/` a `datos/bares/lamardegambas/`. Repositorio renombrado a `multibar-platform` el 13 oct.
- **Fase B (hecha y publicada el 12 oct, PR #11 fusionado por Carlos; base de Neon cambiada y comprobada):** "bar" en la base. Ver "MultiBar: cómo está hecho".
- **Migración a Supabase (hecha y publicada el 13 oct, PR #12 fusionado por Carlos):** la web usa el proyecto Supabase "multi-bar". Comprobado en real: Carlos entró en el panel y envió pedidos desde la Mesa 1, que llegaron a Supabase (no a Neon). Ver "Base de datos".
- **Fase C:** el aspecto sale de la ficha del bar (colores, logo, fuentes, textos, funciones activadas, iconos, imagen de WhatsApp); el diseño de La Mar de Gambas pasa a ser la primera plantilla.
- **Fase D:** panel de autonomIA Lab (alta de bares, casillas, vista previa, publicar) con un rol "plataforma" por encima del admin de cada bar.
- **Fase E en adelante:** más plantillas (minimalista, fotos grandes…), idiomas, fotos de productos, alérgenos, domicilios… cada una como opción apagada por defecto.
- Orden acordado: B antes de abrir La Mar de Gambas (con la base casi vacía es más seguro), abrir, y después C y D.

## MultiBar: cómo está hecho (Fase B, 12 oct)
- Tabla **`bares`**: `slug` (dirección corta, p. ej. `lamardegambas`), `nombre` (se escribe **una sola vez** y sale en carta, panel, tique y títulos), `subtitulo`, `zona_horaria` (para "pedidos de hoy"), `activo` (de baja = sin carta ni login) y `ajustes` (JSON; hoy solo `pie`: las líneas del pie de la carta). La Mar de Gambas es el **bar nº 1**.
- Pestañas, productos, mesas, pedidos y personal llevan `bar_id`. El id de pestaña y el número de mesa solo son únicos dentro de cada bar (todos pueden tener "Mesa 1").
- **Enlace / QR:** `/carta/?bar=SLUG&mesa=N&c=CÓDIGO`. Sin `bar=` se usa `BAR_POR_DEFECTO` (`lamardegambas`, en `comun/datos.js`), para que sigan valiendo los enlaces de antes. El panel (Mesas → Copiar enlace) ya da el enlace con `bar=`.
- **Personal:** cada usuario es de un bar; el correo es único en toda la plataforma (al entrar, el correo dice de qué bar es). El panel pinta el nombre del bar de la sesión; en la pantalla de entrar, el del enlace (`/panel/?bar=SLUG`) o el de por defecto.
- **Base:** `datos/funciones.sql` (nuevo) tiene todas las ventanillas (`create or replace`, se puede volver a ejecutar entera); `seguridad.sql` queda solo con lo que se crea una vez (zona `privado`, sesiones). Ventanilla nueva `carta_bar(bar)`; `carta_menu`, `carta_mesa`, `crear_pedido` y `mis_pedidos` reciben `p_bar`; las del panel se limitan siempre al bar de la sesión. Errores nuevos: `BAR_NO_VALIDO`, `EMAIL_EN_USO`.
- **Copia de reserva por bar:** `datos/bares/SLUG/menu.json` (antes `datos/menu-datos.json`, movido) y `datos/bares/SLUG/bar.json` (nombre, subtítulo y pie). Si la base dice que el bar no existe o está de baja, la carta no enseña la copia.
- La carta recuerda en el móvil el nombre del bar (`bar.SLUG`) para pintar la cabecera al momento.
- Cambio para la base real: `datos/cambios/2026-10-12-multibar.sql` (una transacción; pasa todo lo que hay al bar nº 1, no borra nada). **Aplicarlo a la vez que se fusiona el PR** (la web antigua no manda el bar y dejaría de ir unos minutos; aún no hay clientes reales).
- **Probado (12 oct):** la migración sobre una copia de la base de hoy da exactamente el mismo esquema que una instalación nueva; 31 pruebas por SQL como usuario anónimo con dos bares (un bar no ve ni toca pedidos, productos, precios, mesas ni usuarios del otro; QR de un bar no vale en otro; bar de baja sin carta ni login; último admin por bar; correo repetido); y en Chromium a 390 px contra la base local: La Mar de Gambas idéntica píxel a píxel a la v8 (salvo "Carta v9"), pedido en el bar de prueba que solo ve su panel, bar inexistente, enlace antiguo sin `bar=`. Sin errores en consola.
- **Para dar de alta un bar hoy (hasta la Fase D):** por SQL, con el OK de Carlos: `insert into bares (slug, nombre, subtitulo, ajustes)`, sus pestañas, productos, mesas y un usuario admin (contraseña provisional).

## Pendiente MultiBar (12 oct)
1. **War300 pausado por Carlos (12 oct)**: queda un hueco gratis en Supabase para el proyecto "multi-bar". Proyectos en su cuenta de Supabase: "Suelos la Giralda" (inactivo), "War300" (activo, a pausar), "autonomIA Lab" (activo, Frankfurt). No tocar ninguno de ellos ni El Recreo.
2. **Migración a Supabase (hecha y en marcha desde el 13 oct; PR #12 fusionado):** proyecto `multi-bar` (ref `dorunbacwnkwdatfscri`, Frankfurt, organización de Carlos). Tablas, datos (copiados de Neon y comprobados idénticos: carta, 10 mesas con sus mismos códigos, 3 usuarios con sus contraseñas, 5 pedidos de prueba), zona privada y las 22 funciones (firma idéntica a la copia probada). `comun/datos.js` llama a `https://dorunbacwnkwdatfscri.supabase.co/rest/v1/rpc/…` con la clave **publishable** (pública por diseño) en la cabecera `apikey`; ya no hace falta Neon Auth. Antes de fusionar se comprobó que Neon y Supabase eran idénticos. **Neon queda de reserva** (ya no recibe nada desde el 13 oct); se puede pausar o borrar más adelante con el OK de Carlos. Contraseña de admin: el 13 oct se le puso otra provisional en Supabase y Carlos la cambió por una suya. Pendiente: plan Pro (~25 $/mes, copias diarias) antes de abrir; Supabase Auth (recuperar contraseña por correo) y tiempo real más adelante.
   - **Cómo cargar cosas en Supabase desde Claude:** `execute_sql` funciona; `apply_migration` y cualquier SQL que contenga `DELETE` piden una confirmación que en la app de Carlos se cancela sola. Lo que lleve DELETE se le da a Carlos en una página con botón "Copiar" para pegarlo en Supabase → SQL Editor → Run (así se hizo `datos/cambios/2026-10-13-supabase-ultimo-paso.sql`; el aviso rojo "destructive" se confirma con Run). Enlace directo al editor: https://supabase.com/dashboard/project/dorunbacwnkwdatfscri/sql/new
   - Avisos del asesor de seguridad de Supabase esperados (por diseño): "RLS sin políticas" (las tablas están cerradas a propósito) y "funciones security definer ejecutables por anon" (son las 22 ventanillas).
3. **Dominio de la plataforma `carta.autonomialab.es`: ACTIVO desde el 13 oct** (GitHub Pages con tic verde; archivo `CNAME` creado por GitHub en `main`; Carlos comprobó que la carta y el panel abren). Comprobar que **Enforce HTTPS** está marcado. Historia: El dominio está en **DonDominio** (Parking & Zona DNS). Carlos: añadir un registro **CNAME** `carta` → `carloswxht.github.io` sin tocar los demás (correo: mail, pop, smtp, imap, webmail, ftp, bbdd, TXT spf). Ojo: `www` y la raíz apuntan al "parking" de DonDominio (la web www.autonomialab.es aún no está publicada) y hay un comodín `*` también al parking; el registro `carta` concreto manda sobre el comodín. Carlos creó el CNAME el 13 oct. Falta: en GitHub (navegador) Settings → Pages → Custom domain `carta.autonomialab.es` → Save y, cuando salga en verde, Enforce HTTPS. Con Supabase no hace falta dar de alta el dominio en ningún sitio más (la clave pública vale desde cualquier web). GitHub Pages admite UN dominio propio por repositorio: si un bar quiere el suyo, redirección en su registrador o, más adelante, Netlify/Vercel (no Cloudflare).
4. **Hecho (13 oct):** repositorio renombrado a `multibar-platform` y añadido a la sesión de Claude. La web de prueba pasa a `carloswxht.github.io/multibar-platform/` (la de `/la-mar-de-gambas/` deja de abrir) hasta activar `carta.autonomialab.es`.
5. Carlos: etiquetas `carta-v8-estable` y `carta-v9` desde Releases (el proxy de Claude no deja subir etiquetas).
6. Vistas que faltan (Fase C o cuando Carlos diga): número de pedido por bar (hoy es el número global); iconos y nombre al instalar la app siguen siendo de La Mar de Gambas; vista previa de WhatsApp quitada a petición de Carlos (volverá por bar con una página de entrada por bar); la portada (`index.html`) es la de La Mar de Gambas; colores y fuentes fijos en `comun/estilos.css`; estilos heredados de El Recreo en `carta/carta.css` (bloque THEME los anula).
7. Otros tipos de negocio (gimnasios…): opinión dada a Carlos el 12 oct: primero hostelería; más adelante un "tipo de negocio" por cliente que active sus funciones.

## Reglas de trabajo (siempre)
- Responder en español. Carlos dicta por voz: interpretar la intención, no el literal.
- Carlos solo tiene móvil, sin ordenador. Dar los pasos uno a uno y explicarlos para alguien que no programa.
- Debe verse y funcionar igual en iPhone (Safari) y Android (Chrome). Avisar de cualquier cosa sensible a Safari.
- Cada entrega con número de versión: etiqueta de git `carta-vN` y número visible en el pie (desde que la carta se separó en archivos). Las versiones antiguas de un solo archivo están en `archivo/versiones/`.
- Si Carlos pide "opina" o "analicemos", dar solo opinión, sin ejecutar cambios.
- No reproducir logos, personajes ni marcas de terceros tal cual. El nombre del local va en texto.
- Probar en pantalla de móvil (390 px) con capturas antes de entregar.
- **Cambios acotados:** cuando Carlos pida arreglar o cambiar algo de una parte (carta, panel, ticket, datos), tocar solo los archivos de esa parte. Si hace falta tocar otra, avisar antes y esperar su visto bueno.
- **Antes de una tarea grande:** explicar qué archivos se van a tocar y por qué, y esperar a que Carlos diga que sí. Antes de empezar, dejar guardada la versión estable con una etiqueta (por ejemplo `carta-v5-estable`).
- **Ramas:** trabajar siempre en una rama nueva con el nombre de la tarea, sin tocar `main`; para el panel, una rama por fase (`fase-3-login`, `fase-4-panel`, `fase-5-pedidos`). La web publicada sale de `main`. Al terminar, preparar un pull request para que Carlos lo revise y lo apruebe desde la app de GitHub. Nunca fusionar a `main` sin su aprobación.
- **Estructura:** al empezar el panel, separar en carpetas (`carta/`, `panel/`, `datos/`) y sacar lo común (menú, colores, acceso a la base de datos) a archivos compartidos. Una vez hecho, tocar el panel no debe mover la carta.
- **Al terminar cada sesión:** actualizar este `CLAUDE.md` (plataforma) y la `NOTAS.md` del bar que se haya tocado con lo hecho y lo que falta.
- **Notas por bar:** lo que es solo de un cliente (pestañas, precios dudosos, pendientes del local, usuarios de prueba) va en `datos/bares/SLUG/NOTAS.md`, no aquí.

## Lista de seguridad y legal (Carlos no es profesional: guiarle paso a paso y recordársela)
**Antes de publicar la carta (solo lectura)**
- [ ] 2FA en GitHub, correo, dominio y cuentas de base de datos.
- [ ] Alérgenos accesibles en la carta (obligatorio para locales de comida). Pedir la lista al local.
- [x] Fuentes de Google guardadas dentro del repositorio (no cargarlas desde Google) por RGPD. (Hecho en la Fase 1 del panel: `comun/fuentes/`.)
- [ ] Aviso legal y política de privacidad sencillos enlazados en el pie. (14 oct: página `legal/` hecha para todos los bares; falta poner los datos del titular de cada bar en `ajustes.legal` y que un asesor revise el texto.)
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

## Base de datos y login (Supabase desde el 13 oct; antes Neon)
- **Supabase** `multi-bar` (Frankfurt): ver "Pendiente MultiBar" punto 2. Roles de la web: `anon` (y `authenticated`). pgcrypto está en el esquema `extensions`; `seguridad.sql` crea atajos `privado.crypt/gen_salt/digest/gen_random_bytes`. Desde el contenedor de Claude no se llega a la API de Supabase (proxy): pruebas por SQL (`set local role anon`) y en el navegador con una base local que imita a Supabase.
- **Neon** (de reserva desde el 13 oct, la web ya no lo usa): proyecto `la-mar-de-gambas` (id `snowy-moon-50249964`, base `neondb`, Frankfurt, Postgres 17), en la cuenta de Carlos, separado de El Recreo. Data API con `db_anon_role = anonymous` y sin permisos por defecto; Neon Auth activado solo para el **pase anónimo** (JWT) que la Data API exige en cada llamada, con dominio de confianza `https://carloswxht.github.io`. Desde el contenedor de Claude no se llega a la Data API (proxy): las pruebas se hacen por SQL (`set local role anonymous`) y en el navegador con una base Postgres local.
- **Login del personal propio** (no Neon Auth: sus cookies de otro dominio las bloquea Safari): tabla `staff` (bcrypt con pgcrypto en el esquema `privado`), sesiones en `privado.sesiones` (hash del token, 16 h), 5 fallos = 15 min bloqueado, contraseña provisional obligatoria de cambiar.
- **Seguridad:** tablas cerradas a la web (RLS, sin permisos). La web solo ejecuta funciones `security definer` de `datos/funciones.sql`, que comprueban bar, rol, código de mesa, precio de la base, límites anti-spam (20 s y 10/h por móvil, 6 cada 10 min por mesa, 30 líneas, 1–20 uds, nota ≤ 140) y limpieza (pedidos > 30 días, notas > 24 h).
- **Plan gratis de Neon:** ~100 CU-horas/mes; con el panel preguntando cada 4 s la base no se duerme mientras el bar abre.
- Cada cambio en la base va en `datos/cambios/AAAA-MM-DD-nombre.sql` y se aplica solo con el OK de Carlos. Historial completo de fases en `archivo/HISTORIAL.md`.

## Control de mesas (14 oct, carta v11) — opción de la plataforma, apagada por defecto
- Con `bares.ajustes.control_mesas = true`, el QR de una mesa **solo deja pedir cuando el personal la abre** en el panel (menú → **Abrir mesas**, visible para camarero, barra y admin solo si el bar tiene la opción). Se cierra sola a las `ajustes.horas_mesa` horas (4 por defecto, entre 1 y 24) o al tocar «Cerrar». Evita pedidos desde fuera con un QR fotografiado.
- Base: columna `mesas.abierta_hasta`; `carta_mesa` devuelve `control` y `abierta`; `crear_pedido` da `MESA_CERRADA` si la mesa no está abierta; `panel_mesas` devuelve `abierta_hasta`; función nueva `panel_abrir_mesa(token, mesa, abrir)` (solo mesas de su bar). Los pedidos que crea el personal desde el panel no necesitan la mesa abierta. Cambio: `datos/cambios/2026-10-14-control-de-mesas.sql` (aplicado en Supabase el 14 oct, firma idéntica a la copia probada).
- Carta: con la mesa cerrada la cabecera dice "Mesa N cerrada · Avisa al camarero"; al enviar sale el aviso "MESA CERRADA"; vuelve a comprobar cada minuto y al volver a la carta, y al enviar bien quita el aviso.
- Para encender o apagar en un bar: `update bares set ajustes = ajustes || '{"control_mesas": true}' where slug = '…';` (apagar: `false`).

## Aviso legal y privacidad (14 oct, carta v10)
- Página común `legal/?bar=SLUG` (`legal/index.html`, `legal.css`, `legal.js`): aviso legal (LSSI-CE) y política de privacidad (RGPD) con el mismo texto para todos los bares; los datos del titular salen de `bares.ajustes.legal` = `{titular, nif, domicilio, email, telefono?, registro?}` (y de `bar.json` sin conexión). Responsable = el bar; autonomIA Lab = encargado del tratamiento.
- El enlace "Aviso legal y privacidad" sale en el pie de la carta (y "Privacidad" en la entrada del panel) **solo si el bar tiene `ajustes.legal` con titular**; sin datos, la página dice que no está disponible.
- Dice lo que de verdad hace la web: sin cookies de publicidad ni analítica; almacenamiento local técnico (número al azar del móvil, nombre del bar, sesión del personal); notas 24 h, pedidos 30 días; proveedores Supabase (UE, Fráncfort) y GitHub Pages (EE. UU., registra IP). Si cambia algo de eso (analítica, nuevos datos, otro proveedor), actualizar `legal.js` y su fecha.
- Es una plantilla: Carlos debe hacerla revisar por un asesor antes de abrir. Con cada bar hace falta además el contrato de encargado del tratamiento.
- Para poner los datos de un bar: `update bares set ajustes = ajustes || jsonb_build_object('legal', jsonb_build_object('titular', …, 'nif', …, 'domicilio', …, 'email', …)) where slug = '…';` (sin DELETE: lo puede hacer Claude con `execute_sql`, con el OK de Carlos) y copiarlo en `datos/bares/SLUG/bar.json`.

## Web y dominios
- Publicada con GitHub Pages desde `main` (`https://carta.autonomialab.es/` desde el 13 oct; `carloswxht.github.io/multibar-platform/` redirige allí). Enlaces internos relativos.
- `/carta/` = carta de cada bar (`?bar=SLUG`); `/panel/` = panel (`?bar=SLUG` solo para la pantalla de entrar); raíz `index.html` = portada provisional de La Mar de Gambas.
- **Los QR siempre con el dominio de la plataforma** (nunca github.io), para no reimprimir al cambiar de alojamiento: `https://carta.autonomialab.es/carta/?bar=SLUG&mesa=N&c=CÓDIGO` (el panel → Mesas → Copiar enlace ya lo da con este dominio si se abre desde él).
- **Evitar Cloudflare** para lo que ve el cliente (bloqueos de LaLiga en días de fútbol). Probar un día de partido.
- Nunca subir claves de administrador al repositorio ni al HTML; solo claves públicas con permisos mínimos.

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

## Panel de barra (diseño v8 aprobado por Carlos el 10 oct; no cambiar sin que lo pida)
- Fondo blanco, ancho máx. 760 px, botones ≥ 48 px, Oswald/DM Sans, importes "15,00 €". Cabecera: nombre del bar, vista en naranja oscuro, fecha y "en línea hh:mm".
- Menú (botón naranja abajo) según rol: camarero → Pedidos; barra → + Lista de precios (Hay/Agotado) y Resumen del día; admin → + precios, Mesas (enlace/QR de cada mesa) y Usuarios.
- Tarjeta de pedido "Pedido nº N", Mesa, hora, "hace N min", líneas con puntos, notas con ⚠, TOTAL. NUEVO → "Aceptar pedido" rosa `#C8375A` + "Servido"; EN PREPARACIÓN → "Marcar como servido" azul `#2556A3` + "Deshacer"; SERVIDO → apagada + "Deshacer". "✎ Modificar pedido" (líneas a 0) y "+ Nuevo pedido" (réplica de la carta dentro del panel). Pasa solo a preparación a los 3 min sin aceptar.
- Avisos: pitido, vibración (Android), destello, nº de nuevos en el título, Wake Lock. Con la pantalla bloqueada no avisa: tablet fija enchufada.
- Detalle completo y su historia en `archivo/HISTORIAL.md`. Demo con datos de ejemplo: https://claude.ai/artifact/4KhG8XRaDpR2GxiLqFAW2i (desactualizada desde MultiBar).

## Estructura de la carta (para tocar sin romper)
- `loadBar()` pinta nombre, subtítulo, pie y título del bar (base → copia `datos/bares/SLUG/bar.json`). `loadMenu()` (en `carta/carta.js`) carga el menú de la base (`datosCarta.menu`) o, si no responde, de `datos/bares/SLUG/menu.json`; cada producto: `n` (nombre con tamaño), `dn` (nombre a mostrar), `d` (nota), `p` (precio), `size` (Tapa/Plato/Copa/Botella), `only` (solo existe ese tamaño), `sec` (sección original), `dbId` (id único), `agotado` (solo desde la base).
- Pedidos en `carta.js`: `comprobarMesa()` (lee `?mesa`/`c`, activa `body.modo-pedir`), `sendOrder()`, `adjustSentItem()` (editar/anular), `refreshRoundStatuses()` (mis pedidos), `refrescarCarta()` (precios y agotados), `aviso()`. Todo el texto de la base se escapa con `esc()`.
- `renderCategories()` agrupa las filas del mismo producto bajo un único nombre y pinta los subtítulos de sección.
- `buildLine()` pinta cada fila y su control +/−/Agotado (`pintarControles()`); el tique se calcula con `cartLines()`.
- Cabecera fija: el `padding-top` del body se ajusta por JS (no tocar).
- Al tocar una pestaña, la página sube al principio (`window.scrollTo(0, 0)`, sin animación, solo si estabas más abajo) para que se vea el primer producto (v8, 11 oct, a petición de Carlos). El "Nuevo pedido" del panel ya lo hacía (`.nv-cuerpo` vuelve arriba).
- La barra inferior y el tique usan clases `.fixed-bottom`, `.dock`, `.panel`.

## Archivos de este repositorio
- `index.html` → portada provisional de La Mar de Gambas (raíz).
- `legal/` → aviso legal y privacidad de cada bar (`?bar=SLUG`).
- `carta/index.html`, `carta/carta.css`, `carta/carta.js` → la carta, publicada en `/carta/`.
- `comun/estilos.css` → colores y fuentes comunes de carta y panel. `comun/fuentes/` → Oswald y DM Sans (woff2, licencia OFL).
- `comun/datos.js` → **único** bloque de acceso a la base de datos y login: `apiRpc` (llama a las funciones de la base), `datosCarta` (menú, mesa, crear/editar pedido, mis pedidos), login del personal (`login`, `logout`, `comprobarSesion`, `cambiarPassword`, `getSesion`), `datosPanel` (pedidos, marcar, agotados, y lo del admin) y `textoError` (mensajes en español). Las funciones antiguas de El Recreo (`apiGet/apiPost/apiPatch/apiDelete`) se quitaron en la Fase 5. Cada llamada se corta a los 20 s (mala cobertura). Desde el 13 oct llama a Supabase con la clave pública; para cambiar de base se cambia solo este archivo.
- `datos/bares/SLUG/` → todo lo de cada bar: `NOTAS.md` (su ficha), `menu.json` y `bar.json` (copia de reserva), y en La Mar de Gambas `fotos-cartas/`.
- `datos/esquema.sql` → tablas de la base (con `bares`). `datos/datos-iniciales.sql` → bar nº 1, pestañas, productos y mesas de ejemplo (sale de `datos/bares/lamardegambas/menu.json`). `datos/seguridad.sql` → zona privada y sesiones del login. `datos/funciones.sql` → todas las funciones que usa la web y sus permisos.
- `panel/index.html`, `panel/panel.css`, `panel/panel.js` → panel de barra (diseño v8 aprobado), publicado en `/panel/`. Usa `comun/estilos.css` y `comun/datos.js`; no toca la carta.
- `datos/cambios/` → historial de cambios aplicados a la base después de crearla (un `.sql` por cambio, con fecha; los últimos, `2026-10-12-multibar.sql` (Neon) y `2026-10-13-supabase-ultimo-paso.sql` (Supabase)).
- `PRUEBAS-FASE-5.md` → lista de pruebas con móviles reales antes de imprimir los QR (y lista de seguridad y legal).
- `archivo/` → lo antiguo que no se usa (no se borra nada): `versiones/` (carta v5 de un solo archivo), `og-gambas5.jpg`, `HISTORIAL.md` (notas antiguas).
