-- =====================================================================
-- CAMBIO 16 oct 2026 · v17: «Pedir la cuenta» solo con pedidos
-- ---------------------------------------------------------------------
-- carta_aviso no admite «Pedir la cuenta» (tipo 'cuenta') si la mesa no
-- tiene pedidos de hoy sin cobrar (error SIN_PEDIDOS). La carta, además,
-- solo enseña esa opción cuando el móvil ya ha hecho algún pedido.
-- No borra nada. Copia exacta de datos/funciones.sql.
-- =====================================================================

begin;

-- «Llamar al camarero» (tipo 'camarero') o «Pedir la cuenta» ('cuenta')
-- desde la carta, con el QR de la mesa. Solo si el bar tiene la opción
-- ajustes.avisos_mesa. Si ya hay un aviso igual sin atender, no se repite.
-- Como mucho un aviso cada 30 s y 20 a la hora por mesa.
create or replace function public.carta_aviso(p_bar text, p_mesa integer, p_codigo text, p_tipo text)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare b bares; v_hasta timestamptz;
begin
  b := privado.bar_de_slug(p_bar);
  if not coalesce((b.ajustes->>'avisos_mesa')::boolean, false) then
    raise exception 'FUNCION_NO_ACTIVA';
  end if;
  if p_tipo not in ('camarero', 'cuenta') then
    raise exception 'FALTAN_DATOS';
  end if;
  select abierta_hasta into v_hasta from mesas
   where bar_id = b.id and id = p_mesa and active and code = p_codigo for update;
  if not found then
    raise exception 'MESA_NO_VALIDA';
  end if;
  if coalesce((b.ajustes->>'control_mesas')::boolean, false)
     and (v_hasta is null or v_hasta <= now()) then
    raise exception 'MESA_CERRADA';
  end if;
  -- «Pedir la cuenta» solo si la mesa tiene pedidos de hoy sin cobrar (v17).
  if p_tipo = 'cuenta' and not exists (select 1 from orders where bar_id = b.id and mesa_id = p_mesa
              and cobrado_at is null and created_at > privado.desde_hoy(b.id)) then
    raise exception 'SIN_PEDIDOS';
  end if;
  if exists (select 1 from avisos where bar_id = b.id and mesa_id = p_mesa
              and tipo = p_tipo and atendido_at is null) then
    return jsonb_build_object('ok', true, 'repetido', true);
  end if;
  if exists (select 1 from avisos where bar_id = b.id and mesa_id = p_mesa
              and created_at > now() - interval '30 seconds')
     or (select count(*) from avisos where bar_id = b.id and mesa_id = p_mesa
          and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'ESPERA_UN_MOMENTO';
  end if;
  insert into avisos (bar_id, mesa_id, tipo) values (b.id, p_mesa, p_tipo);
  return jsonb_build_object('ok', true);
end $$;

commit;
