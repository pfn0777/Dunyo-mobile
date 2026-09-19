-- Trigram index for product name search (ILIKE / similarity search).
-- pg_trgm is a normal contrib extension (not Supabase-specific); kept in its
-- own file so an environment without it (e.g. a PGlite test run without the
-- contrib module loaded) can skip just this file.
create extension if not exists pg_trgm;

create index idx_products_name_trgm on public.products using gin (name gin_trgm_ops);
