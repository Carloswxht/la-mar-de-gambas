-- =====================================================================
-- CAMBIO 15 oct 2026 · Número de pedido propio de cada bar (v14)
-- ---------------------------------------------------------------------
-- Antes, «Pedido nº N» del panel era un contador común a todos los bares.
-- Ahora cada bar lleva su cuenta y, por defecto, empieza en 1 cada día
-- (según la hora del bar). Con ajustes.numeracion = 'continua' no se
-- reinicia nunca. Los pedidos que ya había reciben su número del día.
-- No borra nada. Copia exacta de datos/funciones.sql y esquema.sql.
-- =====================================================================

begin;

alter table orders add column if not exists numero integer;

-- Número de pedido de cada bar (el «Pedido nº N» del panel). Cada bar
-- lleva su propia cuenta; por defecto empieza en 1 cada día (según la hora
-- del bar, zona_horaria). Con ajustes.numeracion = 'continua' no se
-- reinicia nunca. Lo pone la base al crear el pedido (trigger), con un
-- cerrojo por bar para que dos pedidos a la vez no saquen el mismo número.
create or replace function privado.numerar_pedido()
returns trigger
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare v_zona text; v_continua boolean; v_dia date;
begin
  perform pg_advisory_xact_lock(hashtext('multibar.numero_pedido'), new.bar_id);
  select coalesce(zona_horaria, 'Europe/Madrid'),
         coalesce(ajustes->>'numeracion', 'diaria') = 'continua'
    into v_zona, v_continua
    from bares where id = new.bar_id;
  if v_continua then
    select coalesce(max(numero), 0) + 1 into new.numero from orders where bar_id = new.bar_id;
  else
    v_dia := (now() at time zone v_zona)::date;
    select coalesce(max(numero), 0) + 1 into new.numero from orders
     where bar_id = new.bar_id
       and created_at >= (v_dia::timestamp at time zone v_zona)
       and created_at <  ((v_dia + 1)::timestamp at time zone v_zona);
  end if;
  return new;
end $$;

drop trigger if exists orders_numero on orders;
create trigger orders_numero before insert on orders
  for each row execute function privado.numerar_pedido();

-- Pedidos que ya existían: su número dentro de su bar y de su día.
update orders o set numero = t.n
  from (select o2.id,
               row_number() over (partition by o2.bar_id, (o2.created_at at time zone b.zona_horaria)::date
                                  order by o2.created_at, o2.id) as n
          from orders o2 join bares b on b.id = o2.bar_id) t
 where o.id = t.id and o.numero is null;

-- El pedido que ven la carta y el panel lleva ahora "numero".
-- (privado.pedido_json, igual que en funciones.sql)
create or replace function privado.pedido_json(p_id bigint)
returns jsonb
language sql stable security definer
set search_path = public, privado, pg_temp
as $$
  select jsonb_build_object(
    'id', o.id,
    'numero', coalesce(o.numero, o.id),
    'mesa', o.mesa_id,
    'mesa_nombre', m.name,
    'ronda', o.round_number,
    'estado', o.status,
    'total', o.total,
    'creado', o.created_at,
    'modificado', o.modified_at,
    'en_preparacion', o.received_at,
    'aceptado_por', o.received_by,
    'auto', o.auto_aceptado,
    'servido', o.served_at,
    'servido_por', o.served_by,
    'editable_seg', case when o.status = 'enviado'
                         then greatest(0, 180 - floor(extract(epoch from now() - o.created_at)))::int
                         else 0 end,
    'lineas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'producto', i.product_id, 'nombre', i.product_name,
               'tamano', i.size, 'precio', i.unit_price, 'cantidad', i.quantity,
               'nota', i.note) order by i.id)
        from order_items i where i.order_id = o.id), '[]'::jsonb)
  )
  from orders o join mesas m on m.bar_id = o.bar_id and m.id = o.mesa_id
  where o.id = p_id
$$;

commit;
