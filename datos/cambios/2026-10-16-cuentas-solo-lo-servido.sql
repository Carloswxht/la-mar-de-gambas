-- =====================================================================
-- CAMBIO 16 oct 2026 · v16: cuentas de las mesas corregidas
-- ---------------------------------------------------------------------
-- * Solo se cobra lo SERVIDO; lo que aún no se ha servido sale aparte y
--   se queda en la cuenta de la mesa hasta que se sirva.
-- * «Cobrada» cobra solo los pedidos que el camarero tenía en pantalla
--   (panel_cobrar con la lista de ids): un pedido que llega en ese momento
--   no se cobra sin verlo.
-- * «Cobradas hoy» y «Reabrir» (panel_cobradas, panel_reabrir_cuenta) para
--   deshacer un cobro por error.
-- * Un pedido cobrado no se puede modificar ni volver atrás (YA_COBRADO).
-- * panel_cobrar_mesa (panel v15) sigue existiendo y ahora también cobra
--   solo lo servido.
-- No borra nada. Copia exacta de datos/funciones.sql.
-- =====================================================================

begin;

-- Desde cuándo cuentan las cuentas de hoy (00:00 en la hora del bar, o
-- las últimas 12 horas si eso es más), igual que los pedidos del panel.
create or replace function privado.desde_hoy(p_bar integer)
returns timestamptz
language sql stable security definer
set search_path = public, privado, pg_temp
as $$
  select least(date_trunc('day', now() at time zone zona_horaria) at time zone zona_horaria,
               now() - interval '12 hours')
    from bares where id = p_bar
$$;

-- Líneas de unos pedidos, juntando las del mismo producto y precio.
create or replace function privado.lineas_juntas(p_pedidos bigint[])
returns jsonb
language sql stable security definer
set search_path = public, privado, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object('nombre', x.nombre, 'cantidad', x.cant,
                    'precio', x.precio, 'importe', x.importe) order by x.primera), '[]'::jsonb)
    from (select i.product_name as nombre, i.unit_price as precio, sum(i.quantity) as cant,
                 sum(i.quantity * i.unit_price) as importe, min(i.id) as primera
            from order_items i
           where i.order_id = any(p_pedidos) and i.quantity > 0
           group by i.product_name, i.unit_price) x
$$;

-- Cuentas de las mesas: lo pedido hoy y sin cobrar, mesa por mesa, con
-- todos los pedidos juntos (de todos los móviles, de barra y de cocina).
-- Solo se cobra lo SERVIDO: "total" y "lineas" son lo servido (con "ids",
-- los pedidos que se cobrarán); lo que aún no se ha servido va aparte en
-- "pendiente" y "lineas_pendientes" y no se cobra todavía.
create or replace function public.panel_cuentas(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff; v_desde timestamptz;
begin
  s := privado.exigir_rol(p_token, array['camarero','barra','admin']);
  v_desde := privado.desde_hoy(s.bar_id);
  return (select coalesce(jsonb_agg(c order by c->>'desde'), '[]'::jsonb) from (
    select jsonb_build_object(
      'mesa', t.mesa_id, 'mesa_nombre', t.nombre,
      'total', t.total, 'pendiente', t.pendiente,
      'pedidos', t.pedidos, 'sin_servir', t.sin_servir, 'desde', t.desde,
      'ids', to_jsonb(t.servidos),
      'lineas', privado.lineas_juntas(t.servidos),
      'lineas_pendientes', privado.lineas_juntas(t.no_servidos)) as c
      from (select o.mesa_id, min(m.name) as nombre, min(o.created_at) as desde,
                   coalesce(sum(o.total) filter (where o.status = 'servido'), 0) as total,
                   coalesce(sum(o.total) filter (where o.status <> 'servido'), 0) as pendiente,
                   count(distinct coalesce(o.parte_de, o.id)) as pedidos,
                   count(*) filter (where o.status <> 'servido') as sin_servir,
                   coalesce(array_agg(o.id order by o.id) filter (where o.status = 'servido'), '{}') as servidos,
                   coalesce(array_agg(o.id order by o.id) filter (where o.status <> 'servido'), '{}') as no_servidos
              from orders o join mesas m on m.bar_id = o.bar_id and m.id = o.mesa_id
             where o.bar_id = s.bar_id and o.cobrado_at is null and o.created_at > v_desde
             group by o.mesa_id) t) u);
end $$;

-- Cobrar la cuenta de una mesa: SOLO los pedidos que el camarero tenía en
-- pantalla (p_pedidos), que sigan servidos y sin cobrar. Así no se cobra
-- nada sin servir ni un pedido que acaba de llegar. Atiende los avisos de
-- la mesa. Todos quedan con la misma hora de cobro (para poder reabrir).
-- p_pedidos: lista JSON de ids, p. ej. [71, 72].
create or replace function public.panel_cobrar(p_token text, p_mesa integer, p_pedidos jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff; v_n int; v_total numeric; v_ids bigint[];
begin
  s := privado.exigir_rol(p_token, array['camarero','barra','admin']);
  select coalesce(array_agg(x::bigint), '{}') into v_ids
    from jsonb_array_elements_text(case when jsonb_typeof(p_pedidos) = 'array' then p_pedidos else '[]'::jsonb end) x
   where x ~ '^[0-9]{1,18}$';
  update orders set cobrado_at = now(), cobrado_por = s.name
   where bar_id = s.bar_id and mesa_id = p_mesa and id = any(v_ids)
     and status = 'servido' and cobrado_at is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'NADA_QUE_COBRAR';
  end if;
  select sum(total) into v_total from orders
   where bar_id = s.bar_id and mesa_id = p_mesa and cobrado_at = now();
  update avisos set atendido_at = now(), atendido_por = s.name
   where bar_id = s.bar_id and mesa_id = p_mesa and atendido_at is null;
  return jsonb_build_object('cobrados', v_n, 'total', v_total);
end $$;

-- Versión anterior (panel v15): ahora también cobra solo lo servido.
create or replace function public.panel_cobrar_mesa(p_token text, p_mesa integer)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff;
begin
  s := privado.exigir_rol(p_token, array['camarero','barra','admin']);
  return public.panel_cobrar(p_token, p_mesa, (select coalesce(jsonb_agg(id), '[]'::jsonb) from orders
           where bar_id = s.bar_id and mesa_id = p_mesa and cobrado_at is null
             and status = 'servido' and created_at > privado.desde_hoy(s.bar_id)));
end $$;

-- Cuentas cobradas hoy (las últimas primero), para poder reabrir una por error.
create or replace function public.panel_cobradas(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff;
begin
  s := privado.exigir_rol(p_token, array['camarero','barra','admin']);
  return (select coalesce(jsonb_agg(jsonb_build_object('mesa', t.mesa_id, 'mesa_nombre', t.nombre,
                    'cuando', t.cobrado_at, 'por', t.por, 'total', t.total, 'pedidos', t.pedidos)
                    order by t.cobrado_at desc), '[]'::jsonb)
            from (select o.mesa_id, o.cobrado_at, min(m.name) as nombre, min(o.cobrado_por) as por,
                         sum(o.total) as total, count(distinct coalesce(o.parte_de, o.id)) as pedidos
                    from orders o join mesas m on m.bar_id = o.bar_id and m.id = o.mesa_id
                   where o.bar_id = s.bar_id and o.cobrado_at > privado.desde_hoy(s.bar_id)
                   group by o.mesa_id, o.cobrado_at) t);
end $$;

-- Reabrir una cuenta cobrada por error: sus pedidos vuelven a estar sin cobrar.
create or replace function public.panel_reabrir_cuenta(p_token text, p_mesa integer, p_cuando timestamptz)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff; v_n int;
begin
  s := privado.exigir_rol(p_token, array['camarero','barra','admin']);
  update orders set cobrado_at = null, cobrado_por = null
   where bar_id = s.bar_id and mesa_id = p_mesa and cobrado_at = p_cuando;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'PEDIDO_NO_ENCONTRADO';
  end if;
  return jsonb_build_object('reabiertos', v_n);
end $$;

-- Cambiar el estado: Aceptar (en preparación), Servido o Deshacer (un paso
-- atrás). Si se deshace a NUEVO, vuelve a contar 3 minutos.
create or replace function public.panel_marcar(p_token text, p_pedido bigint, p_estado text)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff; o orders;
begin
  s := privado.exigir_rol(p_token, array['camarero','barra','admin']);
  select * into o from orders where id = p_pedido and bar_id = s.bar_id for update;
  if not found then
    raise exception 'PEDIDO_NO_ENCONTRADO';
  end if;
  if p_estado = o.status then
    return privado.pedido_json(o.id);
  end if;
  -- Un pedido ya cobrado no vuelve atrás (primero hay que reabrir su cuenta).
  if o.cobrado_at is not null then
    raise exception 'YA_COBRADO';
  end if;
  if (o.status, p_estado) in (('enviado','en_preparacion'), ('enviado','servido')) then
    update orders set status = p_estado, auto_aceptado = false,
           received_at = coalesce(received_at, now()), received_by = coalesce(received_by, s.name),
           served_at = case when p_estado = 'servido' then now() end,
           served_by = case when p_estado = 'servido' then s.name end
     where id = o.id;
  elsif (o.status, p_estado) = ('en_preparacion','servido') then
    update orders set status = 'servido', served_at = now(), served_by = s.name where id = o.id;
  elsif (o.status, p_estado) = ('servido','en_preparacion') then
    update orders set status = 'en_preparacion', served_at = null, served_by = null where id = o.id;
  elsif (o.status, p_estado) = ('en_preparacion','enviado') then
    update orders set status = 'enviado', auto_aceptado = false, nuevo_desde = now(),
           received_at = null, received_by = null where id = o.id;
  else
    raise exception 'CAMBIO_NO_VALIDO';
  end if;
  return privado.pedido_json(o.id);
end $$;

-- Modificar un pedido desde el panel (camarero, barra y admin), en
-- cualquier estado, también servido (p. ej. la mesa ya no quiere algo).
-- p_cambios = {"lineas": [{"id": 12, "cantidad": 0}, ...],
--              "nuevas": [{"producto": 35, "cantidad": 1, "nota": ""}, ...]}
-- Una línea a 0 no se borra: queda en el pedido en gris y a cero euros.
-- Los productos nuevos van al precio de la base, tienen que ser del mismo
-- bar y no pueden estar agotados.
create or replace function public.panel_modificar_pedido(p_token text, p_pedido bigint, p_cambios jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare
  s staff; o orders; l jsonb; p products; v_cant int; v_nota text;
  d jsonb := coalesce(p_cambios, '{}'::jsonb);
begin
  s := privado.exigir_rol(p_token, array['camarero','barra','admin']);
  select * into o from orders where id = p_pedido and bar_id = s.bar_id for update;
  if not found then
    raise exception 'PEDIDO_NO_ENCONTRADO';
  end if;
  -- Un pedido ya cobrado no se cambia (primero hay que reabrir su cuenta).
  if o.cobrado_at is not null then
    raise exception 'YA_COBRADO';
  end if;

  -- Cambiar cantidades de líneas que ya están en el pedido.
  for l in select * from jsonb_array_elements(coalesce(d->'lineas', '[]'::jsonb)) loop
    begin
      v_cant := (l->>'cantidad')::int;
    exception when others then
      raise exception 'CANTIDAD_NO_VALIDA';
    end;
    if v_cant is null or v_cant < 0 or v_cant > 20 then
      raise exception 'CANTIDAD_NO_VALIDA';
    end if;
    update order_items set quantity = v_cant
     where id = (case when (l->>'id') ~ '^[0-9]{1,18}$' then (l->>'id')::bigint end)
       and order_id = o.id;
    if not found then
      raise exception 'LINEA_NO_VALIDA';
    end if;
  end loop;

  -- Añadir productos nuevos.
  for l in select * from jsonb_array_elements(coalesce(d->'nuevas', '[]'::jsonb)) loop
    begin
      v_cant := (l->>'cantidad')::int;
    exception when others then
      raise exception 'CANTIDAD_NO_VALIDA';
    end;
    if v_cant is null or v_cant < 1 or v_cant > 20 then
      raise exception 'CANTIDAD_NO_VALIDA';
    end if;
    select * into p from products
     where id = (case when (l->>'producto') ~ '^[0-9]{1,9}$' then (l->>'producto')::int end)
       and bar_id = s.bar_id and visible;
    if not found then
      raise exception 'PRODUCTO_NO_VALIDO';
    end if;
    if not p.available then
      raise exception 'AGOTADO:%', coalesce(p.name, '');
    end if;
    v_nota := left(btrim(regexp_replace(coalesce(l->>'nota', ''), '[[:cntrl:]]', ' ', 'g')), 140);
    insert into order_items (order_id, product_id, product_name, size, unit_price, quantity, note)
    values (o.id, p.id, p.name, p.size, p.price, v_cant, v_nota);
  end loop;

  if (select count(*) from order_items where order_id = o.id) > 40 then
    raise exception 'DEMASIADAS_LINEAS';
  end if;

  update orders
     set total = (select coalesce(sum(unit_price * quantity), 0) from order_items where order_id = o.id)
   where id = o.id;
  return privado.pedido_json(o.id);
end $$;

revoke execute on all functions in schema privado from public, anon, authenticated;
revoke execute on function public.panel_cobrar(text, integer, jsonb), public.panel_cobradas(text),
  public.panel_reabrir_cuenta(text, integer, timestamptz) from public;
grant execute on function
  public.panel_cobrar(text, integer, jsonb),
  public.panel_cobradas(text),
  public.panel_reabrir_cuenta(text, integer, timestamptz)
to anon, authenticated;

commit;
