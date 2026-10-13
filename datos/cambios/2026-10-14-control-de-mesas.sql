-- =====================================================================
-- CAMBIO 14 oct 2026 · "Control de mesas" (opción de la plataforma)
-- ---------------------------------------------------------------------
-- Con la opción encendida en un bar (ajustes.control_mesas = true), una
-- mesa solo admite pedidos del QR cuando el personal la abre en el panel;
-- se cierra sola a las ajustes.horas_mesa horas (4 por defecto) o al
-- tocar "Cerrar". Apagada por defecto: sin la opción todo sigue igual.
-- No borra nada. Copia exacta de datos/funciones.sql.
-- =====================================================================

alter table mesas add column if not exists abierta_hasta timestamptz;

create or replace function public.carta_mesa(p_bar text, p_mesa integer, p_codigo text)
returns jsonb
language plpgsql stable security definer
set search_path = public, privado, pg_temp
as $$
declare b bares;
begin
  b := privado.bar_de_slug(p_bar);
  return (select jsonb_build_object('id', m.id, 'nombre', m.name,
                   'control', coalesce((b.ajustes->>'control_mesas')::boolean, false),
                   'abierta', m.abierta_hasta is not null and m.abierta_hasta > now())
            from mesas m
           where m.bar_id = b.id and m.id = p_mesa and m.active and m.code = p_codigo);
end $$;

create or replace function public.crear_pedido(p_bar text, p_mesa integer, p_codigo text, p_dispositivo uuid, p_lineas jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare
  b bares; v_id bigint; v_total numeric; v_ronda int; v_hasta timestamptz;
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
  if (select count(*) from orders where device_key = p_dispositivo
       and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'LIMITE_MOVIL';
  end if;
  if (select count(*) from orders where bar_id = b.id and mesa_id = p_mesa
       and created_at > now() - interval '10 minutes') >= 6 then
    raise exception 'LIMITE_MESA';
  end if;

  perform privado.limpiar();

  select count(*) + 1 into v_ronda from orders
   where device_key = p_dispositivo and bar_id = b.id and mesa_id = p_mesa
     and created_at > now() - interval '12 hours';

  insert into orders (bar_id, mesa_id, round_number, device_key)
  values (b.id, p_mesa, v_ronda, p_dispositivo) returning id into v_id;

  v_total := privado.guardar_lineas(v_id, p_lineas);
  update orders set total = v_total where id = v_id;
  return privado.pedido_json(v_id);
end $$;

create or replace function public.panel_mesas(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff;
begin
  s := privado.exigir_rol(p_token, array['camarero','barra','admin']);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', name, 'activa', active,
                   'abierta_hasta', case when abierta_hasta > now() then abierta_hasta end) order by id), '[]'::jsonb)
            from mesas where bar_id = s.bar_id);
end $$;

create or replace function public.panel_abrir_mesa(p_token text, p_mesa integer, p_abrir boolean)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff; v_horas int; r jsonb;
begin
  s := privado.exigir_rol(p_token, array['camarero','barra','admin']);
  select coalesce((ajustes->>'horas_mesa')::int, 4) into v_horas from bares where id = s.bar_id;
  update mesas
     set abierta_hasta = case when p_abrir then now() + make_interval(hours => least(greatest(v_horas, 1), 24)) end
   where bar_id = s.bar_id and id = p_mesa
  returning jsonb_build_object('id', id, 'nombre', name, 'activa', active,
            'abierta_hasta', case when abierta_hasta > now() then abierta_hasta end) into r;
  if r is null then
    raise exception 'MESA_NO_VALIDA';
  end if;
  return r;
end $$;

revoke execute on function public.panel_abrir_mesa(text, integer, boolean) from public;
grant execute on function public.panel_abrir_mesa(text, integer, boolean) to anon, authenticated;

select 'LISTO' as resultado;
