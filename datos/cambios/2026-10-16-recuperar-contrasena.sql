-- =====================================================================
-- CAMBIO 16 oct 2026 · Recuperar la contraseña por correo (v18)
-- ---------------------------------------------------------------------
-- El personal puede pedir en la entrada del panel un enlace para elegir
-- una contraseña nueva. La Edge Function «recuperar-contrasena» (código en
-- servidor/recuperar-contrasena/index.ts) llama a recuperar_crear con la
-- clave secreta de Supabase y manda el correo con Resend. La web solo
-- puede usar personal_restablecer (con el código del enlace).
-- No borra nada. Copia exacta de datos/seguridad.sql y funciones.sql.
-- =====================================================================

begin;

create table if not exists privado.recuperaciones (
  token_hash  bytea primary key,
  staff_id    integer not null references public.staff(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  usado_at    timestamptz
);
create index if not exists recuperaciones_staff_idx on privado.recuperaciones (staff_id, created_at);
alter table privado.recuperaciones enable row level security;
revoke all on privado.recuperaciones from public, anon, authenticated;

-- Crea un enlace de recuperación para ese correo (o null si no es de un
-- usuario activo de un bar activo, o si ya pidió 3 en la última hora).
-- Anula los enlaces anteriores sin usar. SOLO para el servidor (service_role).
create or replace function public.recuperar_crear(p_email text)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare s staff; b bares; v_token text;
begin
  select * into s from staff where lower(email) = lower(btrim(coalesce(p_email, ''))) and active;
  if not found then
    return null;
  end if;
  select * into b from bares where id = s.bar_id and activo;
  if not found then
    return null;
  end if;
  if (select count(*) from privado.recuperaciones
       where staff_id = s.id and created_at > now() - interval '1 hour') >= 3 then
    return null;
  end if;
  update privado.recuperaciones set usado_at = now() where staff_id = s.id and usado_at is null;
  v_token := encode(privado.gen_random_bytes(32), 'hex');
  insert into privado.recuperaciones (token_hash, staff_id, expires_at)
  values (privado.digest(v_token, 'sha256'), s.id, now() + interval '30 minutes');
  return jsonb_build_object('token', v_token, 'email', s.email, 'nombre', s.name,
                            'bar_nombre', b.nombre, 'bar_slug', b.slug);
end $$;

-- Poner una contraseña nueva con el enlace del correo. Cierra las
-- sesiones abiertas de ese usuario y le quita el bloqueo por fallos.
create or replace function public.personal_restablecer(p_token text, p_nueva text)
returns jsonb
language plpgsql security definer
set search_path = public, privado, pg_temp
as $$
declare r privado.recuperaciones; v_email text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'ENLACE_NO_VALIDO';
  end if;
  select * into r from privado.recuperaciones
   where token_hash = privado.digest(p_token, 'sha256') for update;
  if not found or r.usado_at is not null or r.expires_at < now() then
    raise exception 'ENLACE_NO_VALIDO';
  end if;
  if length(coalesce(p_nueva, '')) < 8 then
    raise exception 'PASSWORD_CORTA';
  end if;
  update staff set password_hash = privado.crypt(p_nueva, privado.gen_salt('bf', 10)),
                   must_change_password = false, failed_attempts = 0, locked_until = null
   where id = r.staff_id and active
  returning email into v_email;
  if v_email is null then
    raise exception 'ENLACE_NO_VALIDO';
  end if;
  update privado.recuperaciones set usado_at = now() where token_hash = r.token_hash;
  update privado.sesiones set expires_at = now() where staff_id = r.staff_id and expires_at > now();
  return jsonb_build_object('email', v_email);
end $$;

revoke execute on function public.recuperar_crear(text) from public, anon, authenticated;
revoke execute on function public.personal_restablecer(text, text) from public;
grant execute on function public.personal_restablecer(text, text) to anon, authenticated;
grant execute on function public.recuperar_crear(text) to service_role;

commit;
