/* =====================================================================
   PANEL DE BARRA · La Mar de Gambas
   Todo el acceso a la base pasa por comun/datos.js (login, datosPanel,
   datosCarta). Aquí solo se pinta la pantalla y se reacciona a los toques.
   ===================================================================== */

const CADA_MS = 4000;            // consulta de pedidos en vivo
const ROLES = { camarero: 'Camarero', barra: 'Barra', admin: 'Administrador' };
const TAMANOS = ['Tapa', 'Plato', 'Copa', 'Botella'];

const estado = {
  sesion: null,
  seccion: 'pedidos',
  filtro: 'todos',
  pedidos: [],
  recibidosEn: 0,          // hora del móvil en que llegaron los datos
  vistos: null,            // ids de pedidos nuevos ya avisados
  modificados: {},         // id -> fecha de la última edición del cliente
  desplegados: new Set(),  // servidos abiertos
  ocupado: new Set(),      // pedidos con un botón en marcha
  productos: [],
  categorias: [],
  usuarios: [],
  mesas: [],
  temporizador: null,
  avisosActivos: false,
};

const $ = (id) => document.getElementById(id);

/* Escapar texto antes de meterlo en la página (las notas las escribe
   el cliente: nunca se pintan como HTML). */
function esc(t){
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function euros(n){ return Number(n || 0).toFixed(2).replace('.', ',') + ' €'; }
function hora(f){ return new Date(f).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }
function minutosDesde(f){ return Math.max(0, Math.floor((Date.now() - new Date(f).getTime()) / 60000)); }
function textoEspera(min){
  if(min < 1) return 'Ahora mismo';
  if(min < 60) return 'Esperando ' + min + ' min';
  return 'Esperando ' + Math.floor(min / 60) + ' h ' + String(min % 60).padStart(2, '0');
}

let toastT = null;
function toast(texto, error){
  const t = $('toast');
  t.textContent = texto; t.className = 'toast' + (error ? ' error' : ''); t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, error ? 4500 : 2200);
}

/* ---------------- PANTALLAS ---------------- */
function mostrar(vista){
  ['vLogin', 'vPass', 'vPanel'].forEach(v => { $(v).hidden = (v !== vista); });
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
  $('cUsuario').textContent = s.nombre + ' · ' + (ROLES[s.rol] || s.rol);
  pintarSecciones();
  mostrar('vPanel');
  irA('pedidos');
  cargarPedidos();
  clearInterval(estado.temporizador);
  estado.temporizador = setInterval(cargarPedidos, CADA_MS);
}

function volverAlLogin(mensaje){
  clearInterval(estado.temporizador);
  estado.sesion = null; estado.pedidos = []; estado.vistos = null;
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
  $('lBoton').disabled = true; $('lBoton').textContent = 'ENTRANDO…';
  try {
    const s = await login(email, pass);
    $('lPass').value = '';
    if(s.cambiarPassword) $('pActual').value = pass;
    entrarConSesion(s);
  } catch(e) {
    $('lError').textContent = e.message; $('lError').hidden = false;
  } finally {
    $('lBoton').disabled = false; $('lBoton').textContent = 'ENTRAR';
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

/* ---------------- SECCIONES SEGÚN EL ROL ---------------- */
function seccionesDelRol(rol){
  const s = [{ id: 'pedidos', nombre: 'Pedidos' }];
  if(rol === 'barra') s.push({ id: 'carta', nombre: 'Agotados' });
  if(rol === 'admin') s.push({ id: 'carta', nombre: 'Carta' }, { id: 'usuarios', nombre: 'Usuarios' }, { id: 'mesas', nombre: 'Mesas' });
  return s;
}
function pintarSecciones(){
  const nav = $('cSecciones');
  const lista = seccionesDelRol(estado.sesion.rol);
  nav.hidden = lista.length < 2;
  nav.innerHTML = lista.map(s => `<button type="button" role="tab" data-s="${s.id}">${esc(s.nombre)}</button>`).join('');
  nav.querySelectorAll('button').forEach(b => b.addEventListener('click', () => irA(b.dataset.s)));
}
function irA(sec){
  estado.seccion = sec;
  $('cSecciones').querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.s === sec)));
  $('sPedidos').hidden = sec !== 'pedidos';
  $('sCarta').hidden = sec !== 'carta';
  $('sUsuarios').hidden = sec !== 'usuarios';
  $('sMesas').hidden = sec !== 'mesas';
  if(sec === 'carta') cargarProductos();
  if(sec === 'usuarios') cargarUsuarios();
  if(sec === 'mesas') cargarMesas();
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
    estado.recibidosEn = Date.now();
    $('avisoConexion').hidden = true;
    detectarNovedades();
    pintarPedidos();
  } catch(e) {
    if(e.codigo === 'SESION_CADUCADA') return volverAlLogin(e.message);
    $('avisoConexion').hidden = false;
  } finally {
    cargando = false;
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
  nuevos.forEach(p => {
    if(!estado.vistos.has(p.id)){ estado.vistos.add(p.id); hayNuevo = true; }
  });
  estado.pedidos.forEach(p => {
    if(p.modificado && estado.modificados[p.id] !== p.modificado && p.estado !== 'servido') hayEditado = true;
    estado.modificados[p.id] = p.modificado;
  });
  if(hayNuevo) avisar('nuevo');
  else if(hayEditado) avisar('editado');
}

function pintarPedidos(){
  const ps = estado.pedidos;
  const nuevos = ps.filter(p => p.estado === 'enviado').sort((a, b) => new Date(a.creado) - new Date(b.creado));
  const recibidos = ps.filter(p => p.estado === 'recibido').sort((a, b) => new Date(a.creado) - new Date(b.creado));
  const servidos = ps.filter(p => p.estado === 'servido').sort((a, b) => new Date(b.servido || b.creado) - new Date(a.servido || a.creado));
  const pendientes = nuevos.length + recibidos.length;

  $('cPendNum').textContent = pendientes;
  $('cPendientes').classList.toggle('hay', nuevos.length > 0);
  document.title = (nuevos.length ? '(' + nuevos.length + ') ' : '') + 'Panel de barra · La Mar de Gambas';

  const filtros = [
    { id: 'nuevos', nombre: 'Nuevos', n: nuevos.length },
    { id: 'recibidos', nombre: 'Recibidos', n: recibidos.length },
    { id: 'servidos', nombre: 'Servidos', n: servidos.length },
    { id: 'todos', nombre: 'Todos', n: ps.length },
  ];
  $('filtros').innerHTML = filtros.map(f =>
    `<button type="button" role="tab" class="f-${f.id}" data-f="${f.id}" aria-selected="${estado.filtro === f.id}">
       <span class="n">${f.n}</span><span>${f.nombre}</span></button>`).join('');
  $('filtros').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { estado.filtro = b.dataset.f; pintarPedidos(); }));

  let html = '';
  const f = estado.filtro;
  if(f === 'nuevos') html = nuevos.map(tarjeta).join('');
  else if(f === 'recibidos') html = recibidos.map(tarjeta).join('');
  else if(f === 'servidos') html = servidos.map(tarjeta).join('');
  else {
    html = nuevos.map(tarjeta).join('') + recibidos.map(tarjeta).join('');
    if(servidos.length) html += `<div class="separador">Servidos (${servidos.length})</div>` + servidos.map(tarjeta).join('');
  }
  if(!html){
    const vacios = { nuevos: 'No hay pedidos nuevos.', recibidos: 'No hay pedidos recibidos pendientes.', servidos: 'Aún no hay pedidos servidos.', todos: 'Todavía no hay pedidos en las últimas 12 horas.' };
    html = `<div class="vacio">${vacios[f]}</div>`;
  }
  $('listaPedidos').innerHTML = html;
}

function tarjeta(p){
  const servido = p.estado === 'servido';
  const plegado = servido && !estado.desplegados.has(p.id);
  const clase = { enviado: 'nuevo', recibido: 'recibido', servido: 'servido' }[p.estado];
  const etq = { enviado: '<span class="etq etq-nuevo">Nuevo</span>', recibido: '<span class="etq etq-recibido">Recibido</span>', servido: '<span class="etq etq-servido">Servido</span>' }[p.estado];
  const min = minutosDesde(p.creado);
  const restante = Math.max(0, (p.editable_seg || 0) - Math.floor((Date.now() - estado.recibidosEn) / 1000));
  const unidades = (p.lineas || []).reduce((s, l) => s + l.cantidad, 0);
  const ocupado = estado.ocupado.has(p.id) ? 'disabled' : '';

  const lineas = (p.lineas || []).map(l => {
    let nombre = l.nombre || '';
    if(l.tamano) nombre = nombre.replace(new RegExp('\\s*\\(' + l.tamano + '\\)$'), '');
    return `<li class="t-linea">
      <div class="t-prod"><span class="t-cant">${l.cantidad}×</span><span class="t-nombre">${esc(nombre)}</span>${l.tamano ? `<span class="t-tam ${esc(l.tamano)}">${esc(l.tamano)}</span>` : ''}</div>
      ${l.nota ? `<div class="t-nota">${esc(l.nota)}</div>` : ''}
    </li>`;
  }).join('');

  let botones = '';
  if(p.estado === 'enviado'){
    botones = `<button class="btn btn-naranja" data-accion="recibido" data-id="${p.id}" ${ocupado}>✓ RECIBIDO</button>
               <button class="btn btn-azul" data-accion="servido" data-id="${p.id}" ${ocupado}>SERVIDO</button>`;
  } else if(p.estado === 'recibido'){
    botones = `<button class="btn btn-azul" data-accion="servido" data-id="${p.id}" ${ocupado}>✓ SERVIDO</button>
               <button class="btn btn-claro" data-accion="enviado" data-id="${p.id}" ${ocupado}>↶ Deshacer</button>`;
  } else {
    botones = `<button class="btn btn-claro solo" data-accion="recibido" data-id="${p.id}" ${ocupado}>↶ Deshacer (volver a Recibido)</button>`;
  }

  const info = servido
    ? `<div class="t-etiquetas">${etq}</div>
       <div class="t-resumen">${unidades} uds · ${euros(p.total)} · servido ${hora(p.servido || p.creado)}${p.servido_por ? ' por ' + esc(p.servido_por) : ''}</div>`
    : `<div class="t-etiquetas">${etq}${p.modificado ? '<span class="etq etq-editado">Editado</span>' : ''}</div>
       <div class="t-espera ${min >= 10 ? 'mucho' : ''}">${textoEspera(min)}</div>
       <div class="t-hora">${hora(p.creado)}${p.ronda > 1 ? ' · pedido ' + p.ronda + ' de esta mesa' : ''}${p.recibido_por ? ' · recibido por ' + esc(p.recibido_por) : ''}</div>
       ${p.estado === 'enviado' && restante > 0 ? `<div class="t-aviso-edicion">El cliente aún puede cambiarlo (${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')})</div>` : ''}`;

  return `<article class="tarjeta ${clase} ${plegado ? 'plegado' : ''}" data-id="${p.id}">
    <div class="t-cab" ${servido ? `data-plegar="${p.id}"` : ''}>
      <div class="t-mesa"><small>MESA</small>${esc(p.mesa)}</div>
      <div class="t-info">${info}</div>
      ${servido ? `<div class="t-flecha">${plegado ? '▾' : '▴'}</div>` : ''}
    </div>
    <ul class="t-lineas">${lineas}</ul>
    <div class="t-pie"><span>${esc(p.mesa_nombre)} · ${unidades} ${unidades === 1 ? 'unidad' : 'unidades'}</span><span class="t-total">${euros(p.total)}</span></div>
    <div class="t-botones">${botones}</div>
  </article>`;
}

// Un único escuchador para todos los botones de las tarjetas.
$('listaPedidos').addEventListener('click', async (ev) => {
  const plegar = ev.target.closest('[data-plegar]');
  if(plegar){
    const id = Number(plegar.dataset.plegar);
    estado.desplegados.has(id) ? estado.desplegados.delete(id) : estado.desplegados.add(id);
    pintarPedidos();
    return;
  }
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
    const deshacer = (antes === 'servido' && accion === 'recibido') || (antes === 'recibido' && accion === 'enviado');
    toast(deshacer ? 'Deshecho' : accion === 'servido' ? 'Mesa ' + (p ? p.mesa : '') + ': SERVIDO' : 'Mesa ' + (p ? p.mesa : '') + ': RECIBIDO');
  } catch(e) {
    tratarError(e);
  } finally {
    estado.ocupado.delete(id);
    pintarPedidos();
  }
});

/* ---------------- AVISOS: SONIDO, VIBRACIÓN, PANTALLA ENCENDIDA ----------------
   Safari (iPhone) no deja sonar nada hasta que la persona toca la pantalla,
   y no permite vibrar desde una web. Por eso hay un botón para activar los
   avisos al empezar el turno y, además, la cabecera parpadea en naranja. */
let audio = null, bloqueoPantalla = null;

$('activarAvisos').addEventListener('click', async () => {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if(AC){ audio = audio || new AC(); await audio.resume(); }
  } catch(e) { /* sin sonido */ }
  estado.avisosActivos = true;
  $('activarAvisos').hidden = true;
  pitar('nuevo');
  if(navigator.vibrate) navigator.vibrate(200);
  mantenerPantalla();
  toast('Avisos activados');
});

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
  if(tipo === 'nuevo' && estado.seccion !== 'pedidos') toast('¡Pedido nuevo! Mira la pestaña Pedidos');
}

// Que la pantalla no se apague (iPhone con iOS 16.4 o más, y Android).
async function mantenerPantalla(){
  try {
    if('wakeLock' in navigator && !bloqueoPantalla && document.visibilityState === 'visible'){
      bloqueoPantalla = await navigator.wakeLock.request('screen');
      bloqueoPantalla.addEventListener('release', () => { bloqueoPantalla = null; });
    }
  } catch(e) { /* no disponible */ }
}

document.addEventListener('visibilitychange', () => {
  if(document.visibilityState !== 'visible' || !estado.sesion) return;
  if(audio && audio.state !== 'running') audio.resume().catch(() => {});
  if(estado.avisosActivos) mantenerPantalla();
  cargarPedidos();
});

/* =====================================================================
   CARTA: AGOTADOS (barra y admin) Y PRECIOS (admin)
   ===================================================================== */
async function cargarProductos(){
  const esAdmin = estado.sesion.rol === 'admin';
  $('nuevoProd').hidden = !esAdmin;
  $('listaProductos').innerHTML = '<div class="vacio">Cargando…</div>';
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
  let filas = 0;
  let html = `<p class="herr-texto">Toca el botón verde para marcar un producto como <b>AGOTADO</b>; tócalo otra vez cuando vuelva a haber. Lo agotado no se puede pedir desde la carta.</p>`;
  estado.categorias.forEach(c => {
    const prods = estado.productos.filter(p => p.categoria === c.id && (!q || (p.nombre || '').toLowerCase().includes(q)));
    if(!esAdmin) prods.splice(0, prods.length, ...prods.filter(p => p.visible));
    if(!prods.length) return;
    filas += prods.length;
    html += `<h3 class="grupo-tit">${esc(c.nombre)}</h3>`;
    html += prods.map(p => `
      <div class="fila ${esAdmin ? 'producto' : ''} ${p.visible ? '' : 'apagada'}">
        <div class="fila-info">
          <div class="fila-nombre">${esc(p.nombre)}</div>
          <div class="fila-sub">${!p.visible ? '<span class="chip rojo">Oculto en la carta</span>' : ''}${esc(p.descripcion || '')}</div>
        </div>
        ${esAdmin ? '<div class="controles">' : ''}
        ${esAdmin ? `<div class="fila-precio">${euros(p.precio)}</div>` : ''}
        <button class="interruptor ${p.disponible ? '' : 'agotado'}" data-disp="${p.id}" type="button" aria-pressed="${!p.disponible}">${p.disponible ? 'Hay' : 'Agotado'}</button>
        ${esAdmin ? `<button class="btn btn-claro" data-editar="${p.id}" type="button">Editar</button></div>` : ''}
      </div>`).join('');
  });
  $('listaProductos').innerHTML = filas ? html : '<div class="vacio">No hay productos que coincidan.</div>';
}

$('buscaProd').addEventListener('input', pintarProductos);

$('listaProductos').addEventListener('click', async (ev) => {
  const disp = ev.target.closest('[data-disp]');
  if(disp){
    const p = estado.productos.find(x => x.id === Number(disp.dataset.disp));
    if(!p) return;
    disp.disabled = true;
    try {
      await datosPanel.disponible(p.id, !p.disponible);
      p.disponible = !p.disponible;
      toast(p.disponible ? p.nombre + ': vuelve a haber' : p.nombre + ': AGOTADO');
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
    if(!(precio >= 0 && precio < 1000)) throw new Error('El precio no es válido.');
    const datos = { nombre: v.nombre, nombre_corto: v.nombre_corto, descripcion: v.descripcion, precio, tamano: v.tamano,
      solo_tamano: false, categoria: v.categoria, seccion: v.seccion, visible: v.visible, disponible: v.disponible };
    if(!nuevo){ datos.id = p.id; delete datos.solo_tamano; }
    await datosPanel.guardarProducto(datos);
    toast('Producto guardado');
    cargarProductos();
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
    <div class="fila ${u.activo ? '' : 'apagada'}">
      <div class="fila-info">
        <div class="fila-nombre">${esc(u.nombre)}</div>
        <div class="fila-sub"><span class="chip ${u.rol === 'admin' ? 'naranja' : ''}">${esc(ROLES[u.rol] || u.rol)}</span>${!u.activo ? '<span class="chip rojo">Desactivado</span>' : ''}${u.bloqueado ? '<span class="chip rojo">Bloqueado 15 min</span>' : ''}${u.cambiar_password ? '<span class="chip">Contraseña provisional</span>' : ''}<br>${esc(u.email)}</div>
      </div>
      <button class="btn btn-claro" data-usuario="${u.id}" type="button">Editar</button>
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
    <div class="fila ${m.activa ? '' : 'apagada'}">
      <div class="fila-info">
        <div class="fila-nombre">${esc(m.nombre)} ${!m.activa ? '<span class="chip rojo">No admite pedidos</span>' : ''}</div>
        <div class="fila-sub enlace">${esc(enlaceMesa(m))}</div>
      </div>
      <button class="btn btn-claro" data-copiar="${m.id}" type="button">Copiar</button>
      <button class="btn btn-claro" data-mesa="${m.id}" type="button">Editar</button>
    </div>`).join('') || '<div class="vacio">No hay mesas.</div>';
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
$('nuevaMesa').addEventListener('click', () => editarMesa(null));

function editarMesa(m){
  const nueva = !m;
  const siguiente = estado.mesas.reduce((mx, x) => Math.max(mx, x.id), 0) + 1;
  m = m || { id: siguiente, nombre: 'Mesa ' + siguiente, activa: true };
  const campos = [];
  if(nueva) campos.push({ id: 'id', etiqueta: 'Número de mesa', valor: String(m.id), tipo: 'numero' });
  campos.push({ id: 'nombre', etiqueta: 'Nombre (ej.: Mesa 5, Terraza 2)', valor: m.nombre },
              { id: 'activa', etiqueta: 'Admite pedidos', tipo: 'check', valor: m.activa });
  if(!nueva) campos.push({ id: 'nuevo_codigo', etiqueta: 'Cambiar el código secreto (habrá que reimprimir su QR)', tipo: 'check', valor: false });
  abrirModal(nueva ? 'Nueva mesa' : 'Editar ' + m.nombre, campos, async (v) => {
    const id = nueva ? parseInt(v.id, 10) : m.id;
    if(!(id >= 1 && id <= 999)) throw new Error('El número de mesa debe estar entre 1 y 999.');
    if(nueva && estado.mesas.some(x => x.id === id)) throw new Error('Ya existe la mesa ' + id + '.');
    await datosPanel.guardarMesa({ id, nombre: v.nombre, activa: v.activa, nuevo_codigo: !!v.nuevo_codigo });
    toast(v.nuevo_codigo ? 'Código cambiado: reimprime el QR de esta mesa' : 'Mesa guardada');
    cargarMesas();
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
    const extra = c.tipo === 'decimal' ? 'inputmode="decimal"' : c.tipo === 'numero' ? 'inputmode="numeric" pattern="[0-9]*"' : c.tipo === 'email' ? 'type="email" inputmode="email" autocapitalize="off"' : '';
    return `<label class="campo"><span>${esc(c.etiqueta)}</span><input id="${id}" ${extra} value="${esc(c.valor)}" autocomplete="off">${c.ayuda ? `<small style="color:var(--gris);font-weight:400">${esc(c.ayuda)}</small>` : ''}</label>`;
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
