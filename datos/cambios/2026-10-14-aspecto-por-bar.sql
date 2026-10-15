-- =====================================================================
-- CAMBIO 14 oct 2026 · Fase C: el aspecto de cada bar sale de sus ajustes
-- ---------------------------------------------------------------------
-- 1) Carpeta pública "logos" en Supabase Storage para los logos (y, si se
--    quiere, los iconos) de cada bar. Cualquiera puede VER un archivo si
--    sabe su dirección (la carta lo necesita), pero nadie puede listarla
--    ni subir nada desde la web: se sube desde el panel de Supabase
--    (Storage → logos → Upload). Máx. 1 MB; solo PNG, JPG o WebP.
--    Nombre recomendado: <slug>.png (p. ej. lamardegambas.png).
--    Dirección del archivo:
--    https://dorunbacwnkwdatfscri.supabase.co/storage/v1/object/public/logos/<archivo>
-- 2) ajustes.aspecto de La Mar de Gambas = su aspecto de hoy (azul marino
--    y naranja, Oswald y DM Sans, nombre en letras y su icono de siempre).
--    Formato completo en comun/aspecto.js.
-- No borra nada y no cambia ninguna función (carta_bar y el bar de la
-- sesión ya devuelven los ajustes). Se puede volver a ejecutar.
-- La parte 1 es solo de Supabase (en una base sin Storage, saltarla).
-- =====================================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

update bares
   set ajustes = ajustes || jsonb_build_object('aspecto', '{
     "plantilla": "clasica",
     "colores": {
       "principal": "#14295E", "principal_oscuro": "#0E1F4D",
       "acento": "#F08A3E", "acento_oscuro": "#D9722A",
       "fondo": "#FFFFFF", "fondo_2": "#F3F6FB",
       "texto": "#0F1E45"
     },
     "fuentes": { "titulos": "oswald", "texto": "dmsans" },
     "cabecera": "nombre",
     "icono": "datos/bares/lamardegambas/icono-512.png",
     "nombre_corto": "La Mar de Gambas"
   }'::jsonb)
 where slug = 'lamardegambas';

commit;
