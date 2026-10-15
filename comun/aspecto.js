/* =====================================================================
   ASPECTO DE CADA BAR · MultiBar (Fase C)
   ---------------------------------------------------------------------
   Colores, fuentes, logo, icono, textos y plantilla de la carta salen de
   los ajustes del bar en la base (bares.ajustes.aspecto), no del código.
   Lo usan la carta, el panel y la página legal. Se carga en el <head>,
   antes de pintar nada, para que el bar salga con sus colores desde el
   primer momento (se recuerda en el móvil la última vez que se vio).

   ajustes.aspecto = {
     plantilla: "clasica",                  // diseño de la carta (hoy solo "clasica")
     colores: {
       principal: "#14295E",                // cabecera, barra de abajo, títulos
       principal_oscuro: "#0E1F4D",         // pestañas (si falta, se calcula)
       acento: "#F08A3E",                   // botones + y "VER TIQUE", rayas
       acento_oscuro: "#D9722A",            // botón pulsado (si falta, se calcula)
       fondo: "#FFFFFF", fondo_2: "#F3F6FB",// fondo de la carta y recuadros
       texto: "#0F1E45"                     // texto de los productos
     },
     fuentes: { titulos: "oswald", texto: "dmsans" },   // ver FUENTES
     logo: "https://…/logo.png",            // opcional (Supabase Storage)
     cabecera: "nombre" | "logo" | "logo_y_nombre",
     icono: "https://…/icono-512.png",      // icono al instalar la carta (si falta, uno con la inicial)
     nombre_corto: "La Mar de Gambas",      // nombre bajo el icono instalado
     textos: { ver_tique: "VER TIQUE", … }  // ver TEXTOS
   }
   Todo es opcional: lo que falte usa el valor por defecto de MultiBar.
   Los colores solo se aceptan como #RRGGBB y las imágenes solo con
   https:// o una ruta de esta web (nada de javascript: ni otros sitios raros).
   ===================================================================== */

(function(){
  // Raíz de la web (este archivo está en /comun/).
  const RAIZ = (function(){
    try { return new URL('../', document.currentScript.src).href; } catch(e) { return '../'; }
  })();

  /* Fuentes que se pueden elegir (todas guardadas en comun/fuentes/). */
  const FUENTES = {
    oswald:     "'Oswald','DM Sans',-apple-system,'Segoe UI',Roboto,sans-serif",
    dmsans:     "'DM Sans',-apple-system,'Segoe UI',Roboto,sans-serif",
    playfair:   "'MB Playfair',Georgia,'Times New Roman',serif",
    lora:       "'MB Lora',Georgia,'Times New Roman',serif",
    montserrat: "'MB Montserrat',-apple-system,'Segoe UI',Roboto,sans-serif",
    bebas:      "'MB Bebas','Oswald',-apple-system,'Segoe UI',Roboto,sans-serif",
    robotoslab: "'MB Roboto Slab',Georgia,serif",
    nunito:     "'MB Nunito',-apple-system,'Segoe UI',Roboto,sans-serif",
    sistema:    "-apple-system,'Segoe UI',Roboto,sans-serif",
  };
  // Fuentes que solo tienen un grosor: no se les inventa la negrita (queda fea).
  const SIN_NEGRITA = { bebas: true };

  /* Textos de la carta que cada bar puede cambiar. */
  const TEXTOS = {
    ver_tique: 'VER TIQUE',
    tu_tique: 'TU TIQUE',
    total: 'TOTAL CUENTA',
    enviar: 'Enviar pedido a barra',
    pie_mirar: 'Enséñale este tique al camarero para pedir.',
    pie_pedir: 'El pedido llega directo a la barra.',
    tique_vacio: 'Marca algo del menú para empezar.',
  };

  /* Plantillas de la carta. La primera es el diseño de La Mar de Gambas. */
  const PLANTILLAS = { clasica: true };

  /* Valores de MultiBar para los bares que aún no tienen los suyos (neutros). */
  const POR_DEFECTO = {
    principal: '#22262E', principal_oscuro: '#181B21', acento: '#D9822B',
    fondo: '#FFFFFF', fondo_2: '#F4F5F7', texto: '#1C2028',
    titulos: 'oswald', texto_fuente: 'dmsans',
  };

  /* ---------- utilidades de color ---------- */
  const esColor = (c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
  const rgb = (c) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const hex = (a) => '#' + a.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const oscurecer = (c, f) => hex(rgb(c).map(x => x * (1 - f)));
  const mezclar = (a, b, f) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * f)); };
  // ¿Va mejor texto blanco u oscuro encima de este color?
  const luz = (c) => { const [r, g, b] = rgb(c).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const claro = (c) => luz(c) > 0.45;
  const contraste = (a, b) => { const x = luz(a), y = luz(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // El primer color de la lista que se lea bien sobre "fondo" (si ninguno, el último).
  const legible = (fondo, minimo, ...colores) => colores.find(c => contraste(c, fondo) >= minimo) || colores[colores.length - 1];

  /* Imagen permitida: https://…, data:image/… o una ruta de esta web. */
  function urlImagen(u){
    if(typeof u !== 'string' || !u.trim()) return '';
    u = u.trim();
    if(/^https:\/\/[^\s"'<>()]+$/i.test(u)) return u;
    if(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(u)) return u;
    if(/^[a-z0-9][a-z0-9_\/.-]*\.(png|jpe?g|webp|gif|svg)$/i.test(u) && u.indexOf('..') < 0) return RAIZ + u;
    return '';
  }

  /* Junta lo que dice el bar con los valores por defecto. */
  function leer(info){
    const a = (info && info.ajustes && info.ajustes.aspecto) || {};
    const c = a.colores || {};
    const f = a.fuentes || {};
    const col = (k) => esColor(c[k]) ? c[k].toUpperCase() : null;
    const principal = col('principal') || POR_DEFECTO.principal;
    const acento = col('acento') || POR_DEFECTO.acento;
    const fondo = col('fondo') || POR_DEFECTO.fondo;
    const texto = col('texto') || POR_DEFECTO.texto;
    const logo = urlImagen(a.logo);
    let cabecera = ['nombre', 'logo', 'logo_y_nombre'].indexOf(a.cabecera) >= 0 ? a.cabecera : (logo ? 'logo_y_nombre' : 'nombre');
    if(!logo) cabecera = 'nombre';
    const textos = {};
    Object.keys(TEXTOS).forEach(k => {
      const t = a.textos && a.textos[k];
      textos[k] = (typeof t === 'string' && t.trim()) ? t.trim().slice(0, 120) : TEXTOS[k];
    });
    return {
      plantilla: PLANTILLAS[a.plantilla] ? a.plantilla : 'clasica',
      principal, acento, fondo, texto,
      principal_oscuro: col('principal_oscuro') || oscurecer(principal, 0.25),
      acento_oscuro: col('acento_oscuro') || oscurecer(acento, 0.1),
      fondo_2: col('fondo_2') || mezclar(fondo, principal, 0.05),
      titulos: FUENTES[f.titulos] ? f.titulos : POR_DEFECTO.titulos,
      texto_fuente: FUENTES[f.texto] ? f.texto : POR_DEFECTO.texto_fuente,
      logo, cabecera,
      icono: urlImagen(a.icono),
      nombre: (info && info.nombre) ? String(info.nombre) : '',
      nombre_corto: (typeof a.nombre_corto === 'string' && a.nombre_corto.trim()) ? a.nombre_corto.trim().slice(0, 30) : ((info && info.nombre) ? String(info.nombre) : ''),
      textos,
    };
  }

  /* Pone los colores y fuentes del bar en toda la página (variables CSS). */
  function aplicarVariables(v, panel){
    const s = document.documentElement.style;
    // En el panel (fondo blanco) el color principal se usa para títulos y
    // números: si el del bar es muy claro, se usa el color del texto.
    const principal = (panel && claro(v.principal)) ? v.texto : v.principal;
    const sobrePrincipal = claro(principal) ? v.texto : '#FFFFFF';
    const vars = {
      '--navy': principal, '--navy-2': v.principal_oscuro,
      '--orange': v.acento, '--orange-d': v.acento_oscuro, '--gold': v.acento, '--stamp': v.acento,
      '--paper': v.fondo, '--paper-2': v.fondo_2,
      '--ink': v.texto, '--ink-rgb': rgb(v.texto).join(','),
      '--ink-soft': 'rgba(' + rgb(v.texto).join(',') + ',.64)',
      '--line': 'rgba(' + rgb(v.texto).join(',') + ',.11)',
      '--acento-rgb': rgb(v.acento).join(','),
      '--sobre-principal': sobrePrincipal,
      '--sobre-principal-rgb': rgb(sobrePrincipal).join(','),
      '--sobre-principal-crema': claro(principal) ? v.texto : '#FAF7F2',
      '--sobre-acento': claro(v.acento) ? v.texto : '#FFFFFF',
      // Principal y acento usados como color de letra: si no se leen sobre
      // el fondo (colores muy claros), se usa otro que sí se lea.
      '--navy-texto': legible(v.fondo, 3, principal, v.principal_oscuro, v.texto),
      '--acento-texto': legible(v.fondo, 2, v.acento, v.acento_oscuro, v.texto),
      '--acento-sobre-principal': legible(principal, 2, v.acento, sobrePrincipal),
      '--font-titulos': FUENTES[v.titulos],
      '--font-texto': FUENTES[v.texto_fuente],
    };
    Object.keys(vars).forEach(k => s.setProperty(k, vars[k]));
    s.fontSynthesis = SIN_NEGRITA[v.titulos] ? 'style' : '';
    document.documentElement.setAttribute('data-plantilla', v.plantilla);
    const tc = document.querySelector('meta[name="theme-color"][data-bar]');
    if(tc) tc.setAttribute('content', v.principal);
  }

  /* Icono para instalar la carta: el del bar o, si no tiene, uno con la
     inicial del bar en sus colores (dibujado en el propio móvil). */
  function iconoGenerado(v, tam){
    try {
      const c = document.createElement('canvas'); c.width = c.height = tam;
      const x = c.getContext('2d');
      x.fillStyle = v.principal; x.fillRect(0, 0, tam, tam);
      x.fillStyle = v.acento; x.fillRect(0, tam * 0.78, tam, tam * 0.06);
      x.fillStyle = claro(v.principal) ? v.texto : '#FFFFFF';
      x.font = '700 ' + Math.round(tam * 0.5) + 'px ' + FUENTES[v.titulos];
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText((v.nombre.trim().charAt(0) || 'M').toUpperCase(), tam / 2, tam * 0.44);
      return c.toDataURL('image/png');
    } catch(e) { return ''; }
  }
  function ponerLink(rel, href){
    if(!href) return;
    let l = document.querySelector('link[rel="' + rel + '"][data-bar]');
    if(!l){ l = document.createElement('link'); l.rel = rel; l.setAttribute('data-bar', '1'); document.head.appendChild(l); }
    if(l.getAttribute('href') !== href) l.href = href;
  }
  let ultimoManifiesto = '';
  function ponerIconosYManifiesto(v){
    const icono = v.icono || iconoGenerado(v, 512);
    if(!icono) return;
    ponerLink('icon', icono);
    ponerLink('apple-touch-icon', icono);
    const t = document.querySelector('meta[name="apple-mobile-web-app-title"][data-bar]');
    if(t) t.setAttribute('content', v.nombre_corto);
    const u = location.href.split('#')[0];
    const m = {
      name: v.nombre + ' · Carta', short_name: v.nombre_corto,
      start_url: u, scope: u.replace(/[^\/]*$/, ''), display: 'standalone', orientation: 'portrait',
      background_color: v.fondo, theme_color: v.principal, lang: 'es',
      icons: [{ src: icono, sizes: '512x512', type: 'image/png', purpose: 'any' }],
    };
    const j = JSON.stringify(m);
    if(j === ultimoManifiesto) return;
    ultimoManifiesto = j;
    try { ponerLink('manifest', URL.createObjectURL(new Blob([j], { type: 'application/manifest+json' }))); } catch(e) {}
  }

  /* Logo en la cabecera (elemento con data-logo-bar) y nombre
     (data-nombre-bar), según "cabecera": nombre, logo o los dos. */
  function pintarLogo(v){
    document.querySelectorAll('[data-logo-bar]').forEach(img => {
      if(v.logo && v.cabecera !== 'nombre'){
        if(img.getAttribute('src') !== v.logo) img.src = v.logo;
        img.alt = v.nombre; img.hidden = false;
      } else { img.hidden = true; img.removeAttribute('src'); }
    });
    document.querySelectorAll('[data-nombre-bar]').forEach(el => { el.hidden = (v.logo && v.cabecera === 'logo'); });
  }

  let ACTUAL = leer(null);
  const listos = [];

  /* Lo que llaman la carta, el panel y la página legal. */
  window.Aspecto = {
    // info = lo que da la base (carta_bar o el bar de la sesión): {slug, nombre, ajustes}
    aplicar(info, opciones){
      ACTUAL = leer(info);
      aplicarVariables(ACTUAL, !!(opciones && opciones.panel));
      const pintar = () => {
        pintarLogo(ACTUAL);
        if(opciones && opciones.instalable) ponerIconosYManifiesto(ACTUAL);
        document.documentElement.classList.remove('mb-cargando');
        listos.splice(0).forEach(f => { try { f(ACTUAL); } catch(e) {} });
      };
      if(document.body) pintar(); else document.addEventListener('DOMContentLoaded', pintar, { once: true });
      return ACTUAL;
    },
    // Texto de la carta según el bar (o el de MultiBar si el bar no lo cambia).
    texto(clave){ return (ACTUAL.textos && ACTUAL.textos[clave]) || TEXTOS[clave] || ''; },
    actual(){ return ACTUAL; },
    // Para la carta: mientras no se sepa el aspecto del bar no se enseña nada
    // (evita ver un momento los colores de otro). Como mucho 7 s.
    esperar(){
      document.documentElement.classList.add('mb-cargando');
      setTimeout(() => document.documentElement.classList.remove('mb-cargando'), 7000);
    },
    alAplicar(f){ listos.push(f); },
    FUENTES: Object.keys(FUENTES), TEXTOS, PLANTILLAS: Object.keys(PLANTILLAS),
  };
})();
