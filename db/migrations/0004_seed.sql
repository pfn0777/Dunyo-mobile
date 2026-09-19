-- Default settings row, delivery regions, catalog categories and brands.
-- Idempotent: safe to re-run (on conflict do nothing on every insert).
-- No products/variants are seeded here -- those come from the admin panel
-- or the Excel import, never from a migration.

-- WARNING: never seed free_delivery_threshold as 0. calcTotals treats
-- `items_total >= threshold` as "free delivery", so a threshold of 0 would
-- make delivery free on every order, always. 10 000 000 so'm is the real
-- starting threshold.
insert into public.settings (
  id, min_order_amount, free_delivery_threshold, delivery_enabled,
  installment_months, required_channel
) values (
  1, 0, 10000000, true,
  12, null
)
on conflict (id) do nothing;

insert into public.regions (name, delivery_fee, eta_text, sort_order) values
  ('Toshkent shahri', 0, '3 soat ichida', 1),
  ('Toshkent viloyati', 25000, '1-2 kun', 2),
  ('Andijon', 35000, '1-3 kun', 3),
  ('Buxoro', 35000, '1-3 kun', 4),
  ('Farg''ona', 35000, '1-3 kun', 5),
  ('Jizzax', 35000, '1-3 kun', 6),
  ('Xorazm', 35000, '1-3 kun', 7),
  ('Namangan', 35000, '1-3 kun', 8),
  ('Navoiy', 35000, '1-3 kun', 9),
  ('Qashqadaryo', 35000, '1-3 kun', 10),
  ('Qoraqalpog''iston Respublikasi', 35000, '1-3 kun', 11),
  ('Samarqand', 35000, '1-3 kun', 12),
  ('Sirdaryo', 35000, '1-3 kun', 13),
  ('Surxondaryo', 35000, '1-3 kun', 14)
on conflict (name) do nothing;

insert into public.categories (name, icon, sort_order) values
  ('Smartfonlar', 'smartphone', 1),
  ('Planshetlar', 'tablet_mac', 2),
  ('Smart soatlar', 'watch', 3),
  ('Audiotexnika', 'headphones', 4),
  ('Aksessuarlar', 'cable', 5)
on conflict (name) do nothing;

insert into public.brands (name, sort_order) values
  ('Apple', 1),
  ('Samsung', 2),
  ('Xiaomi', 3),
  ('Honor', 4),
  ('Realme', 5),
  ('Infinix', 6),
  ('Anker', 7),
  ('Baseus', 8)
on conflict (name) do nothing;
