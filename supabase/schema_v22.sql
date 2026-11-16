-- AL AGUA PEDRO · versión 22 del esquema (ejecutar DESPUÉS de schema_v21.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · Regalo por instalar la app (al abrir el juego desde el icono de la pantalla de inicio): cofre de diamante + 150 pesetas,
--    una sola vez por cuenta.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

alter table public.profiles add column if not exists install_claimed boolean not null default false;

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
  update public.profiles set cards = roll->'cards', chest_tomatoes = chest_tomatoes + coalesce((rw->>'tomatoes')::integer, 0),
    chest_pesetas = chest_pesetas + (rw->>'pesetas')::integer, chests_opened = chests_opened + 1, install_claimed = true, updated_at = now()
  where user_id = auth.uid() returning * into row_out;
  return jsonb_build_object('reward', rw, 'profile', to_jsonb(row_out));
end $$;
revoke all on function public.claim_install_reward() from public, anon;
grant execute on function public.claim_install_reward() to authenticated;
