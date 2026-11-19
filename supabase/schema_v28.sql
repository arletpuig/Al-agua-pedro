-- AL AGUA PEDRO · versión 28 del esquema (ejecutar DESPUÉS de schema_v27.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · Logros diarios: calendario de 7 días (premio por entrar cada día), 3 misiones al día y el «Cofre de la jornada».
--    El progreso de las misiones se mide en el servidor (contadores de hoy menos los del principio del día).
--  · Invitaciones: cada jugador tiene su código. El amigo recibe su regalo al registrarse con él;
--    quien invita cobra 700 pesetas cuando su amigo ha jugado un poco (10 tomates tirados). Máximo 50 amigos cobrados.
--  · La Armería, más barata: chancla 30.000, oca 60.000, toro 110.000, aspiradora 180.000, prensa 290.000 y sello 480.000.
--  · Más niveles en algunas cartas: Hacienda Inversa, Puerta Giratoria, Amnistía y Chantaje Pegasus hasta 30; Paguitas hasta 20.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

-- ============================================================ La Armería y cartas
create or replace function public.fn_armory_price(p text) returns integer language sql immutable as $$
  select case p
    when 'slipper' then 30000 when 'goose' then 60000 when 'bull' then 110000
    when 'vacuum' then 180000 when 'press' then 290000 when 'stamp' then 480000
  end $$;

create or replace function public.fn_max_level(p_id text) returns integer language sql immutable as $$
  select case p_id when 'inflacion' then 30 when 'joyas' then 25 when 'apagon' then 25 when 'mariscada' then 25 when 'amnistia' then 30
    when 'plusultra' then 25 when 'hacienda' then 30 when 'puerta' then 30 when 'paguitas' then 20 when 'pegasus' then 30 end $$;
create or replace function public.fn_paguitas_value(p_level integer) returns integer language sql immutable as $$
  select 3 * least(greatest(p_level, 1), 20) $$;

-- ============================================================ Logros diarios
alter table public.profiles add column if not exists daily jsonb not null default '{}'::jsonb;

-- misiones: 4 de cada dificultad; cada día se elige una de cada (igual que DAILY en js/daily.js)
create or replace function public.fn_daily_pool(p_slot integer) returns jsonb language sql immutable as $$
  select case p_slot
    when 0 then '[["e_tom",  "t", 15], ["e_fall", "f", 3],  ["e_clk", "c", 3000],  ["e_hit",  "h", 10]]'::jsonb
    when 1 then '[["m_tom",  "t", 40], ["m_fall", "f", 8],  ["m_clk",  "c", 12000], ["m_perf", "p", 5]]'::jsonb
    else        '[["h_fall", "f", 20], ["h_tom",  "t", 100], ["h_perf", "p", 15],  ["h_chest", "o", 3]]'::jsonb end $$;
create or replace function public.fn_daily_mission(p_day date, p_slot integer) returns jsonb language sql immutable as $$
  select public.fn_daily_pool(p_slot) -> (((p_day - date '2026-01-01') * (case p_slot when 0 then 1 when 1 then 3 else 5 end) + p_slot) % 4) $$;
create or replace function public.fn_daily_count(p public.profiles, k text) returns bigint language sql immutable as $$
  select case k when 't' then p.tomatoes_thrown::bigint when 'f' then p.falls::bigint when 'c' then p.total_clicks when 'h' then p.hits::bigint
    when 'p' then p.perfects::bigint when 'o' then p.chests_opened::bigint else 0 end $$;
-- el estado de hoy (si ha cambiado el día, se empieza de cero con los contadores de ahora)
create or replace function public.fn_daily_today(p public.profiles) returns jsonb language sql stable as $$
  select case when coalesce(p.daily->>'date', '') = ((now() at time zone 'Europe/Madrid')::date)::text then p.daily
    else jsonb_build_object('date', ((now() at time zone 'Europe/Madrid')::date)::text,
      'base', jsonb_build_object('t', p.tomatoes_thrown, 'f', p.falls, 'c', p.total_clicks, 'h', p.hits, 'p', p.perfects, 'o', p.chests_opened),
      'done', '[]'::jsonb, 'bonus', false, 'login_date', p.daily->'login_date', 'login_streak', coalesce(p.daily->'login_streak', '0'::jsonb)) end $$;

create or replace function public.daily_sync() returns public.profiles
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; row_out public.profiles;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  update public.profiles set daily = public.fn_daily_today(cur) where user_id = auth.uid() returning * into row_out;
  return row_out;
end $$;

-- premio de una misión según su dificultad y el nivel del jugador
create or replace function public.fn_daily_reward(p_slot integer, p_level integer) returns jsonb language sql immutable as $$
  select case p_slot
    when 0 then jsonb_build_object('tomatoes', 15 + p_level, 'pesetas', 0)
    when 1 then jsonb_build_object('tomatoes', 0, 'pesetas', 40 + 4 * p_level)
    else jsonb_build_object('tomatoes', 30 + 2 * p_level, 'pesetas', 80 + 8 * p_level) end $$;

create or replace function public.claim_daily_mission(p_slot integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; row_out public.profiles; d jsonb; m jsonb; lvl integer; rw jsonb; prog bigint;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if p_slot is null or p_slot not between 0 and 2 then raise exception 'Esa misión no existe'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  d := public.fn_daily_today(cur);
  if (d->'done') ? p_slot::text then raise exception 'Ya has recogido esa misión'; end if;
  m := public.fn_daily_mission((d->>'date')::date, p_slot);
  prog := public.fn_daily_count(cur, m->>1) - coalesce((d->'base'->>(m->>1))::bigint, 0);
  if prog < (m->>2)::bigint then raise exception 'Todavía no has completado esa misión'; end if;
  lvl := least(50, public.fn_player_level(cur.tomatoes_thrown, cur.hits, cur.falls));
  rw := public.fn_daily_reward(p_slot, lvl);
  d := jsonb_set(d, '{done}', (d->'done') || to_jsonb(p_slot::text));
  update public.profiles set daily = d, chest_tomatoes = chest_tomatoes + (rw->>'tomatoes')::integer, chest_pesetas = chest_pesetas + (rw->>'pesetas')::integer, updated_at = now()
  where user_id = auth.uid() returning * into row_out;
  return jsonb_build_object('reward', rw, 'profile', to_jsonb(row_out));
end $$;

-- las 3 misiones hechas: «Cofre de la jornada» (cofre de diamante)
create or replace function public.claim_daily_bonus() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; row_out public.profiles; d jsonb; roll jsonb;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  d := public.fn_daily_today(cur);
  if jsonb_array_length(d->'done') < 3 then raise exception 'Te faltan misiones de hoy'; end if;
  if coalesce((d->>'bonus')::boolean, false) then raise exception 'Ya has recogido el cofre de hoy'; end if;
  roll := public.fn_roll_chest('diamond', cur.cards);
  update public.profiles set daily = jsonb_set(d, '{bonus}', 'true'), cards = roll->'cards', chest_tomatoes = chest_tomatoes + (roll->'reward'->>'tomatoes')::integer,
    chest_pesetas = chest_pesetas + (roll->'reward'->>'pesetas')::integer, chests_opened = chests_opened + 1, updated_at = now()
  where user_id = auth.uid() returning * into row_out;
  return jsonb_build_object('reward', roll->'reward', 'profile', to_jsonb(row_out));
end $$;

-- calendario de 7 días: un premio por entrar cada día; si fallas un día, vuelve al día 1
create or replace function public.claim_login_day() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; row_out public.profiles; d jsonb; today date := (now() at time zone 'Europe/Madrid')::date; last date; n integer; rw jsonb; roll jsonb;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  d := public.fn_daily_today(cur);
  last := nullif(d->>'login_date', '')::date;
  if last = today then raise exception 'Ya has recogido el premio de hoy'; end if;
  n := case when last = today - 1 then coalesce((d->>'login_streak')::integer, 0) % 7 + 1 else 1 end;
  rw := case n when 1 then '{"tomatoes": 20, "pesetas": 0}' when 2 then '{"tomatoes": 0, "pesetas": 50}' when 3 then '{"tomatoes": 40, "pesetas": 0}'
    when 5 then '{"tomatoes": 0, "pesetas": 120}' when 6 then '{"tomatoes": 80, "pesetas": 0}' else '{"tomatoes": 0, "pesetas": 0}' end::jsonb;
  if n = 7 then rw := '{"tomatoes": 0, "pesetas": 200}'::jsonb; end if;
  d := d || jsonb_build_object('login_date', today::text, 'login_streak', n);
  if n in (4, 7) then
    roll := public.fn_roll_chest(case n when 4 then 'wood' else 'diamond' end, cur.cards);
    rw := roll->'reward' || jsonb_build_object('pesetas', (roll->'reward'->>'pesetas')::integer + (rw->>'pesetas')::integer, 'chest', case n when 4 then 'wood' else 'diamond' end);
    update public.profiles set cards = roll->'cards', chests_opened = chests_opened + 1 where user_id = auth.uid();
  end if;
  update public.profiles set daily = d, chest_tomatoes = chest_tomatoes + (rw->>'tomatoes')::integer, chest_pesetas = chest_pesetas + (rw->>'pesetas')::integer, updated_at = now()
  where user_id = auth.uid() returning * into row_out;
  return jsonb_build_object('reward', rw || jsonb_build_object('day', n), 'profile', to_jsonb(row_out));
end $$;

revoke all on function public.daily_sync(), public.claim_daily_mission(integer), public.claim_daily_bonus(), public.claim_login_day() from public, anon;
grant execute on function public.daily_sync(), public.claim_daily_mission(integer), public.claim_daily_bonus(), public.claim_login_day() to authenticated;

-- ============================================================ Invitaciones
alter table public.profiles add column if not exists invite_code text;
create unique index if not exists profiles_invite_code on public.profiles (invite_code);
alter table public.profiles add column if not exists invites_paid integer not null default 0;     -- amigos que ya te han dado sus 700 pesetas
alter table public.profiles add column if not exists invites_seen integer not null default 0;     -- los que ya has visto celebrar
create table if not exists public.referrals (
  friend uuid primary key references auth.users(id) on delete cascade,
  inviter uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table public.referrals enable row level security;      -- nadie la lee ni la escribe desde el juego: solo estas funciones
revoke all on public.referrals from anon, authenticated;

-- tu código para invitar (se crea la primera vez)
create or replace function public.my_invite_code() returns text
language plpgsql security definer set search_path = public as $$
declare code text; tries integer := 0;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select invite_code into code from public.profiles where user_id = auth.uid();
  if code is not null then return code; end if;
  loop
    code := upper(substr(md5(random()::text || clock_timestamp()::text || auth.uid()::text), 1, 6));   -- sin extensiones (en Supabase pgcrypto va aparte)
    begin
      update public.profiles set invite_code = code where user_id = auth.uid() and invite_code is null;
      exit;
    exception when unique_violation then tries := tries + 1; if tries > 8 then raise; end if;
    end;
  end loop;
  return code;
end $$;

-- el amigo usa el código al registrarse: su regalo al momento (solo cuentas nuevas, una vez, no el tuyo)
create or replace function public.redeem_invite(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; inv public.profiles; row_out public.profiles;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  select * into inv from public.profiles where invite_code = upper(trim(coalesce(p_code, '')));
  if not found then raise exception 'Ese código de invitación no existe'; end if;
  if inv.user_id = cur.user_id then raise exception 'No puedes invitarte a ti mismo'; end if;
  if exists (select 1 from public.referrals where friend = cur.user_id) then raise exception 'Ya has usado una invitación'; end if;
  if cur.created_at < now() - interval '3 days' then raise exception 'Las invitaciones son solo para cuentas nuevas'; end if;
  insert into public.referrals (friend, inviter) values (cur.user_id, inv.user_id);
  update public.profiles set chest_pesetas = chest_pesetas + 300, chest_tomatoes = chest_tomatoes + 150, updated_at = now()
  where user_id = auth.uid() returning * into row_out;
  return jsonb_build_object('reward', jsonb_build_object('pesetas', 300, 'tomatoes', 150), 'inviter', inv.username, 'profile', to_jsonb(row_out));
end $$;

-- quien invita cobra 700 pesetas por cada amigo que ya ha jugado un poco (10 tomates tirados); máximo 50
create or replace function public.claim_invites() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; row_out public.profiles; n integer := 0; total integer; pending integer; r record;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  for r in select f.friend from public.referrals f join public.profiles p on p.user_id = f.friend
           where f.inviter = auth.uid() and f.paid_at is null and p.tomatoes_thrown >= 10 order by f.created_at for update of f loop
    exit when cur.invites_paid + n >= 50;
    update public.referrals set paid_at = now() where friend = r.friend;
    n := n + 1;
  end loop;
  select count(*) into total from public.referrals where inviter = auth.uid();
  select count(*) into pending from public.referrals where inviter = auth.uid() and paid_at is null;
  update public.profiles set invites_paid = invites_paid + n, chest_pesetas = chest_pesetas + 700 * n, updated_at = case when n > 0 then now() else updated_at end
  where user_id = auth.uid() returning * into row_out;
  return jsonb_build_object('paid', n, 'pesetas', 700 * n, 'total', total, 'pending', pending, 'profile', to_jsonb(row_out));
end $$;

create or replace function public.ack_invites() returns void language sql security definer set search_path = public as $$
  update public.profiles set invites_seen = invites_paid where user_id = auth.uid() $$;

revoke all on function public.my_invite_code(), public.redeem_invite(text), public.claim_invites(), public.ack_invites() from public, anon;
grant execute on function public.my_invite_code(), public.redeem_invite(text), public.claim_invites(), public.ack_invites() to authenticated;
