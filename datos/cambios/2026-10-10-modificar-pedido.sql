-- =====================================================================
-- CAMBIO DEL 10 OCT 2026 · El personal puede modificar pedidos.
-- Ya aplicado en la base de Neon. Se guarda para tener el historial.
-- (esquema.sql y seguridad.sql ya incluyen estos cambios para una base nueva)
-- Tras aplicarlo, esperar 30–60 s antes de probar desde la web.
-- =====================================================================
-- Una línea puede quedar a 0 (quitada por el personal; se ve en gris).
alter table order_items drop constraint order_items_quantity_check;
alter table order_items add constraint order_items_quantity_check check (quantity between 0 and 20);
-- Función nueva public.panel_modificar_pedido(token, pedido, cambios)
-- (ver datos/seguridad.sql) y permiso para la web:
grant execute on function public.panel_modificar_pedido(text, bigint, jsonb) to anonymous, authenticated;
