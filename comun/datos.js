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

/* ---------------- LOGIN DEL PERSONAL (Fase 3) ---------------- */
// Aquí irán login(), logout() y el token del camarero / barra / admin.
