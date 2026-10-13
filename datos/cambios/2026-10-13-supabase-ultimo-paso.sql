-- =====================================================================
-- CAMBIO 13 oct 2026 · Supabase "multi-bar": último paso de las funciones
-- ---------------------------------------------------------------------
-- Las seis funciones que borran algo (limpieza automática, anular un
-- pedido, sesiones del login, usuarios) y los permisos de la web. Claude
-- no puede cargarlas (Supabase pide una confirmación que se cancela), así
-- que Carlos las pega en Supabase → SQL Editor → Run. Copia exacta de
-- datos/funciones.sql. Se puede ejecutar más de una vez sin problema.
-- =====================================================================

create or replace function privado.limpiar()
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

create or replace function public.editar_pedido(p_pedido bigint, p_dispositivo uuid, p_lineas jsonb)
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

create or replace function public.personal_entrar(p_email text, p_password text)
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
  -- Contraseña buena, pero su bar está dado de baja.
  if not exists (select 1 from bares where id = s.bar_id and activo) then
    raise exception 'BAR_NO_VALIDO';
  end if;

  update staff set failed_attempts = 0, locked_until = null where id = s.id;
  delete from privado.sesiones where expires_at < now();
  v_token := encode(privado.gen_random_bytes(32), 'hex');
  insert into privado.sesiones (token_hash, staff_id, expires_at)
  values (privado.digest(v_token, 'sha256'), s.id, now() + interval '16 hours');

  return jsonb_build_object('token', v_token, 'nombre', s.name, 'rol', s.role,
                            'email', s.email, 'cambiar_password', s.must_change_password,
                            'bar', privado.bar_json(s.bar_id));
end $$;

create or replace function public.personal_salir(p_token text)
returns void
language sql security definer
set search_path = public, privado, pg_temp
as $$
  delete from privado.sesiones where token_hash = privado.digest(coalesce(p_token, ''), 'sha256');
$$;

create or replace function public.personal_cambiar_password(p_token text, p_actual text, p_nueva text)
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

create or replace function public.admin_guardar_usuario(p_token text, p_datos jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff; v_id int; d jsonb := coalesce(p_datos, '{}'::jsonb); v_pass text; v_email text;
begin
  s := privado.exigir_rol(p_token, array['admin']);
  v_pass := nullif(d->>'password', '');
  v_email := nullif(btrim(d->>'email'), '');
  if v_pass is not null and length(v_pass) < 8 then
    raise exception 'PASSWORD_CORTA';
  end if;
  if d->>'rol' is not null and d->>'rol' not in ('camarero','barra','admin') then
    raise exception 'ROL_NO_VALIDO';
  end if;
  -- El correo es único en toda la plataforma (sin decir de qué bar es el otro).
  if v_email is not null and exists (
       select 1 from staff where lower(email) = lower(v_email)
          and id is distinct from (case when d->>'id' ~ '^[0-9]{1,9}$' then (d->>'id')::int end)) then
    raise exception 'EMAIL_EN_USO';
  end if;

  if d ? 'id' and d->>'id' is not null then
    update staff set
      email  = coalesce(v_email, email),
      name   = coalesce(nullif(btrim(d->>'nombre'), ''), name),
      role   = coalesce(d->>'rol', role),
      active = coalesce((d->>'activo')::boolean, active),
      password_hash = case when v_pass is not null then privado.crypt(v_pass, privado.gen_salt('bf', 10)) else password_hash end,
      must_change_password = case when v_pass is not null then true else must_change_password end,
      failed_attempts = case when v_pass is not null then 0 else failed_attempts end,
      locked_until    = case when v_pass is not null then null else locked_until end
    where id = (d->>'id')::int and bar_id = s.bar_id
    returning id into v_id;
    if v_id is null then
      raise exception 'USUARIO_NO_VALIDO';
    end if;
    -- Si se desactiva o se le cambia la contraseña, se cierran sus sesiones.
    if v_pass is not null or (d->>'activo')::boolean is false then
      delete from privado.sesiones where staff_id = v_id;
    end if;
  else
    if v_email is null or nullif(btrim(d->>'nombre'), '') is null
       or d->>'rol' is null or v_pass is null then
      raise exception 'FALTAN_DATOS';
    end if;
    insert into staff (bar_id, email, name, role, password_hash)
    values (s.bar_id, v_email, btrim(d->>'nombre'), d->>'rol', privado.crypt(v_pass, privado.gen_salt('bf', 10)))
    returning id into v_id;
  end if;

  if not exists (select 1 from staff where bar_id = s.bar_id and role = 'admin' and active) then
    raise exception 'ULTIMO_ADMIN';
  end if;
  return jsonb_build_object('id', v_id);
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema privado from public, anon, authenticated;

-- Cliente de la mesa y personal (la web siempre entra como "anon", el
-- visitante de Supabase; quién es el personal lo dice su token de sesión).
grant execute on function
  public.carta_bar(text),
  public.carta_menu(text),
  public.carta_mesa(text, integer, text),
  public.crear_pedido(text, integer, text, uuid, jsonb),
  public.editar_pedido(bigint, uuid, jsonb),
  public.mis_pedidos(text, uuid),
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
to anon, authenticated;

-- Las tablas siguen cerradas a la web (ver esquema.sql): ni lectura ni escritura.
revoke all on all tables in schema public from public, anon, authenticated;

select 'LISTO' as resultado;
