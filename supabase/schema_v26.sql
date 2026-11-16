-- AL AGUA PEDRO · versión 26 del esquema (ejecutar DESPUÉS de schema_v25.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · Niveles altos más asequibles: hasta el nivel 10 no cambia; del 10 en adelante, subir del k al k+1 cuesta 5.750·(k/9)^1,7 XP
--    (en el nivel 30, unos 44.500 XP por nivel en vez de 84.000). Llegar al 50: unos 1,9 millones. Igual que XP_AT en js/levels.js.
--  · La Armería, más barata: chancla 40.000, oca 80.000, toro 150.000, aspiradora 250.000, prensa 400.000 y sello 650.000.
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

create or replace function public.fn_level_of_xp(p_xp bigint) returns integer language sql immutable as $$
  select 1 + count(*)::integer from unnest(array[600, 1900, 3600, 5850, 8700, 12200, 16450, 21450, 27200, 34080, 42170, 51550, 62290, 74480, 88180, 103470, 120420, 139100, 159580, 181930, 206210, 232490, 260830, 291300, 323960, 358870, 396090, 435680, 477710, 522230, 569300, 618980, 671330, 726410, 784270, 844970, 908560, 975100, 1044640, 1117240, 1192960, 1271840, 1353940, 1439310, 1528010, 1620090, 1715590, 1814570, 1917090]::bigint[]) t where p_xp >= t $$;

create or replace function public.fn_armory_price(p text) returns integer language sql immutable as $$
  select case p
    when 'slipper' then 40000 when 'goose' then 80000 when 'bull' then 150000
    when 'vacuum' then 250000 when 'press' then 400000 when 'stamp' then 650000
  end $$;
