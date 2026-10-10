-- =====================================================================
-- CAMBIO DEL 10 OCT 2026 · "Recibido" pasa a llamarse "En preparación"
-- y los pedidos nuevos pasan solos a preparación a los 3 minutos.
-- Ya aplicado en la base de Neon. Se guarda para tener el historial.
-- (esquema.sql y seguridad.sql ya incluyen estos cambios para una base nueva)
-- Tras aplicarlo, esperar 30–60 s antes de probar desde la web.
-- =====================================================================
alter table orders drop constraint orders_status_check;
update orders set status = 'en_preparacion' where status = 'recibido';
alter table orders add constraint orders_status_check check (status in ('enviado','en_preparacion','servido'));
alter table orders add column nuevo_desde timestamptz not null default now();
update orders set nuevo_desde = created_at;
alter table orders add column auto_aceptado boolean not null default false;
-- Funciones nuevas o cambiadas (ver datos/seguridad.sql):
--   privado.auto_aceptar, privado.pedido_json, public.mis_pedidos,
--   public.panel_pedidos, public.panel_marcar
