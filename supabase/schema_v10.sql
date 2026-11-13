-- AL AGUA PEDRO · versión 10 del esquema (ejecutar DESPUÉS de schema_v9.sql; o ejecuta schema_todo.sql, que lo incluye todo).
-- Vídeos recompensados de la tienda:
--  · Sobre de la Moncloa: 25 pesetas por vídeo, como mucho 10 al día.
--  · El Falcón: clics ×5 durante 10 minutos, como mucho 6 al día y solo si no está ya en marcha.
-- Los anuncios web no permiten comprobar en el servidor que el vídeo se ha visto entero, por eso hay límites diarios.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

alter table public.profiles add column if not exists ad_claims jsonb not null default '{}'::jsonb;

-- Interruptor: los vídeos recompensados están APAGADOS hasta que Google apruebe los anuncios.
-- Para encenderlos:  update public.aap_config set value = 'true' where key = 'rewarded_ads';
create table if not exists public.aap_config (key text primary key, value text not null);
revoke all on public.aap_config from public, anon, authenticated;
insert into public.aap_config (key, value) values ('rewarded_ads', 'false') on conflict (key) do nothing;

create or replace function public.claim_ad_reward(p_placement text, p_token text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; today text := ((now() at time zone 'Europe/Madrid')::date)::text; claims jsonb; n integer; lim integer; row_out public.profiles;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if coalesce((select value from public.aap_config where key = 'rewarded_ads'), 'false') <> 'true' then raise exception 'Los anuncios todavía no están disponibles'; end if;
  if p_placement not in ('falcon', 'sobre') then raise exception 'Esa oferta no existe'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  claims := case when cur.ad_claims->>'day' = today then cur.ad_claims else jsonb_build_object('day', today) end;
  n := coalesce((claims->>p_placement)::integer, 0);
  lim := case p_placement when 'sobre' then 10 else 6 end;
  if n >= lim then raise exception 'Ya has visto todos los vídeos de hoy para esta oferta. Vuelve mañana'; end if;
  claims := jsonb_set(claims, array[p_placement], to_jsonb(n + 1));
  if p_placement = 'falcon' then
    if cur.falcon_until is not null and cur.falcon_until > now() then raise exception 'El Falcón ya está en marcha'; end if;
    update public.profiles set falcon_until = now() + interval '10 minutes', ad_claims = claims where user_id = auth.uid() returning * into row_out;
  else
    update public.profiles set chest_pesetas = chest_pesetas + 25, ad_claims = claims, updated_at = now() where user_id = auth.uid() returning * into row_out;
  end if;
  return row_out;
end $$;
revoke all on function public.claim_ad_reward(text, text) from public, anon;
grant execute on function public.claim_ad_reward(text, text) to authenticated;
