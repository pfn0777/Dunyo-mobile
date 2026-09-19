-- Dunyo Mobile: core schema (enums, tables, indexes, updated_at triggers).
-- See docs/specs/dunyo-miniapp-v1.md "DB (jadvallar)" for the source of truth.
--
-- There is NO row level security in this project. Unlike XUMO MARKET (Supabase,
-- browser talks to PostgREST with anon/authenticated roles + RLS policies),
-- Dunyo Mobile is self-hosted: the Fastify API is the only Postgres client,
-- the browser never connects to the database directly, and there are no
-- anon/authenticated/service_role roles here at all. Access control lives in
-- the API layer (initData auth, admin_users check on every admin request).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.order_status as enum ('new', 'confirmed', 'shipped', 'on_the_way', 'delivered', 'cancelled');
create type public.delivery_type as enum ('delivery', 'pickup');
create type public.payment_method as enum ('cash', 'card_to_courier', 'installment_request');
create type public.payment_status as enum ('unpaid', 'paid', 'refunded');
create type public.admin_role as enum ('owner', 'admin');

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
-- search_path is hardened to '' (empty) from the start, unlike XUMO where
-- this was a later security-advisor fix. The body only ever touches `new`
-- (the implicit trigger row variable), so it needs no schema-qualified
-- lookups and is safe to run with an empty search_path.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.brands (
  id bigserial primary key,
  name text not null unique,
  logo_path text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id bigserial primary key,
  name text not null unique,
  icon text,
  image_path text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.regions (
  id bigserial primary key,
  name text not null unique,
  delivery_fee int not null default 0 check (delivery_fee >= 0),
  eta_text text,
  -- null means "fall back to settings.free_delivery_threshold" (the global).
  free_delivery_threshold int check (free_delivery_threshold is null or free_delivery_threshold >= 0),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users (
  id bigint primary key,
  first_name text not null,
  last_name text,
  username text,
  phone text,
  phone_verified boolean not null default false,
  channel_subscribed boolean not null default false,
  channel_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id bigserial primary key,
  user_id bigint not null references public.users (id) on delete cascade,
  region_id bigint references public.regions (id) on delete set null,
  label text,
  text text not null,
  lat numeric,
  lng numeric,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No price/stock columns here on purpose: phones come in color/storage SKUs,
-- so price and stock live on product_variants, never on the product row.
create table public.products (
  id bigserial primary key,
  name text not null,
  brand_id bigint not null references public.brands (id),
  category_id bigint not null references public.categories (id),
  description text,
  warranty_months int not null default 12 check (warranty_months >= 0),
  specs jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sold_count int not null default 0 check (sold_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, brand_id)
);

create table public.product_variants (
  id bigserial primary key,
  product_id bigint not null references public.products (id) on delete cascade,
  sku text unique,
  color_name text not null,
  color_hex text,
  storage_gb int check (storage_gb is null or storage_gb > 0),
  price bigint not null check (price > 0),
  old_price bigint check (old_price is null or old_price > price),
  stock int not null default 0 check (stock >= 0),
  image_thumb_path text,
  image_path text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, color_name, storage_gb)
);

-- `unique (product_id, color_name, storage_gb)` above does NOT catch
-- duplicate colors for accessories (storage_gb is null on every row, and
-- Postgres treats NULLs as distinct in a unique constraint), so a second
-- partial unique index covers that case explicitly.
create unique index uq_variants_product_color_nostorage
  on public.product_variants (product_id, color_name)
  where storage_gb is null;

create table public.favorites (
  user_id bigint not null references public.users (id) on delete cascade,
  product_id bigint not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.banners (
  id bigserial primary key,
  image_path text not null,
  title text,
  subtitle text,
  link_type text,
  link_id bigint,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence public.orders_order_no_seq;

create table public.orders (
  id bigserial primary key,
  order_no text not null unique
    default ('DM-' || lpad(nextval('public.orders_order_no_seq')::text, 6, '0')),
  user_id bigint not null references public.users (id),
  status public.order_status not null default 'new',
  delivery_type public.delivery_type not null,
  -- null for pickup orders (no delivery region involved).
  region_id bigint references public.regions (id) on delete set null,
  address_text text,
  lat numeric,
  lng numeric,
  customer_name text not null,
  customer_phone text not null,
  comment text,
  tracking_note text,
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'unpaid',
  installment_months int,
  -- Money columns are bigint: phones cost tens of millions of so'm, and
  -- bigint is the safer choice even though int would technically fit today.
  items_total bigint not null default 0 check (items_total >= 0),
  discount_total bigint not null default 0 check (discount_total >= 0),
  delivery_fee bigint not null default 0 check (delivery_fee >= 0),
  grand_total bigint not null default 0 check (grand_total >= 0),
  idempotency_key uuid not null unique,
  group_chat_id bigint,
  group_message_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id bigserial primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  -- Nullable and ON DELETE SET NULL: if a variant/product is later
  -- hard-deleted, order history survives via the *_snapshot columns below
  -- instead of being cascade-destroyed.
  variant_id bigint references public.product_variants (id) on delete set null,
  product_id bigint references public.products (id) on delete set null,
  name_snapshot text not null,
  color_snapshot text,
  storage_snapshot int,
  price_snapshot bigint not null check (price_snapshot > 0),
  old_price_snapshot bigint,
  warranty_snapshot int,
  qty int not null check (qty > 0),
  created_at timestamptz not null default now()
);

create table public.order_status_history (
  id bigserial primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by bigint,
  created_at timestamptz not null default now()
);

-- Singleton settings row (id is always 1).
create table public.settings (
  id smallint primary key default 1 check (id = 1),
  min_order_amount bigint not null default 0 check (min_order_amount >= 0),
  -- Global free-delivery threshold; regions may override it (see
  -- regions.free_delivery_threshold). Never seed this as 0 -- see the
  -- warning in 0004_seed.sql.
  free_delivery_threshold bigint not null default 0 check (free_delivery_threshold >= 0),
  delivery_enabled boolean not null default true,
  shop_group_chat_id bigint,
  pickup_address text,
  required_channel text,
  installment_months int not null default 12 check (installment_months > 0),
  support_username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_users (
  telegram_id bigint primary key,
  role public.admin_role not null default 'admin',
  added_by bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigserial primary key,
  admin_id bigint,
  action text not null,
  entity text not null,
  entity_id bigint,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index idx_products_category_active on public.products (category_id, is_active);
create index idx_orders_user_created on public.orders (user_id, created_at desc);
create index idx_orders_status_created on public.orders (status, created_at desc);
create index idx_audit_log_created on public.audit_log (created_at);

create index idx_variants_product_active on public.product_variants (product_id, is_active);
create index idx_products_brand_active on public.products (brand_id, is_active);
create index idx_orders_region_created on public.orders (region_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger trg_brands_updated_at before update on public.brands
  for each row execute function public.set_updated_at();
create trigger trg_categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger trg_regions_updated_at before update on public.regions
  for each row execute function public.set_updated_at();
create trigger trg_users_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger trg_addresses_updated_at before update on public.addresses
  for each row execute function public.set_updated_at();
create trigger trg_products_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger trg_product_variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();
create trigger trg_banners_updated_at before update on public.banners
  for each row execute function public.set_updated_at();
create trigger trg_orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger trg_settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();
create trigger trg_admin_users_updated_at before update on public.admin_users
  for each row execute function public.set_updated_at();
