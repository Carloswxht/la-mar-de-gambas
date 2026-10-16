// =====================================================================
// MultiBar · Edge Function «recuperar-contrasena» (v18)
// ---------------------------------------------------------------------
// Corre en el servidor de Supabase (no en la web). La entrada del panel
// le manda { email }; aquí, con la clave secreta que solo existe dentro
// de Supabase, se pide a la base un enlace (public.recuperar_crear) y se
// manda por correo con Resend. Contesta SIEMPRE { ok: true } y tarda lo
// mismo, exista o no el correo: así nadie puede averiguar quién trabaja
// en qué bar. Los límites (3 enlaces por hora, 30 minutos, un solo uso)
// los pone la base.
//
// Secretos (Supabase → Edge Functions → Secrets; nunca en el repositorio):
//   RESEND_API_KEY  clave de Resend (la pone Carlos)
//   REMITENTE       opcional; por defecto "MultiBar <avisos@autonomialab.com>"
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.
// Desplegar con verify_jwt = false (la web no tiene sesión de Supabase).
// =====================================================================

const WEB = 'https://carta.autonomialab.es';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
  'Access-Control-Max-Age': '86400',
};

function respuesta(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function esc(t: string) {
  return String(t ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

type Enlace = { token: string; email: string; nombre: string; bar_nombre: string; bar_slug: string };

async function crearEnlace(email: string): Promise<Enlace | null> {
  const url = Deno.env.get('SUPABASE_URL');
  const clave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !clave) { console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY'); return null; }
  const r = await fetch(url + '/rest/v1/rpc/recuperar_crear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: clave, Authorization: 'Bearer ' + clave },
    body: JSON.stringify({ p_email: email }),
  });
  if (!r.ok) { console.error('recuperar_crear', r.status, await r.text()); return null; }
  return await r.json();
}

async function mandarCorreo(e: Enlace) {
  const clave = Deno.env.get('RESEND_API_KEY');
  if (!clave) { console.error('Falta el secreto RESEND_API_KEY'); return; }
  const remitente = Deno.env.get('REMITENTE') || 'MultiBar <avisos@autonomialab.com>';
  const enlace = `${WEB}/panel/?bar=${encodeURIComponent(e.bar_slug)}#recuperar=${e.token}`;
  const bar = esc(e.bar_nombre), nombre = esc(e.nombre);
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f4f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2430">
<div style="max-width:480px;margin:0 auto;padding:24px 16px">
  <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e3e4e8">
    <p style="margin:0 0 4px;font-size:13px;letter-spacing:.06em;color:#6b7080;text-transform:uppercase">Panel de ${bar}</p>
    <h1 style="margin:0 0 16px;font-size:20px">Contraseña nueva</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5">Hola ${nombre}: alguien (seguramente tú) ha pedido cambiar la contraseña del panel. Toca el botón para elegir una nueva.</p>
    <p style="margin:0 0 20px;text-align:center"><a href="${enlace}" style="display:inline-block;background:#D9722A;color:#fff;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 24px;border-radius:8px">Elegir contraseña nueva</a></p>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6b7080">El enlace vale <b>30 minutos</b> y una sola vez. Si no lo has pedido tú, no hagas nada: tu contraseña sigue siendo la misma.</p>
  </div>
  <p style="margin:16px 0 0;text-align:center;font-size:11px;color:#8a8f9c">Panel por autonomIA Lab · MultiBar</p>
</div></body></html>`;
  const texto = `Panel de ${e.bar_nombre}\n\nHola ${e.nombre}: alguien (seguramente tú) ha pedido cambiar la contraseña del panel.\n` +
    `Abre este enlace para elegir una nueva (vale 30 minutos y una sola vez):\n${enlace}\n\n` +
    `Si no lo has pedido tú, no hagas nada: tu contraseña sigue siendo la misma.\n\nPanel por autonomIA Lab · MultiBar`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + clave },
    body: JSON.stringify({ from: remitente, to: [e.email], subject: `Contraseña nueva · Panel de ${e.bar_nombre}`, html, text: texto }),
  });
  if (!r.ok) console.error('Resend', r.status, await r.text());
}

async function trabajo(email: string) {
  try {
    const e = await crearEnlace(email);
    if (e && e.token) await mandarCorreo(e);
  } catch (err) { console.error('recuperar-contrasena', err); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return respuesta(405, { ok: false });
  let email = '';
  try { email = String((await req.json())?.email ?? '').trim().slice(0, 200); } catch { /* cuerpo malo */ }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    // Se trabaja después de contestar: la respuesta tarda lo mismo con o sin usuario.
    const p = trabajo(email);
    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt && typeof rt.waitUntil === 'function') rt.waitUntil(p); else await p;
  }
  return respuesta(200, { ok: true });
});
