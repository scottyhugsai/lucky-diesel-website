-- Merchant listing details for product structured data.
--
-- Google has invested in merchant listings through 2025–26 (shipping policy
-- Nov 2025, sale-price encoding Feb 2025, category Jul 2025) while retiring FAQ
-- and HowTo — so this is where the remaining rich-result surface is.
--
-- Every column is nullable and nothing is emitted until the owner fills it in.
-- Shipping and returns are business facts; inventing them to satisfy a schema
-- validator would be worse than having no markup at all.

alter table shop_settings
  add column if not exists ships_products boolean not null default false,
  add column if not exists shipping_flat_cents int check (shipping_flat_cents is null or shipping_flat_cents >= 0),
  add column if not exists shipping_free_over_cents int check (shipping_free_over_cents is null or shipping_free_over_cents >= 0),
  add column if not exists shipping_handling_days int check (shipping_handling_days is null or shipping_handling_days between 0 and 30),
  add column if not exists shipping_transit_days int check (shipping_transit_days is null or shipping_transit_days between 0 and 60),
  add column if not exists returns_days int check (returns_days is null or returns_days between 0 and 365),
  add column if not exists returns_url text check (returns_url is null or length(returns_url) <= 400);

comment on column shop_settings.ships_products is
  'Owner confirms the store ships parts. Until this is true no shipping or return markup is emitted.';
