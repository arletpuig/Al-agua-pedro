-- AL AGUA PEDRO · versión 18 del esquema (ejecutar DESPUÉS de schema_v17.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · Los primeros niveles cuestan algo más (nivel 2: 300 XP; 3: 800; 4: 1.500; 5: 2.400; 6: 3.500; 7: 4.800; 8: 6.400; 9: 8.300).
--    Del nivel 10 en adelante no cambia nada. Igual que XP_AT en js/levels.js.
--  · La ruleta normal da algo menos de tomates (8 + 2 por nivel y 20 + 6 por nivel), para que no encadene niveles al empezar.
-- Las tiradas ya giradas no se pierden. Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

create or replace function public.fn_level_of_xp(p_xp bigint) returns integer language sql immutable as $$
  select 1 + count(*)::integer from unnest(array[300, 800, 1500, 2400, 3500, 4800, 6400, 8300, 10560, 13720, 17410, 21660, 26510, 31990, 38120, 44940, 52470, 60750,
    69800, 79640, 90310, 101820, 114210, 127500, 141710, 156870, 173000, 190130, 208280, 227470, 247720, 269060, 291510, 315090, 339830, 365740, 392850, 421180,
    450750, 481580, 513690, 547100, 581830, 617900, 655330, 694140, 734350, 775990, 819060]::bigint[]) t where p_xp >= t $$;
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
    when 'jackpot' then pes := 100 + 20 * L;  when 'x5' then mins := 10;
    when 'card' then chest := 'wood';         when 'cards3' then chest := 'diamond';
    when 'l_pes' then pes := 300 + 10 * L;    when 'l_tom' then tom := 250 + 10 * L;
    when 'l_pesx' then pes := 800 + 20 * L;   when 'l_tomx' then tom := 800 + 20 * L;
    when 'l_bote' then pes := 2500 + 50 * L;  when 'l_x5' then mins := 30;
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
