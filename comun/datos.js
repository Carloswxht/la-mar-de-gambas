/* =====================================================================
   ACCESO A DATOS Y LOGIN · La Mar de Gambas
   ---------------------------------------------------------------------
   Este es el ÚNICO sitio donde la carta y el panel hablan con la base
   de datos. Si algún día se pasa de Neon a Supabase, solo se cambia
   este archivo (direcciones y funciones de aquí abajo).

   Base de datos: proyecto Neon "la-mar-de-gambas" (Frankfurt), separado
   de El Recreo. Aquí solo van direcciones PÚBLICAS: sin login, la base
   únicamente deja hacer lo que permiten sus reglas de seguridad
   (datos/seguridad.sql). NUNCA poner aquí claves de administrador.
   ===================================================================== */

/* ---------------- DIRECCIONES DE LA BASE ---------------- */
const AUTH_BASE = 'https://ep-sweet-sky-b18vlkug.neonauth.c-5.eu-central-1.aws.neon.tech/neondb/auth';
const DATA_API = 'https://ep-sweet-sky-b18vlkug.apirest.c-5.eu-central-1.aws.neon.tech/neondb/rest/v1';

let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAuthToken(force){
  const now = Date.now() / 1000;
  if(!force && cachedToken && cachedTokenExpiry - now > 60) return cachedToken;
  const res = await fetch(AUTH_BASE + '/token/anonymous');
  if(!res.ok) throw new Error('No se pudo obtener acceso a la carta (código ' + res.status + ')');
  const data = await res.json();
  cachedToken = data.token;
  let e = data.expires_at;
  if(typeof e === 'string') e = Date.parse(e) / 1000;
  if(typeof e === 'number' && e > 1e11) e = e / 1000;
  cachedTokenExpiry = (typeof e === 'number' && !isNaN(e)) ? e : now + 300;
  return cachedToken;
}

/* Funciones antiguas heredadas de El Recreo (leían las tablas directamente).
   Ya no sirven: las tablas están cerradas a la web. Las usa todavía el
   código dormido de envío de la carta; se quitan en la Fase 5. */
async function apiGet(path){
  let token = await getAuthToken();
  let res = await fetch(DATA_API + path, { headers: { 'Authorization': 'Bearer ' + token }, cache: 'no-store' });
  if(res.status === 401){ token = await getAuthToken(true); res = await fetch(DATA_API + path, { headers: { 'Authorization': 'Bearer ' + token }, cache: 'no-store' }); }
  if(!res.ok) throw new Error('Error al leer la carta (código ' + res.status + ')');
  return res.json();
}

async function apiPost(path, body){
  const token = await getAuthToken();
  const res = await fetch(DATA_API + path, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if(!res.ok) throw new Error('Error al guardar el pedido (código ' + res.status + ')');
  return res.json();
}

async function apiPatch(path, body){
  const token = await getAuthToken();
  const res = await fetch(DATA_API + path, {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if(!res.ok) throw new Error('Error al actualizar (código ' + res.status + ')');
  return res.json();
}

async function apiDelete(path){
  const token = await getAuthToken();
  const res = await fetch(DATA_API + path, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token },
  });
  if(!res.ok) throw new Error('Error al eliminar (código ' + res.status + ')');
}

/* ---------------- LLAMADA A LAS "VENTANILLAS" DE LA BASE ----------------
   La web no toca tablas: solo llama a funciones de la base (ver
   datos/seguridad.sql), que comprueban todo. Se llaman sin login de Neon:
   la base las trata como visitante anónimo. Si un día la base exige
   token anónimo, se pide y se reintenta. */
let usarTokenAnonimo = false;

async function apiRpc(nombre, params){
  const enviar = async () => {
    const headers = { 'Content-Type': 'application/json' };
    if(usarTokenAnonimo) headers['Authorization'] = 'Bearer ' + await getAuthToken();
    return fetch(DATA_API + '/rpc/' + nombre, {
      method: 'POST', headers, cache: 'no-store', body: JSON.stringify(params || {}),
    });
  };
  let res;
  try {
    res = await enviar();
    if(res.status === 401 && !usarTokenAnonimo){ usarTokenAnonimo = true; res = await enviar(); }
  } catch(e) {
    throw new ErrorDatos('SIN_CONEXION');
  }
  const texto = await res.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch(e) { /* respuesta vacía */ }
  if(!res.ok){
    const msg = (datos && datos.message) || ('HTTP_' + res.status);
    throw new ErrorDatos(msg);
  }
  return datos;
}

/* Error con un código de la base (MESA_NO_VALIDA, AGOTADO:Gambas…) y un
   texto en español para enseñar al usuario. */
class ErrorDatos extends Error {
  constructor(codigo){
    super(textoError(codigo));
    this.codigo = String(codigo || '').split(':')[0];
    this.detalle = String(codigo || '').split(':').slice(1).join(':');
  }
}

function textoError(codigo){
  const c = String(codigo || '');
  const [base, detalle] = [c.split(':')[0], c.split(':').slice(1).join(':')];
  const textos = {
    SIN_CONEXION: 'No hay conexión. Comprueba la cobertura e inténtalo otra vez.',
    MESA_NO_VALIDA: 'Este código QR no es válido. Pide ayuda al camarero.',
    ESPERA_UN_MOMENTO: 'Acabas de enviar un pedido. Espera unos segundos.',
    LIMITE_MOVIL: 'Has enviado muchos pedidos en poco tiempo. Avisa al camarero.',
    LIMITE_MESA: 'Esta mesa ha enviado muchos pedidos seguidos. Avisa al camarero.',
    PEDIDO_VACIO: 'El pedido está vacío.',
    DEMASIADAS_LINEAS: 'El pedido es demasiado largo. Divídelo en dos.',
    CANTIDAD_NO_VALIDA: 'Como mucho 20 unidades de cada producto.',
    PRODUCTO_NO_VALIDO: 'Algún producto ya no está en la carta. Recarga la página.',
    AGOTADO: 'Lo sentimos, se ha agotado: ' + (detalle || 'un producto') + '.',
    YA_NO_EDITABLE: 'El pedido ya está en marcha y no se puede cambiar. Avisa al camarero.',
    PEDIDO_NO_ENCONTRADO: 'No se encuentra el pedido.',
    DISPOSITIVO_NO_VALIDO: 'Recarga la página e inténtalo otra vez.',
    CREDENCIALES: 'Correo o contraseña incorrectos.',
    BLOQUEADO: 'Demasiados intentos fallidos. Espera 15 minutos.',
    SESION_CADUCADA: 'Tu sesión ha caducado. Vuelve a entrar.',
    SIN_PERMISO: 'Tu usuario no tiene permiso para esto.',
    PASSWORD_CORTA: 'La contraseña debe tener al menos 8 caracteres.',
    CAMBIO_NO_VALIDO: 'Ese cambio de estado no es posible.',
    LINEA_NO_VALIDA: 'Esa línea ya no está en el pedido. Recarga e inténtalo otra vez.',
    FALTAN_DATOS: 'Faltan datos obligatorios.',
    ROL_NO_VALIDO: 'Rol no válido.',
    USUARIO_NO_VALIDO: 'No se encuentra el usuario.',
    ULTIMO_ADMIN: 'Tiene que quedar al menos un administrador activo.',
  };
  return textos[base] || ('Algo ha fallado (' + c + '). Inténtalo otra vez.');
}

/* ---------------- ALMACÉN LOCAL DEL MÓVIL ----------------
   En Safari en modo privado localStorage puede fallar: siempre con try. */
function leerLocal(clave){
  try { const v = localStorage.getItem(clave); return v ? JSON.parse(v) : null; } catch(e) { return null; }
}
function guardarLocal(clave, valor){
  try {
    if(valor === null || valor === undefined) localStorage.removeItem(clave);
    else localStorage.setItem(clave, JSON.stringify(valor));
  } catch(e) { /* sin almacenamiento: se sigue sin recordar */ }
}

/* Número al azar que identifica este móvil (no es un dato personal):
   sirve para que el cliente vea y edite solo sus propios pedidos. */
function dispositivoId(){
  let id = leerLocal('lmdg.dispositivo');
  if(!id){
    if(window.crypto && crypto.randomUUID) id = crypto.randomUUID();
    else {
      const b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
      const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
      id = h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
    }
    guardarLocal('lmdg.dispositivo', id);
  }
  return id;
}

/* ---------------- CARTA (cliente de la mesa) ---------------- */
const datosCarta = {
  menu: () => apiRpc('carta_menu'),
  mesa: (mesa, codigo) => apiRpc('carta_mesa', { p_mesa: Number(mesa), p_codigo: String(codigo || '') }),
  // lineas: [{ producto: id, cantidad: n, nota: '...' }]
  crearPedido: (mesa, codigo, lineas) => apiRpc('crear_pedido', {
    p_mesa: Number(mesa), p_codigo: String(codigo || ''), p_dispositivo: dispositivoId(), p_lineas: lineas,
  }),
  // lineas vacías = anular el pedido
  editarPedido: (pedidoId, lineas) => apiRpc('editar_pedido', {
    p_pedido: pedidoId, p_dispositivo: dispositivoId(), p_lineas: lineas,
  }),
  misPedidos: () => apiRpc('mis_pedidos', { p_dispositivo: dispositivoId() }),
};

/* ---------------- LOGIN DEL PERSONAL ----------------
   El login es propio de la base (sin cookies), para que funcione igual en
   iPhone (Safari) y Android. Se guarda en el móvil solo el token de la
   sesión (dura 16 h) y el nombre/rol para pintar el panel. */
const CLAVE_SESION = 'lmdg.sesion';

function getSesion(){ return leerLocal(CLAVE_SESION); }
function getAuthTokenPersonal(){ const s = getSesion(); return s ? s.token : null; }

async function login(email, password){
  const r = await apiRpc('personal_entrar', { p_email: email, p_password: password });
  if(!r || r.error) throw new ErrorDatos((r && r.error) || 'CREDENCIALES');
  const sesion = { token: r.token, nombre: r.nombre, rol: r.rol, email: r.email, cambiarPassword: !!r.cambiar_password };
  guardarLocal(CLAVE_SESION, sesion);
  return sesion;
}

async function logout(){
  const token = getAuthTokenPersonal();
  guardarLocal(CLAVE_SESION, null);
  if(token){ try { await apiRpc('personal_salir', { p_token: token }); } catch(e) { /* ya está fuera */ } }
}

// Comprueba con la base que la sesión sigue viva (y refresca nombre/rol).
async function comprobarSesion(){
  const s = getSesion();
  if(!s) return null;
  try {
    const r = await apiRpc('personal_yo', { p_token: s.token });
    const nueva = Object.assign({}, s, { nombre: r.nombre, rol: r.rol, email: r.email, cambiarPassword: !!r.cambiar_password });
    guardarLocal(CLAVE_SESION, nueva);
    return nueva;
  } catch(e) {
    if(e.codigo === 'SESION_CADUCADA') { guardarLocal(CLAVE_SESION, null); return null; }
    throw e;
  }
}

async function cambiarPassword(actual, nueva){
  await apiRpc('personal_cambiar_password', { p_token: getAuthTokenPersonal(), p_actual: actual, p_nueva: nueva });
  const s = getSesion();
  if(s){ s.cambiarPassword = false; guardarLocal(CLAVE_SESION, s); }
}

// Llamada del panel con el token de la sesión. Si caduca, se borra la sesión.
async function rpcPersonal(nombre, params){
  try {
    return await apiRpc(nombre, Object.assign({ p_token: getAuthTokenPersonal() }, params || {}));
  } catch(e) {
    if(e.codigo === 'SESION_CADUCADA') guardarLocal(CLAVE_SESION, null);
    throw e;
  }
}

/* ---------------- PANEL (camarero, barra y admin) ---------------- */
const datosPanel = {
  pedidos: (desde) => rpcPersonal('panel_pedidos', desde ? { p_desde: desde } : {}),
  // estado: 'en_preparacion' (aceptar) | 'servido' | 'enviado' (deshacer a nuevo)
  marcar: (pedidoId, estado) => rpcPersonal('panel_marcar', { p_pedido: pedidoId, p_estado: estado }),
  // cambios: { lineas: [{ id, cantidad }] } (una línea a 0 queda en el pedido,
  // en gris y a cero euros). La base admite también "nuevas", pero el panel
  // añade productos con un pedido nuevo (crearPedido).
  modificar: (pedidoId, cambios) => rpcPersonal('panel_modificar_pedido', { p_pedido: pedidoId, p_cambios: cambios }),
  // Pedido nuevo tomado por el camarero (entra ya "en preparación").
  // lineas: [{ producto, cantidad, nota }]
  crearPedido: (mesa, lineas) => rpcPersonal('panel_crear_pedido', { p_mesa: Number(mesa), p_lineas: lineas }),
  mesasPanel: () => rpcPersonal('panel_mesas'),
  productos: () => rpcPersonal('panel_productos'),
  disponible: (productoId, disponible) => rpcPersonal('panel_disponible', { p_producto: productoId, p_disponible: !!disponible }),
  // Solo admin:
  guardarProducto: (datos) => rpcPersonal('admin_guardar_producto', { p_datos: datos }),
  usuarios: () => rpcPersonal('admin_usuarios'),
  guardarUsuario: (datos) => rpcPersonal('admin_guardar_usuario', { p_datos: datos }),
  mesas: () => rpcPersonal('admin_mesas'),
  guardarMesa: (datos) => rpcPersonal('admin_guardar_mesa', { p_datos: datos }),
};
