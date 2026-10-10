/* =====================================================================
   PANEL DE BARRA · La Mar de Gambas · diseño v8
   Todo el acceso a la base pasa por comun/datos.js (login, datosPanel,
   datosCarta). Aquí solo se pinta la pantalla y se reacciona a los toques.

   Estados de un pedido (iguales que en la base):
     enviado        → NUEVO (rojo)
     en_preparacion → EN PREPARACIÓN (naranja suave). Lo acepta el
                      personal o pasa solo a los 3 minutos (auto).
     servido        → SERVIDO (gris)
   ===================================================================== */

const CADA_MS = 4000;            // consulta de pedidos en vivo
const ROLES = { camarero: 'Camarero', barra: 'Barra', admin: 'Administrador' };
const TAMANOS = ['Tapa', 'Plato', 'Copa', 'Botella'];

// Vistas del menú y quién las ve.
const VISTAS = {
  pedidos:  { nombre: 'Pedidos',          cab: 'PEDIDOS',          roles: ['camarero', 'barra', 'admin'], icono: 'M7 4h10v16H7zM9.5 8h5M9.5 12h5M9.5 16h3' },
  precios:  { nombre: 'Lista de precios', cab: 'LISTA DE PRECIOS', roles: ['barra', 'admin'],             icono: 'M4 6h16M4 12h16M4 18h10M18 16v4' },
  resumen:  { nombre: 'Resumen del día',  cab: 'RESUMEN DEL DÍA',  roles: ['barra', 'admin'],             icono: 'M5 20V11M12 20V5M19 20v-7' },
  mesas:    { nombre: 'Mesas',            cab: 'MESAS',            roles: ['admin'],                      icono: 'M4 9h16M6 9v10M18 9v10M9 5h6' },
  usuarios: { nombre: 'Usuarios',         cab: 'USUARIOS',         roles: ['admin'],                      icono: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1.5-4 4.5-5 8-5s6.5 1 8 5' },
};

const estado = {
  sesion: null,
  vista: 'pedidos',
  pedidos: [],
  vistos: null,            // ids de pedidos nuevos ya avisados
  modificados: {},         // id -> fecha de la última edición del cliente
  ocupado: new Set(),      // pedidos con un botón en marcha
  productos: [],
  categorias: [],
  cambios: {},             // precios cambiados sin guardar: id -> precio
  usuarios: [],
  mesas: [],
  temporizador: null,
  sonidoActivo: false,
  ultimaCarga: null,
  sinConexion: false,
};

const $ = (id) => document.getElementById(id);

/* Escapar texto antes de meterlo en la página (las notas las escribe
   el cliente: nunca se pintan como HTML). */
function esc(t){
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function euros(n){ return Number(n || 0).toFixed(2).replace('.', ',') + '€'; }
function hora(f){ return new Date(f).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }
function minutosDesde(f){ return Math.max(0, Math.floor((Date.now() - new Date(f).getTime()) / 60000)); }
function textoEspera(min){
  if(min < 1) return 'ahora mismo';
  if(min < 60) return 'hace ' + min + ' min';
  return 'hace ' + Math.floor(min / 60) + ' h ' + String(min % 60).padStart(2, '0') + ' min';
}
function inicioDeHoy(){ const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
function deHoy(p){ return new Date(p.creado).getTime() >= inicioDeHoy(); }

let toastT = null;
function toast(texto, error){
  const t = $('toast');
  t.textContent = texto; t.className = 'toast' + (error ? ' error' : ''); t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, error ? 4500 : 2200);
}

/* ---------------- PANTALLAS ---------------- */
function mostrar(vista){
  ['vLogin', 'vPass', 'vPanel'].forEach(v => { $(v).hidden = (v !== vista); });
  $('cVivo').hidden = vista !== 'vPanel';
  if(vista === 'vLogin') $('cVista').textContent = 'PANEL DE BARRA';
  if(vista === 'vPass') $('cVista').textContent = 'TU CONTRASEÑA';
  window.scrollTo(0, 0);
}

async function arrancar(){
  let s = getSesion();
  if(s){
    try { s = await comprobarSesion(); }
    catch(e) { /* sin conexión: se sigue con la sesión guardada */ }
  }
  if(!s) return mostrar('vLogin');
  entrarConSesion(s);
}

function entrarConSesion(s){
  estado.sesion = s;
  if(s.cambiarPassword){ mostrar('vPass'); return; }
  $('menuUsuario').textContent = s.nombre + ' · ' + (ROLES[s.rol] || s.rol);
  pintarMenu();
  mostrar('vPanel');
  irA('pedidos');
  cargarPedidos();
  clearInterval(estado.temporizador);
  estado.temporizador = setInterval(cargarPedidos, CADA_MS);
}

function volverAlLogin(mensaje){
  clearInterval(estado.temporizador);
  cerrarMenu();
  estado.sesion = null; estado.pedidos = []; estado.vistos = null; estado.cambios = {};
  $('lPass').value = '';
  mostrar('vLogin');
  if(mensaje){ $('lError').textContent = mensaje; $('lError').hidden = false; }
}

// Errores comunes: sesión caducada → al login; lo demás, aviso.
function tratarError(e){
  if(e && e.codigo === 'SESION_CADUCADA'){ volverAlLogin(e.message); return; }
  toast((e && e.message) || 'Algo ha fallado.', true);
}

/* ---------------- LOGIN ---------------- */
$('fLogin').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const email = $('lEmail').value.trim(), pass = $('lPass').value;
  $('lError').hidden = true;
  if(!email || !pass){ $('lError').textContent = 'Escribe tu correo y tu contraseña.'; $('lError').hidden = false; return; }
  $('lBoton').disabled = true; $('lBoton').textContent = 'Entrando…';
  try {
    const s = await login(email, pass);
    $('lPass').value = '';
    if(s.cambiarPassword) $('pActual').value = pass;
    entrarConSesion(s);
  } catch(e) {
    $('lError').textContent = e.message; $('lError').hidden = false;
  } finally {
    $('lBoton').disabled = false; $('lBoton').textContent = 'Entrar';
  }
});

$('fPass').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const actual = $('pActual').value, nueva = $('pNueva').value, rep = $('pRepite').value;
  const err = (t) => { $('pError').textContent = t; $('pError').hidden = false; };
  $('pError').hidden = true;
  if(nueva.length < 8) return err('La contraseña nueva debe tener al menos 8 caracteres.');
  if(nueva !== rep) return err('Las dos contraseñas nuevas no coinciden.');
  if(nueva === actual) return err('La nueva tiene que ser distinta de la actual.');
  try {
    await cambiarPassword(actual, nueva);
    ['pActual', 'pNueva', 'pRepite'].forEach(id => { $(id).value = ''; });
    toast('Contraseña cambiada');
    entrarConSesion(getSesion());
  } catch(e) {
    if(e.codigo === 'SESION_CADUCADA') return volverAlLogin(e.message);
    err(e.codigo === 'CREDENCIALES' ? 'La contraseña actual no es correcta.' : e.message);
  }
});

async function salir(){
  await logout();
  volverAlLogin();
}
$('pSalir').addEventListener('click', salir);
$('bSalir').addEventListener('click', salir);

/* ---------------- MENÚ DE ABAJO ---------------- */
function vistasDelRol(rol){ return Object.keys(VISTAS).filter(v => VISTAS[v].roles.includes(rol)); }

function pintarMenu(){
  const nuevos = estado.pedidos.filter(p => p.estado === 'enviado').length;
  $('menuVistas').innerHTML = vistasDelRol(estado.sesion.rol).map(v => `
    <button class="menu-item ${estado.vista === v ? 'activo' : ''}" type="button" data-vista="${v}">
      <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${VISTAS[v].icono}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
      ${esc(VISTAS[v].nombre)}
      ${v === 'pedidos' && nuevos ? `<span class="cuenta">${nuevos} nuevo${nuevos === 1 ? '' : 's'}</span>` : ''}
    </button>`).join('');
}
function abrirMenu(){
  pintarMenu();
  $('velo').classList.add('ver'); $('hojaMenu').classList.add('ver');
  $('abrirMenu').setAttribute('aria-expanded', 'true');
}
function cerrarMenu(){
  $('velo').classList.remove('ver'); $('hojaMenu').classList.remove('ver');
  $('abrirMenu').setAttribute('aria-expanded', 'false');
}
$('abrirMenu').addEventListener('click', abrirMenu);
$('velo').addEventListener('click', cerrarMenu);
$('menuVistas').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-vista]');
  if(!b) return;
  cerrarMenu();
  irA(b.dataset.vista);
});

function irA(vista){
  if(!VISTAS[vista] || !VISTAS[vista].roles.includes(estado.sesion.rol)) vista = 'pedidos';
  estado.vista = vista;
  $('cVista').textContent = VISTAS[vista].cab;
  $('sPedidos').hidden = vista !== 'pedidos';
  $('sPrecios').hidden = vista !== 'precios';
  $('sResumen').hidden = vista !== 'resumen';
  $('sMesas').hidden = vista !== 'mesas';
  $('sUsuarios').hidden = vista !== 'usuarios';
  window.scrollTo(0, 0);
  if(vista === 'pedidos') pintarPedidos();
  if(vista === 'precios') cargarProductos();
  if(vista === 'resumen') pintarResumen();
  if(vista === 'mesas') cargarMesas();
  if(vista === 'usuarios') cargarUsuarios();
}

/* ---------------- LÍNEA "EN LÍNEA" DE LA CABECERA ---------------- */
function pintarVivo(){
  const v = $('cVivo');
  v.className = 'cab-vivo ' + (estado.sinConexion ? 'mal' : estado.ultimaCarga ? 'ok' : '');
  let t = estado.sinConexion ? 'sin conexión · reintentando…'
        : estado.ultimaCarga ? 'en línea · ' + estado.ultimaCarga.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : 'conectando…';
  $('cVivoTxt').innerHTML = esc(t) + (estado.sonidoActivo ? '' : ' · <b>toca la pantalla para activar el sonido</b>');
}

/* =====================================================================
   PEDIDOS EN VIVO
   ===================================================================== */
let cargando = false;
async function cargarPedidos(){
  if(cargando || !estado.sesion) return;
  cargando = true;
  try {
    const lista = await datosPanel.pedidos();
    estado.pedidos = Array.isArray(lista) ? lista : [];
    estado.ultimaCarga = new Date(); estado.sinConexion = false;
    detectarNovedades();
    if(estado.vista === 'pedidos') pintarPedidos();
    if(estado.vista === 'resumen') pintarResumen();
  } catch(e) {
    if(e.codigo === 'SESION_CADUCADA') return volverAlLogin(e.message);
    estado.sinConexion = true;
  } finally {
    cargando = false;
    pintarVivo();
  }
}

// Avisa (sonido, vibración y destello) de pedidos nuevos o editados.
function detectarNovedades(){
  const nuevos = estado.pedidos.filter(p => p.estado === 'enviado');
  if(estado.vistos === null){
    // Primera carga: lo que ya había no suena.
    estado.vistos = new Set(nuevos.map(p => p.id));
    estado.pedidos.forEach(p => { estado.modificados[p.id] = p.modificado; });
    return;
  }
  let hayNuevo = false, hayEditado = false;
  nuevos.forEach(p => { if(!estado.vistos.has(p.id)){ estado.vistos.add(p.id); hayNuevo = true; } });
  estado.pedidos.forEach(p => {
    if(p.modificado && estado.modificados[p.id] !== p.modificado && p.estado !== 'servido') hayEditado = true;
    estado.modificados[p.id] = p.modificado;
  });
  if(hayNuevo) avisar('nuevo');
  else if(hayEditado) avisar('editado');
}

const porCreacion = (a, b) => new Date(a.creado) - new Date(b.creado);

function pintarPedidos(){
  const ps = estado.pedidos;
  const nuevos = ps.filter(p => p.estado === 'enviado').sort(porCreacion);
  const prep = ps.filter(p => p.estado === 'en_preparacion').sort(porCreacion);
  const servidos = ps.filter(p => p.estado === 'servido').sort((a, b) => new Date(b.servido || b.creado) - new Date(a.servido || a.creado));

  $('nPendientes').textContent = nuevos.length + prep.length;
  $('nServidos').textContent = servidos.filter(deHoy).length;
  $('nTotalHoy').textContent = euros(ps.filter(deHoy).reduce((s, p) => s + Number(p.total || 0), 0));
  document.title = (nuevos.length ? '(' + nuevos.length + ') ' : '') + 'La Mar de Gambas · Panel';

  const pendientes = nuevos.concat(prep);
  $('listaPendientes').innerHTML = pendientes.length ? pendientes.map(tarjeta).join('') : '<div class="vacio">No hay pedidos pendientes ahora mismo.</div>';
  $('listaServidos').innerHTML = servidos.length ? servidos.map(tarjeta).join('') : '<div class="vacio">Aún no se ha servido ningún pedido.</div>';
}

function tarjeta(p){
  const servido = p.estado === 'servido';
  const min = minutosDesde(p.creado);
  const ocupado = estado.ocupado.has(p.id) ? 'disabled' : '';

  const lineas = (p.lineas || []).map(l => `
    <div class="linea"><span class="cant">${l.cantidad}×</span><span class="nombre">${esc(l.nombre)}</span><span class="puntos"></span><span class="precio">${euros(l.precio * l.cantidad)}</span></div>
    ${l.nota ? `<div class="nota">⚠ ${esc(l.nota)}</div>` : ''}`).join('');

  let etiquetas = '';
  // El estado se ve por el color de la tarjeta y por el botón principal
  // (Aceptar pedido / Marcar como servido): sin etiqueta NUEVO ni EN PREPARACIÓN.
  if(p.estado === 'en_preparacion' && p.auto){
    etiquetas = '<span class="etq etq-auto" title="Pasó solo a preparación porque nadie lo aceptó en 3 minutos">SIN ACEPTAR · AUTOMÁTICO</span>';
  }
  if(p.modificado && !servido) etiquetas += `<span class="etq etq-mod">MODIFICADO ${hora(p.modificado)}</span>`;

  let pie = '';
  if(p.estado === 'enviado'){
    pie = `<div class="t-botones">
      <button class="btn btn-rosa" data-accion="en_preparacion" data-id="${p.id}" ${ocupado}>Aceptar pedido</button>
      <button class="btn btn-borde" data-accion="servido" data-id="${p.id}" ${ocupado}>Servido</button></div>`;
  } else if(p.estado === 'en_preparacion'){
    pie = `<div class="t-botones">
      <button class="btn btn-naranja" data-accion="servido" data-id="${p.id}" ${ocupado}>Marcar como servido</button>
      <button class="btn btn-borde ajustado" data-accion="enviado" data-id="${p.id}" ${ocupado}>Deshacer</button></div>`;
  } else {
    pie = `<div class="t-servido">
      <span class="marca">✓ Servido${p.servido ? ' ' + hora(p.servido) : ''}${p.servido_por ? ' · ' + esc(p.servido_por) : ''}</span>
      <button class="btn btn-peq" data-accion="en_preparacion" data-id="${p.id}" ${ocupado}>Deshacer</button></div>`;
  }

  const clase = { enviado: 'nuevo', en_preparacion: 'prep', servido: 'servido' }[p.estado] || '';
  return `<div class="pedido ${servido ? 'servido' : ''}">
    <div class="tarjeta ${clase}">
      <div class="pedido-num">Pedido ${esc(p.id)}</div>
      <div class="t-arriba"><span class="t-mesa">${esc(p.mesa_nombre || ('Mesa ' + p.mesa))}</span><span class="t-hora">${hora(p.creado)}</span></div>
      ${servido ? '' : `<div class="t-estado"><span class="t-etiquetas">${etiquetas}</span><span class="t-espera ${min >= 10 ? 'tarde' : ''}">${textoEspera(min)}</span></div>`}
      ${lineas}
      <div class="t-total"><span>TOTAL</span><span>${euros(p.total)}</span></div>
      ${pie}
    </div>
  </div>`;
}

// Un único escuchador para los botones de todas las tarjetas.
async function alTocarPedido(ev){
  const b = ev.target.closest('button[data-accion]');
  if(!b || b.disabled) return;
  const id = Number(b.dataset.id), accion = b.dataset.accion;
  const antes = (estado.pedidos.find(x => x.id === id) || {}).estado;
  estado.ocupado.add(id); pintarPedidos();
  try {
    const p = await datosPanel.marcar(id, accion);
    const i = estado.pedidos.findIndex(x => x.id === id);
    if(i >= 0 && p) estado.pedidos[i] = p;
    // Al deshacer a "nuevo" no debe volver a sonar.
    if(accion === 'enviado' && estado.vistos) estado.vistos.add(id);
    const deshacer = (antes === 'servido' && accion === 'en_preparacion') || (antes === 'en_preparacion' && accion === 'enviado');
    const mesa = p ? (p.mesa_nombre || 'Mesa ' + p.mesa) : '';
    toast(deshacer ? 'Deshecho' : accion === 'servido' ? mesa + ': servido' : mesa + ': en preparación');
  } catch(e) {
    tratarError(e);
  } finally {
    estado.ocupado.delete(id);
    pintarPedidos();
  }
}
$('listaPendientes').addEventListener('click', alTocarPedido);
$('listaServidos').addEventListener('click', alTocarPedido);

/* ---------------- AVISOS: SONIDO, VIBRACIÓN, PANTALLA ENCENDIDA ----------------
   Safari (iPhone) no deja sonar nada hasta que la persona toca la pantalla,
   y no permite vibrar desde una web. El primer toque en cualquier sitio
   activa el sonido; además la cabecera parpadea y el título de la pestaña
   cuenta los pedidos nuevos. */
let audio = null, bloqueoPantalla = null;

function activarSonido(){
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if(AC){ audio = audio || new AC(); if(audio.state !== 'running') audio.resume(); }
  } catch(e) { /* sin sonido */ }
  mantenerPantalla();
  if(!estado.sonidoActivo && audio){
    estado.sonidoActivo = true;
    pintarVivo();
  }
}
['click', 'touchend'].forEach(t => document.addEventListener(t, activarSonido, { passive: true }));

function pitar(tipo){
  if(!audio) return;
  try {
    const notas = tipo === 'nuevo' ? [[880, 0], [1175, .18], [880, .36], [1175, .54]] : [[660, 0], [880, .18]];
    notas.forEach(([f, t]) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, audio.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.6, audio.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t + 0.16);
      o.connect(g); g.connect(audio.destination);
      o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.17);
    });
  } catch(e) { /* sin sonido */ }
}

function avisar(tipo){
  pitar(tipo);
  if(navigator.vibrate) navigator.vibrate(tipo === 'nuevo' ? [300, 150, 300, 150, 300] : [200]);
  document.body.classList.remove('destello'); void document.body.offsetWidth;
  document.body.classList.add('destello');
  setTimeout(() => document.body.classList.remove('destello'), 3000);
  if(tipo === 'nuevo' && estado.vista !== 'pedidos') toast('¡Pedido nuevo! Abre el menú y entra en Pedidos');
}

// Que la pantalla no se apague (iPhone con iOS 16.4 o más, y Android).
async function mantenerPantalla(){
  try {
    if('wakeLock' in navigator && !bloqueoPantalla && document.visibilityState === 'visible' && estado.sesion){
      bloqueoPantalla = await navigator.wakeLock.request('screen');
      bloqueoPantalla.addEventListener('release', () => { bloqueoPantalla = null; });
    }
  } catch(e) { /* no disponible */ }
}

document.addEventListener('visibilitychange', () => {
  if(document.visibilityState !== 'visible' || !estado.sesion) return;
  if(audio && audio.state !== 'running') audio.resume().catch(() => {});
  if(estado.sonidoActivo) mantenerPantalla();
  cargarPedidos();
});

// Cada 30 s se repintan los minutos de espera aunque no cambie nada.
setInterval(() => { if(estado.sesion && estado.vista === 'pedidos') pintarPedidos(); }, 30000);

/* =====================================================================
   LISTA DE PRECIOS: AGOTADOS (barra y admin) Y PRECIOS (admin)
   ===================================================================== */
async function cargarProductos(){
  const esAdmin = estado.sesion.rol === 'admin';
  $('nuevoProd').hidden = !esAdmin;
  $('barraGuardar').hidden = !esAdmin;
  $('preciosAyuda').textContent = esAdmin
    ? 'Cambia los precios y pulsa «Guardar cambios». Toca un nombre para editarlo. «Agotado» lo quita de la carta al momento.'
    : 'Toca «Hay» para marcar un producto como agotado, y otra vez cuando vuelva a haber.';
  $('listaProductos').innerHTML = '<div class="vacio">Cargando precios…</div>';
  try {
    const [prods, menu] = await Promise.all([datosPanel.productos(), estado.categorias.length ? null : datosCarta.menu()]);
    estado.productos = prods || [];
    if(menu) estado.categorias = menu.map(c => ({ id: c.id, nombre: c.name }));
    pintarProductos();
  } catch(e) {
    $('listaProductos').innerHTML = '';
    tratarError(e);
  }
}

function pintarProductos(){
  const esAdmin = estado.sesion.rol === 'admin';
  const q = $('buscaProd').value.trim().toLowerCase();
  let html = '', filas = 0;
  estado.categorias.forEach(c => {
    const prods = estado.productos.filter(p => p.categoria === c.id && (esAdmin || p.visible)
      && (!q || (p.nombre || '').toLowerCase().includes(q)));
    if(!prods.length) return;
    filas += prods.length;
    html += `<div class="cat-titulo">${esc(c.nombre)}</div>`;
    html += prods.map(p => {
      const cambiado = p.id in estado.cambios;
      const valor = cambiado ? estado.cambios[p.id] : Number(p.precio).toFixed(2);
      return `<div class="prod ${cambiado ? 'cambiado' : ''} ${p.visible ? '' : 'oculto'}" data-prod="${p.id}">
        <div class="prod-info">
          ${esAdmin ? `<button class="prod-nombre" type="button" data-editar="${p.id}">${esc(p.nombre)}</button>` : `<div class="prod-nombre">${esc(p.nombre)}</div>`}
          <div class="prod-sub">${p.visible ? '' : '<span class="chip">Oculto en la carta</span>'}${esc(p.descripcion || '')}</div>
        </div>
        <button class="hay ${p.disponible ? '' : 'agotado'}" type="button" data-disp="${p.id}" aria-pressed="${!p.disponible}">${p.disponible ? 'Hay' : 'Agotado'}</button>
        ${esAdmin
          ? `<label class="campo-precio"><input type="text" inputmode="decimal" data-precio="${p.id}" value="${esc(String(valor).replace('.', ','))}" aria-label="Precio de ${esc(p.nombre)}"><span>€</span></label>`
          : `<span class="precio-fijo">${euros(p.precio)}</span>`}
      </div>`;
    }).join('');
  });
  $('listaProductos').innerHTML = filas ? html : '<div class="vacio">No hay productos que coincidan.</div>';
  pintarCambios();
}

function pintarCambios(){
  const n = Object.keys(estado.cambios).length;
  $('nCambios').innerHTML = n === 0 ? 'Sin cambios' : `<b>${n}</b> ${n === 1 ? 'precio cambiado' : 'precios cambiados'}`;
  $('guardarPrecios').disabled = n === 0;
}

$('buscaProd').addEventListener('input', pintarProductos);

$('listaProductos').addEventListener('input', (ev) => {
  const inp = ev.target.closest('[data-precio]');
  if(!inp) return;
  const id = Number(inp.dataset.precio);
  const p = estado.productos.find(x => x.id === id);
  const v = Number(inp.value.replace(',', '.'));
  if(p && inp.value.trim() !== '' && !isNaN(v) && Math.abs(v - Number(p.precio)) < 0.005) delete estado.cambios[id];
  else estado.cambios[id] = inp.value.trim();
  inp.closest('.prod').classList.toggle('cambiado', id in estado.cambios);
  pintarCambios();
});

$('guardarPrecios').addEventListener('click', async () => {
  const ids = Object.keys(estado.cambios).map(Number);
  for(const id of ids){
    const v = Number(String(estado.cambios[id]).replace(',', '.'));
    if(String(estado.cambios[id]).trim() === '' || isNaN(v) || v < 0 || v >= 1000){
      const p = estado.productos.find(x => x.id === id);
      return toast('El precio de «' + (p ? p.nombre : id) + '» no es válido.', true);
    }
  }
  const b = $('guardarPrecios');
  b.disabled = true; b.textContent = 'Guardando…';
  try {
    for(const id of ids){
      const precio = Number(String(estado.cambios[id]).replace(',', '.'));
      await datosPanel.guardarProducto({ id, precio });
      const p = estado.productos.find(x => x.id === id);
      if(p) p.precio = precio;
      delete estado.cambios[id];
    }
    toast(ids.length === 1 ? 'Precio guardado' : ids.length + ' precios guardados');
  } catch(e) { tratarError(e); }
  b.textContent = 'Guardar cambios';
  pintarProductos();
});

$('listaProductos').addEventListener('click', async (ev) => {
  const disp = ev.target.closest('[data-disp]');
  if(disp){
    const p = estado.productos.find(x => x.id === Number(disp.dataset.disp));
    if(!p) return;
    disp.disabled = true;
    try {
      await datosPanel.disponible(p.id, !p.disponible);
      p.disponible = !p.disponible;
      toast(p.disponible ? p.nombre + ': vuelve a haber' : p.nombre + ': agotado');
    } catch(e) { tratarError(e); }
    pintarProductos();
    return;
  }
  const ed = ev.target.closest('[data-editar]');
  if(ed) editarProducto(estado.productos.find(x => x.id === Number(ed.dataset.editar)));
});

$('nuevoProd').addEventListener('click', () => editarProducto(null));

function editarProducto(p){
  const nuevo = !p;
  p = p || { categoria: (estado.categorias[0] || {}).id, nombre: '', nombre_corto: '', descripcion: '', tamano: '', seccion: '', precio: '', visible: true, disponible: true };
  abrirModal(nuevo ? 'Nuevo producto' : 'Editar producto', [
    { id: 'nombre', etiqueta: 'Nombre (como sale en el tique)', valor: p.nombre, ayuda: 'Ej.: Croquetas de puchero (Tapa)' },
    { id: 'nombre_corto', etiqueta: 'Nombre sin tamaño (para agrupar Tapa y Plato)', valor: p.nombre_corto || '' },
    { id: 'descripcion', etiqueta: 'Descripción', valor: p.descripcion || '' },
    { id: 'precio', etiqueta: 'Precio (€)', valor: p.precio === '' ? '' : String(p.precio).replace('.', ','), tipo: 'decimal' },
    { id: 'tamano', etiqueta: 'Tamaño', tipo: 'select', valor: p.tamano || '', opciones: [['', 'Sin tamaño'], ...TAMANOS.map(t => [t, t])] },
    { id: 'categoria', etiqueta: 'Pestaña de la carta', tipo: 'select', valor: p.categoria, opciones: estado.categorias.map(c => [c.id, c.nombre]) },
    { id: 'seccion', etiqueta: 'Sección (subtítulo)', valor: p.seccion || '' },
    { id: 'visible', etiqueta: 'Se ve en la carta', tipo: 'check', valor: p.visible },
    { id: 'disponible', etiqueta: 'Hay (no agotado)', tipo: 'check', valor: p.disponible },
  ], async (v) => {
    const precio = Number(String(v.precio).replace(',', '.'));
    if(!v.nombre.trim()) throw new Error('Escribe el nombre.');
    if(v.precio === '' || !(precio >= 0 && precio < 1000)) throw new Error('El precio no es válido.');
    const datos = { nombre: v.nombre, nombre_corto: v.nombre_corto, descripcion: v.descripcion, precio, tamano: v.tamano,
      solo_tamano: false, categoria: v.categoria, seccion: v.seccion, visible: v.visible, disponible: v.disponible };
    if(!nuevo){ datos.id = p.id; delete datos.solo_tamano; delete estado.cambios[p.id]; }
    await datosPanel.guardarProducto(datos);
    toast('Producto guardado');
    cargarProductos();
  });
}

/* =====================================================================
   RESUMEN DEL DÍA (con los pedidos de hoy que ya tiene el panel)
   ===================================================================== */
function pintarResumen(){
  const hoy = estado.pedidos.filter(deHoy);
  const porArticulo = {};
  let unidades = 0, total = 0;
  hoy.forEach(p => {
    total += Number(p.total || 0);
    (p.lineas || []).forEach(l => {
      unidades += l.cantidad;
      const a = porArticulo[l.nombre] = porArticulo[l.nombre] || { cant: 0, importe: 0 };
      a.cant += l.cantidad; a.importe += l.cantidad * Number(l.precio);
    });
  });
  $('rPedidos').textContent = hoy.length;
  $('rUnidades').textContent = unidades;
  $('rTotal').textContent = euros(total);
  const filas = Object.entries(porArticulo).sort((a, b) => b[1].cant - a[1].cant || b[1].importe - a[1].importe);
  $('rArticulos').innerHTML = filas.length
    ? filas.map(([n, a]) => `<div class="fila-dato"><span>${esc(n)}</span><span><b>${a.cant}×</b> · ${euros(a.importe)}</span></div>`).join('')
    : '<div class="vacio">Todavía no hay ventas hoy.</div>';
}

/* =====================================================================
   MESAS (admin)
   ===================================================================== */
async function cargarMesas(){
  $('listaMesas').innerHTML = '<div class="vacio">Cargando…</div>';
  try { estado.mesas = await datosPanel.mesas() || []; pintarMesas(); }
  catch(e) { $('listaMesas').innerHTML = ''; tratarError(e); }
}
function enlaceMesa(m){
  return new URL('../carta/?mesa=' + m.id + '&c=' + encodeURIComponent(m.codigo), location.href).href;
}
function pintarMesas(){
  $('listaMesas').innerHTML = estado.mesas.map(m => `
    <div class="ficha">
      <div class="ficha-titulo">${esc(m.nombre)} ${m.activa ? '' : '<span class="chip">Desactivada: no admite pedidos</span>'}</div>
      <div class="ficha-detalle">Enlace de la carta: <b>${esc(enlaceMesa(m))}</b></div>
      <div class="ficha-botones">
        <button class="btn btn-borde" data-copiar="${m.id}" type="button">Copiar enlace</button>
        <button class="btn btn-borde" data-mesa="${m.id}" type="button">Editar</button>
      </div>
    </div>`).join('') || '<div class="vacio">Aún no has creado ninguna mesa.</div>';
}
$('listaMesas').addEventListener('click', async (ev) => {
  const c = ev.target.closest('[data-copiar]');
  if(c){
    const url = enlaceMesa(estado.mesas.find(m => m.id === Number(c.dataset.copiar)));
    try { await navigator.clipboard.writeText(url); toast('Enlace copiado'); }
    catch(e) { window.prompt('Copia este enlace:', url); }
    return;
  }
  const b = ev.target.closest('[data-mesa]');
  if(b) editarMesa(estado.mesas.find(m => m.id === Number(b.dataset.mesa)));
});

$('nuevaMesa').addEventListener('click', async () => {
  const id = estado.mesas.reduce((mx, x) => Math.max(mx, x.id), 0) + 1;
  const nombre = $('nombreMesaNueva').value.trim() || ('Mesa ' + id);
  const b = $('nuevaMesa'); b.disabled = true;
  try {
    await datosPanel.guardarMesa({ id, nombre, activa: true });
    $('nombreMesaNueva').value = '';
    toast('Mesa añadida: ' + nombre);
    cargarMesas();
  } catch(e) { tratarError(e); }
  b.disabled = false;
});

function editarMesa(m){
  abrirModal('Editar ' + m.nombre, [
    { id: 'nombre', etiqueta: 'Nombre (ej.: Mesa 5, Terraza 2)', valor: m.nombre },
    { id: 'activa', etiqueta: 'Admite pedidos', tipo: 'check', valor: m.activa },
    { id: 'nuevo_codigo', etiqueta: 'Cambiar el código secreto (habrá que reimprimir su QR)', tipo: 'check', valor: false },
  ], async (v) => {
    await datosPanel.guardarMesa({ id: m.id, nombre: v.nombre, activa: v.activa, nuevo_codigo: !!v.nuevo_codigo });
    toast(v.nuevo_codigo ? 'Código cambiado: reimprime el QR de esta mesa' : 'Mesa guardada');
    cargarMesas();
  });
}

/* =====================================================================
   USUARIOS (admin)
   ===================================================================== */
async function cargarUsuarios(){
  $('listaUsuarios').innerHTML = '<div class="vacio">Cargando…</div>';
  try { estado.usuarios = await datosPanel.usuarios() || []; pintarUsuarios(); }
  catch(e) { $('listaUsuarios').innerHTML = ''; tratarError(e); }
}
function pintarUsuarios(){
  $('listaUsuarios').innerHTML = estado.usuarios.map(u => `
    <div class="ficha">
      <div class="ficha-titulo">${esc(u.nombre)}</div>
      <div class="ficha-detalle">
        <span class="chip ${u.rol === 'admin' ? 'admin' : ''}">${esc(ROLES[u.rol] || u.rol)}</span>${u.activo ? '' : '<span class="chip">Desactivado</span>'}${u.bloqueado ? '<span class="chip">Bloqueado 15 min</span>' : ''}${u.cambiar_password ? '<span class="chip">Contraseña provisional</span>' : ''}
        <br>${esc(u.email)}
      </div>
      <div class="ficha-botones"><button class="btn btn-borde" data-usuario="${u.id}" type="button">Editar</button></div>
    </div>`).join('') || '<div class="vacio">No hay usuarios.</div>';
}
$('listaUsuarios').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-usuario]');
  if(b) editarUsuario(estado.usuarios.find(u => u.id === Number(b.dataset.usuario)));
});
$('nuevoUsuario').addEventListener('click', () => editarUsuario(null));

function passwordProvisional(){
  const w = ['Gamba', 'Marea', 'Puerto', 'Ancla', 'Coral', 'Ostra', 'Velero', 'Faro'];
  const r = crypto.getRandomValues(new Uint32Array(3));
  return w[r[0] % w.length] + '-' + (1000 + r[1] % 9000) + '-' + (r[2] % 0x10000).toString(16).padStart(4, '0');
}

function editarUsuario(u){
  const nuevo = !u;
  u = u || { nombre: '', email: '', rol: 'camarero', activo: true };
  const campos = [
    { id: 'nombre', etiqueta: 'Nombre', valor: u.nombre },
    { id: 'email', etiqueta: 'Correo (para entrar)', valor: u.email, tipo: 'email' },
    { id: 'rol', etiqueta: 'Rol', tipo: 'select', valor: u.rol, opciones: Object.entries(ROLES) },
  ];
  if(!nuevo) campos.push({ id: 'activo', etiqueta: 'Activo (puede entrar)', tipo: 'check', valor: u.activo });
  campos.push({ id: 'password', etiqueta: nuevo ? 'Contraseña provisional (dásela a la persona)' : 'Poner contraseña provisional nueva (déjalo vacío para no cambiarla)',
    valor: nuevo ? passwordProvisional() : '', ayuda: 'Al entrar le pedirá cambiarla. Mínimo 8 caracteres.' });
  abrirModal(nuevo ? 'Nuevo usuario' : 'Editar usuario', campos, async (v) => {
    const datos = { nombre: v.nombre, email: v.email, rol: v.rol };
    if(!nuevo){ datos.id = u.id; datos.activo = v.activo; }
    if(v.password) datos.password = v.password;
    await datosPanel.guardarUsuario(datos);
    toast(v.password ? 'Guardado. Contraseña provisional: ' + v.password : 'Usuario guardado');
    cargarUsuarios();
  });
}

/* =====================================================================
   VENTANA DE EDICIÓN
   ===================================================================== */
let alGuardar = null;
function abrirModal(titulo, campos, guardar){
  $('modalTitulo').textContent = titulo;
  $('modalError').hidden = true;
  $('modalCampos').innerHTML = campos.map(c => {
    const id = 'm_' + c.id;
    if(c.tipo === 'check') return `<label class="campo campo-check"><input type="checkbox" id="${id}" ${c.valor ? 'checked' : ''}><span>${esc(c.etiqueta)}</span></label>`;
    if(c.tipo === 'select') return `<label class="campo"><span>${esc(c.etiqueta)}</span><select id="${id}">${c.opciones.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(c.valor) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
    const extra = c.tipo === 'decimal' ? 'inputmode="decimal"' : c.tipo === 'email' ? 'type="email" inputmode="email" autocapitalize="off"' : '';
    return `<label class="campo"><span>${esc(c.etiqueta)}</span><input id="${id}" ${extra} value="${esc(c.valor)}" autocomplete="off">${c.ayuda ? `<small>${esc(c.ayuda)}</small>` : ''}</label>`;
  }).join('');
  alGuardar = async () => {
    const v = {};
    campos.forEach(c => { const el = $('m_' + c.id); v[c.id] = c.tipo === 'check' ? el.checked : el.value.trim(); });
    await guardar(v);
  };
  $('modal').hidden = false;
}
function cerrarModal(){ $('modal').hidden = true; alGuardar = null; }
$('modalCancelar').addEventListener('click', cerrarModal);
$('modal').addEventListener('click', (ev) => { if(ev.target === $('modal')) cerrarModal(); });
$('modalForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if(!alGuardar) return;
  const boton = ev.submitter || $('modalForm').querySelector('[type=submit]');
  boton.disabled = true;
  try { await alGuardar(); cerrarModal(); }
  catch(e) {
    if(e.codigo === 'SESION_CADUCADA'){ cerrarModal(); return volverAlLogin(e.message); }
    $('modalError').textContent = e.message; $('modalError').hidden = false;
  } finally { boton.disabled = false; }
});

arrancar();
