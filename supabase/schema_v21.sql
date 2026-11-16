-- AL AGUA PEDRO · versión 21 del esquema (ejecutar DESPUÉS de schema_v20.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · Los niveles altos cuestan bastante más: del nivel 10 en adelante, subir del k al k+1 cuesta 12,6·k^2,4 XP.
--    Llegar al 50 pasa de unos 819.000 XP a unos 2,1 millones. Los niveles 1 a 10 no cambian. Igual que XP_AT en js/levels.js.
--  · Quien baje de nivel no pierde nada y vuelve a tener ruleta al subir el siguiente nivel.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

create or replace function public.fn_level_of_xp(p_xp bigint) returns integer language sql immutable as $$
  select 1 + count(*)::integer from unnest(array[300, 800, 1500, 2400, 3500, 4800, 6400, 8300, 10560, 13720, 17700, 22600, 28540, 35640, 44020, 53800, 65110, 78080, 92850, 109550, 128330, 149330, 172690, 198560, 227100, 258450, 292780, 330240, 370990, 415190, 463010, 514620, 570190, 629880, 693870, 762340, 835460, 913420, 996390, 1084560, 1178110, 1277230, 1382110, 1492940, 1609910, 1733220, 1863060, 1999630, 2143130]::bigint[]) t where p_xp >= t $$;

-- quien queda en un nivel más bajo que su última ruleta: la siguiente subida vuelve a dar ruleta
update public.profiles set wheel_level = greatest(1, public.fn_player_level(tomatoes_thrown, hits, falls))
where wheel_level > public.fn_player_level(tomatoes_thrown, hits, falls);
