-- AL AGUA PEDRO · v3: La Trastienda (objetos permanentes de Abascal)
-- Ejecutar después de schema_v2.sql. Los precios deben coincidir con js/shop.js.

alter table public.profiles add column if not exists shop_items jsonb not null default '[]'::jsonb;

create or replace function public.fn_shop_price(p_item text) returns integer language sql immutable as $$
  select case p_item when 'besugo' then 120 when 'chancla' then 200 when 'pollo' then 320 when 'tarta' then 480 when 'cubo' then 700 else null end $$;

-- Compra con pesetas. La Moción de Censura (pago con dinero real) no se vende por aquí.
create or replace function public.buy_shop_item(p_item text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare cur public.profiles; price integer; row_out public.profiles;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_item = 'mocion' then raise exception 'Los pagos llegarán próximamente'; end if;
  price := public.fn_shop_price(p_item);
  if price is null then raise exception 'Ese objeto no existe'; end if;
  select * into cur from public.profiles where user_id = auth.uid() for update;
  if cur.falls < 300 then raise exception 'La trastienda todavía está cerrada para ti'; end if;
  if cur.shop_items ? p_item then raise exception 'Ya tienes este objeto'; end if;
  if cur.pesetas < price then raise exception 'No tienes pesetas suficientes'; end if;
  update public.profiles set shop_items = shop_items || to_jsonb(p_item), pesetas_spent = pesetas_spent + price, updated_at = now()
    where user_id = auth.uid() returning * into row_out;
  return row_out;
end $$;

grant execute on function public.buy_shop_item(text) to authenticated;
revoke execute on function public.buy_shop_item(text) from anon;
