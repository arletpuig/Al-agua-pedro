-- AL AGUA PEDRO · versión 12 del esquema (ejecutar DESPUÉS de schema_v11.sql; o ejecuta schema_todo.sql, que lo incluye todo).
-- Nuevas rarezas de las cartas (igual que js/economy.js):
--  · Legendarias: Inflación y Joyas de Zapatero
--  · Épicas: Hacienda Inversa y Paguitas
--  · Poco común: Mariscada Sindical
--  · Comunes: Puerta Giratoria, Plus Ultra, Apagón y Amnistía
-- La rareza decide qué sale en cada cofre, cuántos fragmentos hacen falta para desbloquear y el precio de las mejoras.
-- Conserva los niveles y fragmentos que ya tenga cada jugador. Se puede ejecutar más de una vez.
create or replace function public.fn_rarity(p_id text) returns text language sql immutable as $$
  select case p_id
    when 'inflacion' then 'legendary' when 'joyas' then 'legendary'
    when 'hacienda' then 'epic' when 'paguitas' then 'epic'
    when 'mariscada' then 'rare'
    when 'puerta' then 'common' when 'plusultra' then 'common' when 'apagon' then 'common' when 'amnistia' then 'common' end $$;
create or replace function public.fn_rarity_cards(p_rarity text) returns text[] language sql immutable as $$
  select case p_rarity when 'common' then array['puerta', 'plusultra', 'apagon', 'amnistia'] when 'rare' then array['mariscada']
    when 'epic' then array['hacienda', 'paguitas'] else array['inflacion', 'joyas'] end $$;
