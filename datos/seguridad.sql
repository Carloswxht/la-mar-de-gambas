-- =====================================================================
-- SEGURIDAD, LOGIN Y PERMISOS POR ROL · La Mar de Gambas
-- ---------------------------------------------------------------------
-- Ejecutar después de datos/esquema.sql y datos/datos-iniciales.sql.
--
-- CÓMO FUNCIONA (resumen para no programadores)
-- * Las tablas están cerradas: la web NO puede leer ni escribir ninguna
--   tabla directamente (seguridad por fila activada y sin permisos).
-- * La web solo puede llamar a una lista cerrada de "ventanillas"
--   (funciones) que comprueban todo antes de tocar nada:
--     - Cliente de la mesa (sin login): ver la carta, crear SU pedido
--       con el código secreto de la mesa, editarlo mientras siga
--       "enviado" y no hayan pasado 3 minutos, y ver solo sus pedidos.
--     - Camarero: ver pedidos, marcar En preparación / Servido / Deshacer
--       modificar pedidos (quitar productos a 0) y crear pedidos nuevos
--       para una mesa (entran ya "en preparación").
--     - Barra: lo del camarero + marcar productos agotados.
--     - Admin: todo lo anterior + precios, productos, mesas y usuarios.
-- * El precio lo pone siempre la base, nunca el móvil del cliente.
-- * Límites anti-spam: 1 pedido cada 20 s y 10 por hora por móvil,
--   6 pedidos cada 10 min por mesa, 30 líneas y 20 unidades por línea.
-- * Login del personal con correo y contraseña, guardado en la propia
--   base (sin cookies, para que funcione igual en Safari/iPhone). La
--   contraseña va cifrada (bcrypt); 5 fallos seguidos bloquean 15 min;
--   la sesión dura 16 h (un turno largo).
-- * Limpieza automática: pedidos de más de 30 días se borran y las notas
--   de más de 24 h se vacían (por si alguien escribe datos personales).
--
-- PARA MIGRAR A SUPABASE: este archivo se rehace. Las tablas y los datos
-- (esquema.sql, datos-iniciales.sql) se reutilizan tal cual.
-- Tras aplicar cambios aquí, esperar 30–60 s antes de probar desde la web.
-- =====================================================================

-- ---------------- ZONA PRIVADA (no se publica en la web) ----------------
create schema if not exists privado;
revoke all on schema privado from public, anonymous, authenticated;
create extension if not exists pgcrypto schema privado;

-- Sesiones del personal: se guarda solo la huella (hash) del token.
create table privado.sesiones (
  token_hash  bytea primary key,
  staff_id    integer not null references public.staff(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index sesiones_staff_idx on privado.sesiones (staff_id);

-- Las funciones nuevas no se pueden ejecutar desde la web salvo que se
-- diga expresamente (por defecto Postgres deja a todo el mundo).
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public;

-- ---------------- AYUDANTES INTERNOS ----------------

-- Quién es el usuario del personal de este token (o error si no vale).
create function privado.staff_de_token(p_token text)
returns public.staff
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s public.staff;
begin
  if p_token is null or length(p_token) <> 64 then
    raise exception 'SESION_CADUCADA';
  end if;
  select st.* into s
    from privado.sesiones se join public.staff st on st.id = se.staff_id
   where se.token_hash = privado.digest(p_token, 'sha256')
     and se.expires_at > now()
     and st.active;
  if not found then
    raise exception 'SESION_CADUCADA';
  end if;
  return s;
end $$;

-- Igual, pero exige uno de los roles indicados.
create function privado.exigir_rol(p_token text, p_roles text[])
returns public.staff
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s public.staff;
begin
  s := privado.staff_de_token(p_token);
  if not (s.role = any (p_roles)) then
    raise exception 'SIN_PERMISO';
  end if;
  return s;
end $$;

-- Un pedido con sus líneas, en el formato que usan la carta y el panel.
create function privado.pedido_json(p_id bigint)
returns jsonb
language sql stable security definer
set search_path = public, privado, pg_temp
as $$
  select jsonb_build_object(
    'id', o.id,
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
  from orders o join mesas m on m.id = o.mesa_id
  where o.id = p_id
$$;

-- Comprueba las líneas que manda el cliente y las guarda con el precio
-- de la base. p_previas: cantidades que ya tenía el pedido (al editar),
-- para permitir mantener un producto que se ha agotado mientras tanto.
create function privado.guardar_lineas(p_pedido bigint, p_lineas jsonb, p_previas jsonb default '{}'::jsonb)
returns numeric
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare
  l jsonb; p products; v_cant int; v_nota text; v_total numeric := 0;
begin
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'PEDIDO_VACIO';
  end if;
  if jsonb_array_length(p_lineas) > 30 then
    raise exception 'DEMASIADAS_LINEAS';
  end if;
  for l in select * from jsonb_array_elements(p_lineas) loop
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
       and visible;
    if not found then
      raise exception 'PRODUCTO_NO_VALIDO';
    end if;
    if not p.available and v_cant > coalesce((p_previas->>p.id::text)::int, 0) then
      raise exception 'AGOTADO:%', coalesce(p.name, '');
    end if;
    v_nota := left(btrim(regexp_replace(coalesce(l->>'nota', ''), '[[:cntrl:]]', ' ', 'g')), 140);
    insert into order_items (order_id, product_id, product_name, size, unit_price, quantity, note)
    values (p_pedido, p.id, p.name, p.size, p.price, v_cant, v_nota);
    v_total := v_total + p.price * v_cant;
  end loop;
  return v_total;
end $$;

-- Pedidos NUEVOS que llevan 3 minutos sin que nadie los acepte pasan solos
-- a "en preparación" (con la marca auto_aceptado).
create function privado.auto_aceptar()
returns void
language sql security definer
set search_path = public, privado, pg_temp
as $$
  update orders
     set status = 'en_preparacion', auto_aceptado = true, received_at = now(), received_by = null
   where status = 'enviado' and nuevo_desde < now() - interval '3 minutes';
$$;

-- Limpieza: pedidos de más de 30 días fuera; notas de más de 24 h vacías;
-- sesiones caducadas fuera.
create function privado.limpiar()
returns void
language sql security definer
set search_path = public, privado, pg_temp
as $$
  delete from orders where created_at < now() - interval '30 days';
  update order_items set note = ''
   where note <> ''
     and order_id in (select id from orders where created_at < now() - interval '24 hours');
  delete from privado.sesiones where expires_at < now();
$$;

-- =====================================================================
-- VENTANILLAS DE LA CARTA (cliente de la mesa, sin login)
-- =====================================================================

-- La carta: pestañas y productos visibles, con precio y si están agotados.
create function public.carta_menu()
returns jsonb
language sql stable security definer
set search_path = public, privado, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'multi', c.multi, 'fam', c.fam, 'labs', to_jsonb(c.labs),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'dbId', p.id, 'n', p.name, 'dn', p.display_name, 'd', p.description,
        'p', p.price, 'size', p.size, 'only', p.only_size, 'sec', p.section,
        'pop', p.featured, 'al', to_jsonb(p.allergens), 'img', p.photo,
        'agotado', not p.available) order by p.sort_order, p.id)
      from products p where p.category_id = c.id and p.visible), '[]'::jsonb)
  ) order by c.sort_order), '[]'::jsonb)
  from categories c
$$;

-- Nombre de la mesa si el número y el código del QR son correctos.
create function public.carta_mesa(p_mesa integer, p_codigo text)
returns jsonb
language sql stable security definer
set search_path = public, privado, pg_temp
as $$
  select jsonb_build_object('id', m.id, 'nombre', m.name)
    from mesas m
   where m.id = p_mesa and m.active and m.code = p_codigo
$$;

-- Crear un pedido.
create function public.crear_pedido(p_mesa integer, p_codigo text, p_dispositivo uuid, p_lineas jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare
  v_id bigint; v_total numeric; v_ronda int;
begin
  if p_dispositivo is null then
    raise exception 'DISPOSITIVO_NO_VALIDO';
  end if;
  -- La mesa debe existir, estar activa y el código coincidir. Se bloquea
  -- la fila de la mesa para contar los pedidos sin carreras.
  perform 1 from mesas where id = p_mesa and active and code = p_codigo for update;
  if not found then
    raise exception 'MESA_NO_VALIDA';
  end if;

  -- Límites anti-spam.
  if exists (select 1 from orders where device_key = p_dispositivo
              and created_at > now() - interval '20 seconds') then
    raise exception 'ESPERA_UN_MOMENTO';
  end if;
  if (select count(*) from orders where device_key = p_dispositivo
       and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'LIMITE_MOVIL';
  end if;
  if (select count(*) from orders where mesa_id = p_mesa
       and created_at > now() - interval '10 minutes') >= 6 then
    raise exception 'LIMITE_MESA';
  end if;

  perform privado.limpiar();

  select count(*) + 1 into v_ronda from orders
   where device_key = p_dispositivo and mesa_id = p_mesa
     and created_at > now() - interval '12 hours';

  insert into orders (mesa_id, round_number, device_key)
  values (p_mesa, v_ronda, p_dispositivo) returning id into v_id;

  v_total := privado.guardar_lineas(v_id, p_lineas);
  update orders set total = v_total where id = v_id;
  return privado.pedido_json(v_id);
end $$;

-- Editar (o anular, si se manda una lista vacía) un pedido propio
-- mientras siga "enviado" y no hayan pasado 3 minutos.
create function public.editar_pedido(p_pedido bigint, p_dispositivo uuid, p_lineas jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare
  o orders; v_previas jsonb; v_total numeric;
begin
  select * into o from orders where id = p_pedido for update;
  if not found or o.device_key is distinct from p_dispositivo then
    raise exception 'PEDIDO_NO_ENCONTRADO';
  end if;
  if o.status <> 'enviado' or o.created_at < now() - interval '3 minutes' then
    raise exception 'YA_NO_EDITABLE';
  end if;

  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    delete from orders where id = o.id;
    return jsonb_build_object('id', o.id, 'anulado', true);
  end if;

  select coalesce(jsonb_object_agg(product_id::text, cant), '{}'::jsonb) into v_previas
    from (select product_id, sum(quantity) cant from order_items
           where order_id = o.id group by product_id) t;
  delete from order_items where order_id = o.id;
  v_total := privado.guardar_lineas(o.id, p_lineas, v_previas);
  update orders set total = v_total, modified_at = now() where id = o.id;
  return privado.pedido_json(o.id);
end $$;

-- Los pedidos de este móvil en las últimas 12 horas (para el tique).
create function public.mis_pedidos(p_dispositivo uuid)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
begin
  perform privado.auto_aceptar();
  return (select coalesce(jsonb_agg(privado.pedido_json(o.id) order by o.created_at), '[]'::jsonb)
            from orders o
           where o.device_key = p_dispositivo
             and o.created_at > now() - interval '12 hours');
end $$;

-- =====================================================================
-- LOGIN DEL PERSONAL
-- =====================================================================

-- Entrar con correo y contraseña. Devuelve el token de la sesión, o
-- {"error": "CREDENCIALES"} (sin lanzar error, para que se guarde el
-- contador de intentos fallidos).
create function public.personal_entrar(p_email text, p_password text)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare
  s staff; v_token text;
begin
  select * into s from staff where lower(email) = lower(btrim(coalesce(p_email, ''))) for update;
  if not found then
    -- Mismo trabajo que con un usuario real, para no revelar qué correos existen.
    perform privado.crypt(coalesce(p_password, ''), privado.gen_salt('bf', 10));
    return jsonb_build_object('error', 'CREDENCIALES');
  end if;
  if s.locked_until is not null and s.locked_until > now() then
    raise exception 'BLOQUEADO';
  end if;
  if not s.active or s.password_hash <> privado.crypt(coalesce(p_password, ''), s.password_hash) then
    update staff
       set failed_attempts = failed_attempts + 1,
           locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' end
     where id = s.id;
    return jsonb_build_object('error', 'CREDENCIALES');
  end if;

  update staff set failed_attempts = 0, locked_until = null where id = s.id;
  delete from privado.sesiones where expires_at < now();
  v_token := encode(privado.gen_random_bytes(32), 'hex');
  insert into privado.sesiones (token_hash, staff_id, expires_at)
  values (privado.digest(v_token, 'sha256'), s.id, now() + interval '16 hours');

  return jsonb_build_object('token', v_token, 'nombre', s.name, 'rol', s.role,
                            'email', s.email, 'cambiar_password', s.must_change_password);
end $$;

-- Quién soy (para comprobar al abrir el panel que la sesión sigue viva).
create function public.personal_yo(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff;
begin
  s := privado.staff_de_token(p_token);
  return jsonb_build_object('nombre', s.name, 'rol', s.role, 'email', s.email,
                            'cambiar_password', s.must_change_password);
end $$;

-- Salir (borra la sesión de este dispositivo).
create function public.personal_salir(p_token text)
returns void
language sql security definer
set search_path = public, privado, pg_temp
as $$
  delete from privado.sesiones where token_hash = privado.digest(coalesce(p_token, ''), 'sha256');
$$;

-- Cambiar la contraseña propia (obligatorio la primera vez).
create function public.personal_cambiar_password(p_token text, p_actual text, p_nueva text)
returns void
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff;
begin
  s := privado.staff_de_token(p_token);
  if s.password_hash <> privado.crypt(coalesce(p_actual, ''), s.password_hash) then
    raise exception 'CREDENCIALES';
  end if;
  if length(coalesce(p_nueva, '')) < 8 then
    raise exception 'PASSWORD_CORTA';
  end if;
  update staff set password_hash = privado.crypt(p_nueva, privado.gen_salt('bf', 10)),
                   must_change_password = false
   where id = s.id;
  -- Cierra las demás sesiones abiertas de este usuario.
  delete from privado.sesiones
   where staff_id = s.id and token_hash <> privado.digest(p_token, 'sha256');
end $$;

-- =====================================================================
-- VENTANILLAS DEL PANEL (camarero, barra y admin)
-- =====================================================================

-- Pedidos del día (desde las 00:00 de Madrid, o las últimas 12 horas si
-- eso es más; o desde una hora dada). Antes, pasa solos a "en preparación"
-- los nuevos que llevan 3 minutos sin aceptar.
create function public.panel_pedidos(p_token text, p_desde timestamptz default null)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare v_desde timestamptz;
begin
  perform privado.exigir_rol(p_token, array['camarero','barra','admin']);
  perform privado.auto_aceptar();
  v_desde := least(date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid',
                   now() - interval '12 hours');
  return (select coalesce(jsonb_agg(privado.pedido_json(o.id) order by o.created_at), '[]'::jsonb)
            from orders o
           where o.created_at > greatest(coalesce(p_desde, '-infinity'), v_desde));
end $$;

-- Cambiar el estado: Aceptar (en preparación), Servido o Deshacer (un paso
-- atrás). Si se deshace a NUEVO, vuelve a contar 3 minutos.
create function public.panel_marcar(p_token text, p_pedido bigint, p_estado text)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff; o orders;
begin
  s := privado.exigir_rol(p_token, array['camarero','barra','admin']);
  select * into o from orders where id = p_pedido for update;
  if not found then
    raise exception 'PEDIDO_NO_ENCONTRADO';
  end if;
  if p_estado = o.status then
    return privado.pedido_json(o.id);
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

-- Crear un pedido desde el panel (camarero, barra y admin) para una mesa.
-- No necesita el código del QR ni tiene límite anti-spam. Entra directamente
-- "en preparación": lo ha tomado el propio camarero. Precio de la base y
-- sin agotados (lo comprueba privado.guardar_lineas).
create function public.panel_crear_pedido(p_token text, p_mesa integer, p_lineas jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff; v_id bigint; v_total numeric;
begin
  s := privado.exigir_rol(p_token, array['camarero','barra','admin']);
  perform 1 from mesas where id = p_mesa;
  if not found then
    raise exception 'MESA_NO_VALIDA';
  end if;
  insert into orders (mesa_id, round_number, device_key, status, received_at, received_by)
  values (p_mesa, 1, gen_random_uuid(), 'en_preparacion', now(), s.name)
  returning id into v_id;
  v_total := privado.guardar_lineas(v_id, p_lineas);
  update orders set total = v_total where id = v_id;
  return privado.pedido_json(v_id);
end $$;

-- Mesas para elegir al crear un pedido desde el panel (sin códigos del QR).
create function public.panel_mesas(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
begin
  perform privado.exigir_rol(p_token, array['camarero','barra','admin']);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', name, 'activa', active) order by id), '[]'::jsonb)
            from mesas);
end $$;

-- Modificar un pedido desde el panel (camarero, barra y admin), en
-- cualquier estado, también servido (p. ej. la mesa ya no quiere algo).
-- p_cambios = {"lineas": [{"id": 12, "cantidad": 0}, ...],
--              "nuevas": [{"producto": 35, "cantidad": 1, "nota": ""}, ...]}
-- Una línea a 0 no se borra: queda en el pedido en gris y a cero euros.
-- Los productos nuevos van al precio de la base y no pueden estar agotados.
create function public.panel_modificar_pedido(p_token text, p_pedido bigint, p_cambios jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare
  s staff; o orders; l jsonb; p products; v_cant int; v_nota text;
  d jsonb := coalesce(p_cambios, '{}'::jsonb);
begin
  s := privado.exigir_rol(p_token, array['camarero','barra','admin']);
  select * into o from orders where id = p_pedido for update;
  if not found then
    raise exception 'PEDIDO_NO_ENCONTRADO';
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
       and visible;
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

-- Lista completa de productos (con los ocultos) para barra y admin.
create function public.panel_productos(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
begin
  perform privado.exigir_rol(p_token, array['barra','admin']);
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', p.id, 'categoria', p.category_id, 'nombre', p.name, 'nombre_corto', p.display_name,
            'descripcion', p.description, 'tamano', p.size, 'solo_tamano', p.only_size,
            'seccion', p.section, 'precio', p.price, 'disponible', p.available,
            'visible', p.visible, 'destacado', p.featured, 'orden', p.sort_order,
            'actualizado', p.updated_at, 'actualizado_por', p.updated_by)
            order by c.sort_order, p.sort_order, p.id), '[]'::jsonb)
            from products p join categories c on c.id = p.category_id);
end $$;

-- Marcar un producto como agotado o disponible (barra y admin).
create function public.panel_disponible(p_token text, p_producto integer, p_disponible boolean)
returns void
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff;
begin
  s := privado.exigir_rol(p_token, array['barra','admin']);
  update products set available = coalesce(p_disponible, true), updated_at = now(), updated_by = s.name
   where id = p_producto;
  if not found then
    raise exception 'PRODUCTO_NO_VALIDO';
  end if;
end $$;

-- =====================================================================
-- VENTANILLAS DEL ADMINISTRADOR
-- =====================================================================

-- Crear (sin "id") o cambiar (con "id") un producto: precio, nombre,
-- visible, etc. Los productos no se borran: se ocultan (visible = false),
-- para no romper pedidos antiguos.
create function public.admin_guardar_producto(p_token text, p_datos jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff; v_id int; d jsonb := coalesce(p_datos, '{}'::jsonb);
begin
  s := privado.exigir_rol(p_token, array['admin']);
  if d ? 'id' and d->>'id' is not null then
    update products set
      category_id  = coalesce(d->>'categoria', category_id),
      name         = coalesce(nullif(btrim(d->>'nombre'), ''), name),
      display_name = case when d ? 'nombre_corto' then nullif(btrim(d->>'nombre_corto'), '') else display_name end,
      description  = coalesce(d->>'descripcion', description),
      size         = case when d ? 'tamano' then nullif(d->>'tamano', '') else size end,
      only_size    = coalesce((d->>'solo_tamano')::boolean, only_size),
      section      = coalesce(d->>'seccion', section),
      price        = coalesce((d->>'precio')::numeric, price),
      available    = coalesce((d->>'disponible')::boolean, available),
      visible      = coalesce((d->>'visible')::boolean, visible),
      featured     = coalesce((d->>'destacado')::boolean, featured),
      sort_order   = coalesce((d->>'orden')::int, sort_order),
      updated_at   = now(), updated_by = s.name
    where id = (d->>'id')::int
    returning id into v_id;
    if v_id is null then
      raise exception 'PRODUCTO_NO_VALIDO';
    end if;
  else
    if nullif(btrim(d->>'nombre'), '') is null or d->>'categoria' is null or d->>'precio' is null then
      raise exception 'FALTAN_DATOS';
    end if;
    insert into products (category_id, name, display_name, description, size, only_size, section,
                          price, available, visible, featured, sort_order, updated_by)
    values (d->>'categoria', btrim(d->>'nombre'), nullif(btrim(d->>'nombre_corto'), ''),
            coalesce(d->>'descripcion', ''), nullif(d->>'tamano', ''),
            coalesce((d->>'solo_tamano')::boolean, false), coalesce(d->>'seccion', ''),
            (d->>'precio')::numeric, coalesce((d->>'disponible')::boolean, true),
            coalesce((d->>'visible')::boolean, true), coalesce((d->>'destacado')::boolean, false),
            coalesce((d->>'orden')::int, (select coalesce(max(sort_order), 0) + 1 from products)),
            s.name)
    returning id into v_id;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- Lista de usuarios del personal (sin contraseñas).
create function public.admin_usuarios(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
begin
  perform privado.exigir_rol(p_token, array['admin']);
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', id, 'email', email, 'nombre', name, 'rol', role, 'activo', active,
            'cambiar_password', must_change_password,
            'bloqueado', locked_until is not null and locked_until > now()) order by name), '[]'::jsonb)
            from staff);
end $$;

-- Crear (sin "id") o cambiar (con "id") un usuario. Si se manda
-- "password", queda como contraseña provisional y el usuario tendrá que
-- cambiarla al entrar. Nunca puede quedarse el local sin admin activo.
create function public.admin_guardar_usuario(p_token text, p_datos jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff; v_id int; d jsonb := coalesce(p_datos, '{}'::jsonb); v_pass text;
begin
  s := privado.exigir_rol(p_token, array['admin']);
  v_pass := nullif(d->>'password', '');
  if v_pass is not null and length(v_pass) < 8 then
    raise exception 'PASSWORD_CORTA';
  end if;
  if d->>'rol' is not null and d->>'rol' not in ('camarero','barra','admin') then
    raise exception 'ROL_NO_VALIDO';
  end if;

  if d ? 'id' and d->>'id' is not null then
    update staff set
      email  = coalesce(nullif(btrim(d->>'email'), ''), email),
      name   = coalesce(nullif(btrim(d->>'nombre'), ''), name),
      role   = coalesce(d->>'rol', role),
      active = coalesce((d->>'activo')::boolean, active),
      password_hash = case when v_pass is not null then privado.crypt(v_pass, privado.gen_salt('bf', 10)) else password_hash end,
      must_change_password = case when v_pass is not null then true else must_change_password end,
      failed_attempts = case when v_pass is not null then 0 else failed_attempts end,
      locked_until    = case when v_pass is not null then null else locked_until end
    where id = (d->>'id')::int
    returning id into v_id;
    if v_id is null then
      raise exception 'USUARIO_NO_VALIDO';
    end if;
    -- Si se desactiva o se le cambia la contraseña, se cierran sus sesiones.
    if v_pass is not null or (d->>'activo')::boolean is false then
      delete from privado.sesiones where staff_id = v_id;
    end if;
  else
    if nullif(btrim(d->>'email'), '') is null or nullif(btrim(d->>'nombre'), '') is null
       or d->>'rol' is null or v_pass is null then
      raise exception 'FALTAN_DATOS';
    end if;
    insert into staff (email, name, role, password_hash)
    values (btrim(d->>'email'), btrim(d->>'nombre'), d->>'rol', privado.crypt(v_pass, privado.gen_salt('bf', 10)))
    returning id into v_id;
  end if;

  if not exists (select 1 from staff where role = 'admin' and active) then
    raise exception 'ULTIMO_ADMIN';
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- Mesas con su código secreto (para imprimir los QR).
create function public.admin_mesas(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
begin
  perform privado.exigir_rol(p_token, array['admin']);
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', id, 'nombre', name, 'activa', active, 'codigo', code) order by id), '[]'::jsonb)
            from mesas);
end $$;

-- Crear o cambiar una mesa. "nuevo_codigo": true genera otro código
-- (habrá que reimprimir su QR).
create function public.admin_guardar_mesa(p_token text, p_datos jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare d jsonb := coalesce(p_datos, '{}'::jsonb); v_id int;
begin
  perform privado.exigir_rol(p_token, array['admin']);
  v_id := (d->>'id')::int;
  if v_id is null then
    raise exception 'FALTAN_DATOS';
  end if;
  insert into mesas (id, name, active)
  values (v_id, coalesce(nullif(btrim(d->>'nombre'), ''), 'Mesa ' || v_id), coalesce((d->>'activa')::boolean, true))
  on conflict (id) do update set
    name   = coalesce(nullif(btrim(d->>'nombre'), ''), mesas.name),
    active = coalesce((d->>'activa')::boolean, mesas.active),
    code   = case when (d->>'nuevo_codigo')::boolean
                  then substr(replace(gen_random_uuid()::text, '-', ''), 1, 8) else mesas.code end;
  return (select jsonb_build_object('id', id, 'nombre', name, 'activa', active, 'codigo', code)
            from mesas where id = v_id);
end $$;

-- =====================================================================
-- PERMISOS: la web solo puede usar estas ventanillas
-- =====================================================================
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema privado from public;

-- Cliente de la mesa y personal (la web siempre entra como "anonymous"
-- o "authenticated"; quién es el personal lo dice su token de sesión).
grant execute on function
  public.carta_menu(),
  public.carta_mesa(integer, text),
  public.crear_pedido(integer, text, uuid, jsonb),
  public.editar_pedido(bigint, uuid, jsonb),
  public.mis_pedidos(uuid),
  public.personal_entrar(text, text),
  public.personal_yo(text),
  public.personal_salir(text),
  public.personal_cambiar_password(text, text, text),
  public.panel_pedidos(text, timestamptz),
  public.panel_marcar(text, bigint, text),
  public.panel_modificar_pedido(text, bigint, jsonb),
  public.panel_crear_pedido(text, integer, jsonb),
  public.panel_mesas(text),
  public.panel_productos(text),
  public.panel_disponible(text, integer, boolean),
  public.admin_guardar_producto(text, jsonb),
  public.admin_usuarios(text),
  public.admin_guardar_usuario(text, jsonb),
  public.admin_mesas(text),
  public.admin_guardar_mesa(text, jsonb)
to anonymous, authenticated;

-- Las tablas siguen cerradas a la web (ver esquema.sql): ni lectura ni escritura.
revoke all on all tables in schema public from public, anonymous, authenticated;
