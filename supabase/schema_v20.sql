-- AL AGUA PEDRO · versión 20 del esquema (ejecutar DESPUÉS de schema_v19.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · El Falcón (×5 clics) dura 2 minutos: el de la tienda (vídeo) y el de las ruletas (normal y legendaria).
--  · Paguitas: cada nivel de la carta suma 3 pesetas por lluvia (nivel 1: 3; nivel 2: 6; nivel 3: 9... nivel 15: 45),
--    es decir, cada una de las 3 monedas vale el nivel de la carta. Igual que js/economy.js.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

create or replace function public.fn_paguitas_total(p_level integer) returns integer language sql immutable as $$
  select 3 * least(greatest(p_level, 1), 15) $$;
create or replace function public.fn_paguitas_value(p_level integer) returns integer language sql immutable as $$
  select least(greatest(p_level, 1), 15) $$;

create or replace function public.claim_ad_reward(p_placement text, p_token text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; today text := ((now() at time zone 'Europe/Madrid')::date)::text; claims jsonb; n integer; lim integer; row_out public.profiles;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if coalesce((select value from public.aap_config where key = 'rewarded_ads'), 'false') <> 'true' then raise exception 'Los anuncios todavía no están disponibles'; end if;
  if p_placement not in ('falcon', 'sobre', 'ruleta') then raise exception 'Esa oferta no existe'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'El perfil no existe'; end if;
  claims := case when cur.ad_claims->>'day' = today then cur.ad_claims else jsonb_build_object('day', today) end;
  n := coalesce((claims->>p_placement)::integer, 0);
  lim := case p_placement when 'sobre' then 10 when 'ruleta' then 3 else 6 end;
  if n >= lim then raise exception 'Ya has visto todos los vídeos de hoy para esta oferta. Vuelve mañana'; end if;
  claims := jsonb_set(claims, array[p_placement], to_jsonb(n + 1));
  if p_placement = 'falcon' then
    if cur.falcon_until is not null and cur.falcon_until > now() then raise exception 'El Falcón ya está en marcha'; end if;
    update public.profiles set falcon_until = now() + interval '2 minutes', ad_claims = claims where user_id = auth.uid() returning * into row_out;
  elsif p_placement = 'ruleta' then
    update public.profiles set legend_ads = case when legend_ads + 1 >= 3 then 0 else legend_ads + 1 end,
      legend_spins = legend_spins + case when legend_ads + 1 >= 3 then 1 else 0 end, ad_claims = claims, updated_at = now()
    where user_id = auth.uid() returning * into row_out;
  else
    update public.profiles set chest_pesetas = chest_pesetas + 25, ad_claims = claims, updated_at = now() where user_id = auth.uid() returning * into row_out;
  end if;
  return row_out;
end $$;
revoke all on function public.claim_ad_reward(text, text) from public, anon;
grant execute on function public.claim_ad_reward(text, text) to authenticated;

create or replace function public.fn_wheel_roll(p_kind text, p_level integer, p_cards jsonb) returns jsonb language plpgsql volatile as $$
declare
  ids text[]; weights integer[]; r numeric; acc integer := 0; idx integer := 0; seg text; L integer := greatest(1, p_level); i integer;
  pes integer := 0; tom integer := 0; won jsonb := '[]'::jsonb; cards jsonb := p_cards; chest text := null; times integer := 1; mins integer := 0; roll jsonb;
begin
  if p_kind = 'legend' then
    ids := array['l_pes', 'l_tom', 'l_dia', 'l_x5', 'l_top', 'l_pesx', 'l_tomx', 'l_bote']; weights := array[22, 20, 14, 12, 10, 10, 8, 4];
  else
    ids := array['pes_s', 'tom_s', 'card', 'x5', 'pes_m', 'tom_l', 'cards3', 'jackpot']; weights := array[22, 20, 14, 10, 12, 10, 8, 4];
  end if;
  r := random() * 100;
  for i in 1 .. 8 loop acc := acc + weights[i]; if r < acc then idx := i; exit; end if; end loop;
  if idx = 0 then idx := 8; end if;
  seg := ids[idx];
  case seg
    when 'pes_s' then pes := 10 + 2 * L;      when 'tom_s' then tom := 8 + 2 * L;
    when 'pes_m' then pes := 30 + 5 * L;      when 'tom_l' then tom := 20 + 6 * L;
    when 'jackpot' then pes := 100 + 20 * L;  when 'x5' then mins := 2;
    when 'card' then chest := 'wood';         when 'cards3' then chest := 'diamond';
    when 'l_pes' then pes := 300 + 10 * L;    when 'l_tom' then tom := 250 + 10 * L;
    when 'l_pesx' then pes := 800 + 20 * L;   when 'l_tomx' then tom := 800 + 20 * L;
    when 'l_bote' then pes := 2500 + 50 * L;  when 'l_x5' then mins := 2;
    when 'l_dia' then chest := 'diamond'; times := 2;
    when 'l_top' then chest := 'premium';
  end case;
  if chest is not null then
    for i in 1 .. times loop
      roll := public.fn_roll_chest(chest, cards);
      cards := roll->'cards'; won := won || (roll->'reward'->'cards');
      pes := pes + coalesce((roll->'reward'->>'pesetas')::integer, 0); tom := tom + coalesce((roll->'reward'->>'tomatoes')::integer, 0);
    end loop;
  end if;
  return jsonb_build_object('seg', idx - 1, 'id', seg, 'chest', chest, 'pesetas', pes, 'tomatoes', tom, 'won', won, 'cards', cards, 'minutes', mins);
end $$;
revoke all on function public.fn_wheel_roll(text, integer, jsonb) from public, anon, authenticated;
