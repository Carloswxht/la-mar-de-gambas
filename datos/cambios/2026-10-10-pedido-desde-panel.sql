-- =====================================================================
-- CAMBIO DEL 10 OCT 2026 · El personal puede crear pedidos para una mesa.
-- Ya aplicado en la base de Neon. Se guarda para tener el historial.
-- Funciones nuevas (ver datos/seguridad.sql):
--   public.panel_crear_pedido(token, mesa, lineas)  -> entra como NUEVO (cambio del mismo día: al principio entraba "en preparación")
--   public.panel_mesas(token)                         -> mesas sin códigos
-- Tras aplicarlo, esperar 30–60 s antes de probar desde la web.
-- =====================================================================
grant execute on function public.panel_crear_pedido(text, integer, jsonb) to anonymous, authenticated;
grant execute on function public.panel_mesas(text) to anonymous, authenticated;
