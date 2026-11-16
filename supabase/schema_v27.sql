-- AL AGUA PEDRO · versión 27 del esquema (ejecutar DESPUÉS de schema_v26.sql; o ejecuta schema_todo.sql, que lo incluye todo).
--  · Paguitas ×3: cada moneda vale 3 × el nivel de la carta (nivel 1: 9 pesetas por lluvia; nivel 15: 135).
--  · Columna «rules»: le dice al juego qué reglas tiene ya el servidor (así no da paguitas que el servidor no admitiría).
-- Conserva todos los jugadores y su progreso. Se puede ejecutar más de una vez.

create or replace function public.fn_paguitas_value(p_level integer) returns integer language sql immutable as $$
  select 3 * least(greatest(p_level, 1), 15) $$;

alter table public.profiles add column if not exists rules smallint not null default 27;
update public.profiles set rules = 27 where rules < 27;
