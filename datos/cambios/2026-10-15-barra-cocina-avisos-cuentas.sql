-- =====================================================================
-- CAMBIO 15 oct 2026 · v15: barra y cocina, avisos de la mesa y cuentas
-- ---------------------------------------------------------------------
-- Tres opciones de la plataforma, apagadas por defecto (ajustes del bar):
--  * barra_cocina: cada pestaña va a 'barra' o a 'cocina'
--    (categories.destino) y un pedido con las dos cosas se divide en dos
--    partes con el mismo número; cada parte lleva su estado.
--  * avisos_mesa: «Llamar al camarero» y «Pedir la cuenta» desde la carta
--    (tabla avisos); salen en el panel hasta pulsar «Atendido».
--  * cuentas_mesa: vista «Cuentas» en el panel con todo lo de cada mesa
--    sin cobrar y el botón «Cobrada» (orders.cobrado_at).
-- La 1.ª parte la devuelve crear_pedido como siempre (la carta v14 sigue
-- funcionando) y, además, todas en "partes". No borra nada. Copia exacta
-- de las funciones de datos/funciones.sql.
-- Las opciones se encienden en La Mar de Gambas al publicar la v15 (al
-- final, aparte).
-- =====================================================================

begin;

alter table categories add column if not exists destino text not null default 'cocina'
  check (destino in ('barra','cocina'));
alter table orders add column if not exists destino text check (destino in ('barra','cocina'));
alter table orders add column if not exists parte_de bigint;
alter table orders add column if not exists cobrado_at timestamptz;
alter table orders add column if not exists cobrado_por text;

create table if not exists avisos (
  id            bigint generated always as identity primary key,
  bar_id        integer not null references bares(id),
  mesa_id       integer not null,
  tipo          text not null check (tipo in ('camarero','cuenta')),
  created_at    timestamptz not null default now(),
  atendido_at   timestamptz,
  atendido_por  text,
  foreign key (bar_id, mesa_id) references mesas(bar_id, id)
);
create index if not exists avisos_bar_idx on avisos (bar_id, created_at);
alter table avisos enable row level security;
revoke all on avisos from public, anon, authenticated;

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
  -- 2.ª parte de un pedido dividido (barra y cocina): mismo número que la 1.ª.
  if new.parte_de is not null then
    select numero into new.numero from orders where id = new.parte_de;
    return new;
  end if;
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

-- Un pedido con sus líneas, en el formato que usan la carta y el panel.
create or replace function privado.pedido_json(p_id bigint)
returns jsonb
language sql stable security definer
set search_path = public, privado, pg_temp
as $$
  select jsonb_build_object(
    'id', o.id,
    'numero', coalesce(o.numero, o.id),
    'destino', o.destino,
    'parte_de', o.parte_de,
    'cobrado', o.cobrado_at,
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

-- Crea un pedido con sus líneas. Si el bar separa barra y cocina
-- (ajustes.barra_cocina), lo divide en dos partes según el destino de la
-- pestaña de cada producto: primero la de barra y luego la de cocina, con
-- el mismo número y la misma ronda; cada parte lleva su propio estado.
-- Devuelve la lista de partes (una sola si no se divide).
create or replace function privado.crear_partes(p_bar integer, p_mesa integer, p_ronda integer, p_dispositivo uuid, p_lineas jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare
  v_separa boolean; g record; v_id bigint; v_primera bigint; v_total numeric; v_res jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'PEDIDO_VACIO';
  end if;
  if jsonb_array_length(p_lineas) > 30 then
    raise exception 'DEMASIADAS_LINEAS';
  end if;
  select coalesce((ajustes->>'barra_cocina')::boolean, false) into v_separa from bares where id = p_bar;
  for g in
    select case when v_separa then coalesce(c.destino, 'cocina') end as destino,
           jsonb_agg(l.v order by l.n) as lineas
      from jsonb_array_elements(p_lineas) with ordinality as l(v, n)
      left join products pr on pr.bar_id = p_bar
            and pr.id = (case when (l.v->>'producto') ~ '^[0-9]{1,9}$' then (l.v->>'producto')::int end)
      left join categories c on c.bar_id = p_bar and c.id = pr.category_id
     group by 1
     order by 1 nulls first   -- 'barra' antes que 'cocina'
  loop
    insert into orders (bar_id, mesa_id, round_number, device_key, destino, parte_de)
    values (p_bar, p_mesa, p_ronda, p_dispositivo, g.destino, v_primera)
    returning id into v_id;
    v_primera := coalesce(v_primera, v_id);
    v_total := privado.guardar_lineas(v_id, g.lineas);
    update orders set total = v_total where id = v_id;
    v_res := v_res || jsonb_build_array(privado.pedido_json(v_id));
  end loop;
  return v_res;
end $$;

-- Crear un pedido.
create or replace function public.crear_pedido(p_bar text, p_mesa integer, p_codigo text, p_dispositivo uuid, p_lineas jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare
  b bares; v_partes jsonb; v_ronda int; v_hasta timestamptz;
begin
  b := privado.bar_de_slug(p_bar);
  if p_dispositivo is null then
    raise exception 'DISPOSITIVO_NO_VALIDO';
  end if;
  -- La mesa debe ser de este bar, estar activa y el código coincidir. Se
  -- bloquea la fila de la mesa para contar los pedidos sin carreras.
  select abierta_hasta into v_hasta from mesas
   where bar_id = b.id and id = p_mesa and active and code = p_codigo for update;
  if not found then
    raise exception 'MESA_NO_VALIDA';
  end if;
  -- Control de mesas: solo se pide si el camarero ha abierto la mesa.
  if coalesce((b.ajustes->>'control_mesas')::boolean, false)
     and (v_hasta is null or v_hasta <= now()) then
    raise exception 'MESA_CERRADA';
  end if;

  -- Límites anti-spam.
  if exists (select 1 from orders where device_key = p_dispositivo
              and created_at > now() - interval '20 seconds') then
    raise exception 'ESPERA_UN_MOMENTO';
  end if;
  -- (las 2.ª partes de un pedido dividido no cuentan como otro pedido)
  if (select count(*) from orders where device_key = p_dispositivo and parte_de is null
       and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'LIMITE_MOVIL';
  end if;
  if (select count(*) from orders where bar_id = b.id and mesa_id = p_mesa and parte_de is null
       and created_at > now() - interval '10 minutes') >= 6 then
    raise exception 'LIMITE_MESA';
  end if;

  perform privado.limpiar();

  select coalesce(max(round_number), 0) + 1 into v_ronda from orders
   where device_key = p_dispositivo and bar_id = b.id and mesa_id = p_mesa
     and created_at > now() - interval '12 hours';

  -- Devuelve la 1.ª parte (como siempre) y, en "partes", todas.
  v_partes := privado.crear_partes(b.id, p_mesa, v_ronda, p_dispositivo, p_lineas);
  return (v_partes->0) || jsonb_build_object('partes', v_partes);
end $$;

-- Crear un pedido desde el panel (camarero, barra y admin) para una mesa
-- de su bar. No necesita el código del QR ni tiene límite anti-spam. Entra
-- como NUEVO, igual que los pedidos de los clientes. Precio de la base y
-- sin agotados (lo comprueba privado.guardar_lineas).
create or replace function public.panel_crear_pedido(p_token text, p_mesa integer, p_lineas jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff; v_partes jsonb;
begin
  s := privado.exigir_rol(p_token, array['camarero','barra','admin']);
  perform 1 from mesas where bar_id = s.bar_id and id = p_mesa;
  if not found then
    raise exception 'MESA_NO_VALIDA';
  end if;
  -- Igual que en la carta: con «barra y cocina» se divide en dos partes.
  v_partes := privado.crear_partes(s.bar_id, p_mesa, 1, gen_random_uuid(), p_lineas);
  return (v_partes->0) || jsonb_build_object('partes', v_partes);
end $$;

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

-- Avisos sin atender del bar (para el panel).
create or replace function privado.avisos_json(p_bar integer)
returns jsonb
language sql stable security definer
set search_path = public, privado, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'mesa', a.mesa_id, 'mesa_nombre', m.name,
                    'tipo', a.tipo, 'creado', a.created_at) order by a.created_at), '[]'::jsonb)
    from avisos a join mesas m on m.bar_id = a.bar_id and m.id = a.mesa_id
   where a.bar_id = p_bar and a.atendido_at is null
     and a.created_at > now() - interval '12 hours'
$$;

-- Lo que el panel pregunta cada pocos segundos: pedidos del día y avisos
-- de las mesas sin atender.
create or replace function public.panel_estado(p_token text, p_desde timestamptz default null)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff;
begin
  s := privado.exigir_rol(p_token, array['camarero','barra','admin']);
  return jsonb_build_object('pedidos', public.panel_pedidos(p_token, p_desde),
                            'avisos', privado.avisos_json(s.bar_id));
end $$;

-- Marcar un aviso como atendido.
create or replace function public.panel_atender_aviso(p_token text, p_aviso bigint)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff;
begin
  s := privado.exigir_rol(p_token, array['camarero','barra','admin']);
  update avisos set atendido_at = now(), atendido_por = s.name
   where id = p_aviso and bar_id = s.bar_id and atendido_at is null;
  return privado.avisos_json(s.bar_id);
end $$;

-- Cuentas de las mesas: lo pedido hoy y sin cobrar, mesa por mesa, con
-- todos los pedidos juntos (de todos los móviles, de barra y de cocina).
create or replace function public.panel_cuentas(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff; v_desde timestamptz; v_zona text;
begin
  s := privado.exigir_rol(p_token, array['camarero','barra','admin']);
  select zona_horaria into v_zona from bares where id = s.bar_id;
  v_desde := least(date_trunc('day', now() at time zone v_zona) at time zone v_zona,
                   now() - interval '12 hours');
  return (select coalesce(jsonb_agg(c order by c->>'desde'), '[]'::jsonb) from (
    select jsonb_build_object(
      'mesa', o.mesa_id, 'mesa_nombre', min(m.name),
      'total', sum(o.total), 'pedidos', count(*) filter (where o.parte_de is null),
      'sin_servir', count(*) filter (where o.status <> 'servido'),
      'desde', min(o.created_at),
      'lineas', (select coalesce(jsonb_agg(jsonb_build_object('nombre', x.nombre, 'cantidad', x.cant,
                          'precio', x.precio, 'importe', x.importe) order by x.primera), '[]'::jsonb)
                   from (select i.product_name as nombre, i.unit_price as precio, sum(i.quantity) as cant,
                                sum(i.quantity * i.unit_price) as importe, min(i.id) as primera
                           from order_items i join orders o2 on o2.id = i.order_id
                          where o2.bar_id = s.bar_id and o2.mesa_id = o.mesa_id
                            and o2.cobrado_at is null and o2.created_at > v_desde and i.quantity > 0
                          group by i.product_name, i.unit_price) x)
    ) as c
      from orders o join mesas m on m.bar_id = o.bar_id and m.id = o.mesa_id
     where o.bar_id = s.bar_id and o.cobrado_at is null and o.created_at > v_desde
     group by o.mesa_id) t);
end $$;

-- Cobrar la cuenta de una mesa: sus pedidos de hoy sin cobrar quedan
-- cobrados (los siguientes empiezan una cuenta nueva) y sus avisos, atendidos.
create or replace function public.panel_cobrar_mesa(p_token text, p_mesa integer)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff; v_desde timestamptz; v_zona text; v_n int;
begin
  s := privado.exigir_rol(p_token, array['camarero','barra','admin']);
  select zona_horaria into v_zona from bares where id = s.bar_id;
  v_desde := least(date_trunc('day', now() at time zone v_zona) at time zone v_zona,
                   now() - interval '12 hours');
  update orders set cobrado_at = now(), cobrado_por = s.name
   where bar_id = s.bar_id and mesa_id = p_mesa and cobrado_at is null and created_at > v_desde;
  get diagnostics v_n = row_count;
  update avisos set atendido_at = now(), atendido_por = s.name
   where bar_id = s.bar_id and mesa_id = p_mesa and atendido_at is null;
  return jsonb_build_object('cobrados', v_n);
end $$;

revoke execute on all functions in schema privado from public, anon, authenticated;
revoke execute on function
  public.carta_aviso(text, integer, text, text), public.panel_estado(text, timestamptz),
  public.panel_atender_aviso(text, bigint), public.panel_cuentas(text), public.panel_cobrar_mesa(text, integer)
from public;
grant execute on function
  public.carta_aviso(text, integer, text, text),
  public.panel_estado(text, timestamptz),
  public.panel_atender_aviso(text, bigint),
  public.panel_cuentas(text),
  public.panel_cobrar_mesa(text, integer)
to anon, authenticated;

-- La Mar de Gambas: pestañas de bebida a la barra (el resto, cocina).
update categories set destino = 'barra' where bar_id = 1 and id in ('cafe', 'cervezas', 'bodega');

commit;

-- AL PUBLICAR LA v15 (no antes): encender las tres opciones en La Mar de Gambas.
-- update bares set ajustes = ajustes || '{"barra_cocina": true, "avisos_mesa": true, "cuentas_mesa": true}'
--  where slug = 'lamardegambas';
