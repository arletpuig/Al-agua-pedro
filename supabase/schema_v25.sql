-- AL AGUA PEDRO · versión 25 del esquema (ejecutar DESPUÉS de schema_v24.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · La Armería: objetos para usar contra Pedro. Se compran con pesetas desde el nivel 10 y quedan en el inventario para siempre.
--    El servidor comprueba el nivel, el precio y que no lo tengas ya (no se puede comprar dos veces ni cobrar dos veces).
--  · Martillo de goma: regalo al instalar la app (va con el regalo de la app, una sola vez por cuenta).
--    Quien ya recogió el regalo de la app lo recibe ahora.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

alter table public.profiles add column if not exists armory jsonb not null default '[]'::jsonb;

-- precio de cada objeto (igual que ARMORY en js/armory.js); null = no se vende
create or replace function public.fn_armory_price(p text) returns integer language sql immutable as $$
  select case p
    when 'slipper' then 60000 when 'goose' then 125000 when 'bull' then 250000
    when 'vacuum' then 400000 when 'press' then 650000 when 'stamp' then 1000000
  end $$;

create or replace function public.buy_armory_item(p_item text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; row_out public.profiles; price integer := public.fn_armory_price(p_item);
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  if price is null then raise exception 'Ese objeto no se vende'; end if;
  if public.fn_player_level(cur.tomatoes_thrown, cur.hits, cur.falls) < 10 then raise exception 'La Armería se desbloquea en el nivel 10'; end if;
  if cur.armory ? p_item then raise exception 'Ya tienes ese objeto'; end if;
  if cur.pesetas < price then raise exception 'No tienes pesetas suficientes'; end if;
  update public.profiles set pesetas_spent = pesetas_spent + price, armory = armory || to_jsonb(p_item), updated_at = now()
  where user_id = auth.uid() returning * into row_out;
  return row_out;
end $$;
revoke all on function public.buy_armory_item(text) from public, anon;
grant execute on function public.buy_armory_item(text) to authenticated;

-- regalo de la app: cofre de diamante + 150 pesetas + el martillo de goma
create or replace function public.claim_install_reward() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; row_out public.profiles; roll jsonb; rw jsonb;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  if cur.install_claimed then raise exception 'Ya has recogido el regalo de la app'; end if;
  roll := public.fn_roll_chest('diamond', cur.cards);
  rw := jsonb_set(roll->'reward', '{pesetas}', to_jsonb(coalesce((roll->'reward'->>'pesetas')::integer, 0) + 150));
  rw := rw || jsonb_build_object('item', 'hammer');
  update public.profiles set cards = roll->'cards', chest_tomatoes = chest_tomatoes + coalesce((rw->>'tomatoes')::integer, 0),
    chest_pesetas = chest_pesetas + (rw->>'pesetas')::integer, chests_opened = chests_opened + 1, install_claimed = true,
    armory = case when armory ? 'hammer' then armory else armory || '["hammer"]'::jsonb end, updated_at = now()
  where user_id = auth.uid() returning * into row_out;
  return jsonb_build_object('reward', rw, 'profile', to_jsonb(row_out));
end $$;
revoke all on function public.claim_install_reward() from public, anon;
grant execute on function public.claim_install_reward() to authenticated;

-- quien ya instaló la app y recogió su regalo: también recibe el martillo
update public.profiles set armory = armory || '["hammer"]'::jsonb where install_claimed and not (armory ? 'hammer');
