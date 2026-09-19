-- Order RPCs.
--
-- Unlike XUMO MARKET, these functions are plain (invoker-rights) functions,
-- NOT `security definer`. XUMO needed security definer so that anon/
-- authenticated (which cannot write to orders/products directly under RLS)
-- could still call into it via service_role. Dunyo Mobile has no RLS and no
-- anon/authenticated roles at all -- the Fastify API connects as a single
-- role that already owns full read/write access to every table, so there is
-- nothing for security definer to buy us here.
--
-- create_order mirrors shared/src/pricing.ts calcTotals exactly:
--   items_total    = sum(price * qty)
--   discount_total = sum((old_price - price) * qty)                 -- informational only
--   threshold      = region.free_delivery_threshold ?? settings.free_delivery_threshold
--   delivery_fee   = pickup ? 0 : (items_total >= threshold ? 0 : region.delivery_fee)
--   grand_total    = items_total + delivery_fee
--
-- set_order_status mirrors shared/src/orderStatus.ts canTransition exactly.

create function public.create_order(p_user_id bigint, p_payload jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  c_max_items constant int := 100;
  c_max_qty constant int := 999;

  v_idempotency_key uuid;
  v_delivery_type public.delivery_type;
  v_payment_method public.payment_method;
  v_region_id bigint;
  v_address_text text;
  v_lat numeric;
  v_lng numeric;
  v_customer_name text;
  v_customer_phone text;
  v_comment text;

  v_existing_id bigint;
  v_existing_order_no text;
  v_existing_user_id bigint;

  v_items jsonb;
  v_item_count int;
  v_distinct_count int;

  v_settings record;
  v_region record;
  v_region_delivery_fee bigint := 0;
  v_region_free_threshold bigint;
  v_threshold bigint;

  v_stock_changed jsonb := '[]'::jsonb;
  v_price_changed jsonb := '[]'::jsonb;

  v_items_total bigint := 0;
  v_discount_total bigint := 0;
  v_delivery_fee bigint := 0;
  v_grand_total bigint := 0;
  v_installment_months int;

  v_order_id bigint;
  v_order_no text;

  r record;
  v_item record;
begin
  -- ---- (a) idempotency short-circuit, before any lock ----
  if not (p_payload ? 'idempotency_key') or p_payload->>'idempotency_key' is null then
    raise exception 'create_order: idempotency_key is required' using errcode = '22023';
  end if;
  v_idempotency_key := (p_payload->>'idempotency_key')::uuid;

  select id, order_no, user_id into v_existing_id, v_existing_order_no, v_existing_user_id
  from public.orders
  where idempotency_key = v_idempotency_key;

  if found then
    if v_existing_user_id <> p_user_id then
      raise exception 'create_order: idempotency_key belongs to another user' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'ok', true,
      'order_id', v_existing_id,
      'order_no', v_existing_order_no,
      'duplicate', true
    );
  end if;

  -- ---- (b) validate payload, before any row lock ----
  v_items := coalesce(p_payload->'items', '[]'::jsonb);
  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'create_order: items must be an array' using errcode = '22023';
  end if;

  v_item_count := jsonb_array_length(v_items);
  if v_item_count = 0 then
    raise exception 'create_order: items must not be empty' using errcode = '22023';
  end if;
  if v_item_count > c_max_items then
    raise exception 'create_order: too many item lines (max %)', c_max_items using errcode = '22023';
  end if;

  select count(distinct (elem->>'variant_id'))
  into v_distinct_count
  from jsonb_array_elements(v_items) elem;
  if v_distinct_count <> v_item_count then
    raise exception 'create_order: duplicate variant_id in items' using errcode = '22023';
  end if;

  for r in select elem from jsonb_array_elements(v_items) elem loop
    if not (r.elem ? 'variant_id') or not (r.elem ? 'qty') or not (r.elem ? 'expected_price') then
      raise exception 'create_order: item missing variant_id/qty/expected_price' using errcode = '22023';
    end if;
    if (r.elem->>'variant_id') !~ '^[0-9]+$' then
      raise exception 'create_order: variant_id must be a non-negative integer' using errcode = '22023';
    end if;
    if (r.elem->>'qty') !~ '^[0-9]+$'
       or (r.elem->>'qty')::int < 1
       or (r.elem->>'qty')::int > c_max_qty then
      raise exception 'create_order: qty must be a positive integer up to %', c_max_qty using errcode = '22023';
    end if;
    -- expected_price is required: the client must echo back the price it
    -- showed the customer so a silent price increase can never go through.
    if (r.elem->>'expected_price') !~ '^[0-9]+$' then
      raise exception 'create_order: expected_price must be a non-negative integer' using errcode = '22023';
    end if;
  end loop;

  begin
    v_delivery_type := (p_payload->>'delivery_type')::public.delivery_type;
  exception when invalid_text_representation then
    raise exception 'create_order: invalid delivery_type' using errcode = '22023';
  end;

  begin
    v_payment_method := (p_payload->>'payment_method')::public.payment_method;
  exception when invalid_text_representation then
    raise exception 'create_order: invalid payment_method' using errcode = '22023';
  end;

  v_customer_name := nullif(trim(p_payload->>'customer_name'), '');
  if v_customer_name is null then
    raise exception 'create_order: customer_name is required' using errcode = '22023';
  end if;

  v_customer_phone := p_payload->>'customer_phone';
  if v_customer_phone is null or v_customer_phone !~ '^\+998\d{9}$' then
    raise exception 'create_order: invalid customer_phone' using errcode = '22023';
  end if;

  v_address_text := nullif(trim(p_payload->>'address_text'), '');
  if v_delivery_type = 'delivery' and v_address_text is null then
    raise exception 'create_order: address_text is required for delivery' using errcode = '22023';
  end if;

  v_lat := case when p_payload ? 'lat' and p_payload->>'lat' is not null then (p_payload->>'lat')::numeric else null end;
  v_lng := case when p_payload ? 'lng' and p_payload->>'lng' is not null then (p_payload->>'lng')::numeric else null end;
  v_comment := nullif(p_payload->>'comment', '');

  if v_lat is not null and (v_lat < -90 or v_lat > 90) then
    raise exception 'create_order: lat out of range' using errcode = '22023';
  end if;
  if v_lng is not null and (v_lng < -180 or v_lng > 180) then
    raise exception 'create_order: lng out of range' using errcode = '22023';
  end if;

  -- ---- (c) settings ----
  select * into v_settings from public.settings where id = 1;
  if not found then
    raise exception 'create_order: settings row missing' using errcode = 'XX000';
  end if;

  -- ---- (d) delivery/region resolution ----
  if v_delivery_type = 'delivery' and not v_settings.delivery_enabled then
    return jsonb_build_object('ok', false, 'code', 'delivery_disabled');
  end if;

  if v_delivery_type = 'delivery' then
    if not (p_payload ? 'region_id')
       or p_payload->>'region_id' is null
       or (p_payload->>'region_id') !~ '^[0-9]+$' then
      return jsonb_build_object('ok', false, 'code', 'region_invalid');
    end if;
    v_region_id := (p_payload->>'region_id')::bigint;

    select id, delivery_fee, free_delivery_threshold, is_active into v_region
    from public.regions
    where id = v_region_id;

    if not found or not v_region.is_active then
      return jsonb_build_object('ok', false, 'code', 'region_invalid');
    end if;

    v_region_delivery_fee := v_region.delivery_fee;
    v_region_free_threshold := v_region.free_delivery_threshold;
  else
    -- pickup: region_id is ignored and stored as null; fee is always 0.
    v_region_id := null;
    v_region_delivery_fee := 0;
    v_region_free_threshold := null;
  end if;

  -- ---- (e) lock variants in deterministic order (variant_id ascending), detect mismatches ----
  for v_item in
    select
      (elem->>'variant_id')::bigint as variant_id,
      (elem->>'qty')::int as qty,
      (elem->>'expected_price')::bigint as expected_price
    from jsonb_array_elements(v_items) elem
    order by (elem->>'variant_id')::bigint
  loop
    select
      pv.id, pv.price, pv.old_price, pv.stock,
      pv.is_active as variant_active,
      p.id as product_id, p.name, p.warranty_months,
      p.is_active as product_active
    into r
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = v_item.variant_id
    for update of pv;

    if not found or not r.variant_active or not r.product_active or r.stock < v_item.qty then
      v_stock_changed := v_stock_changed || jsonb_build_object(
        'variant_id', v_item.variant_id,
        'available', case when found and r.variant_active and r.product_active then r.stock else 0 end
      );
    elsif r.price <> v_item.expected_price then
      v_price_changed := v_price_changed || jsonb_build_object(
        'variant_id', v_item.variant_id,
        'price', r.price
      );
    end if;
  end loop;

  -- Re-check idempotency now that we hold the variant row locks: a
  -- concurrent request with the same idempotency_key may have been blocked
  -- on one of these FOR UPDATE locks and already committed its order while
  -- we waited. Without this re-check we could misreport stock_changed /
  -- price_changed / min_order for an order that was, in fact, created.
  select id, order_no, user_id into v_existing_id, v_existing_order_no, v_existing_user_id
  from public.orders
  where idempotency_key = v_idempotency_key;

  if found then
    if v_existing_user_id <> p_user_id then
      raise exception 'create_order: idempotency_key belongs to another user' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'ok', true,
      'order_id', v_existing_id,
      'order_no', v_existing_order_no,
      'duplicate', true
    );
  end if;

  -- Stock strictly takes priority over price.
  if jsonb_array_length(v_stock_changed) > 0 then
    return jsonb_build_object('ok', false, 'code', 'stock_changed', 'items', v_stock_changed);
  end if;

  if jsonb_array_length(v_price_changed) > 0 then
    return jsonb_build_object('ok', false, 'code', 'price_changed', 'items', v_price_changed);
  end if;

  -- ---- (f) totals: re-read prices from the now-locked variant rows, never from the payload ----
  for v_item in
    select (elem->>'variant_id')::bigint as variant_id, (elem->>'qty')::int as qty
    from jsonb_array_elements(v_items) elem
  loop
    select price, old_price into r from public.product_variants where id = v_item.variant_id;
    v_items_total := v_items_total + r.price * v_item.qty;
    if r.old_price is not null then
      v_discount_total := v_discount_total + (r.old_price - r.price) * v_item.qty;
    end if;
  end loop;

  if v_items_total < v_settings.min_order_amount then
    return jsonb_build_object(
      'ok', false,
      'code', 'min_order',
      'min_order_amount', v_settings.min_order_amount,
      'items_total', v_items_total
    );
  end if;

  v_threshold := coalesce(v_region_free_threshold, v_settings.free_delivery_threshold);
  v_delivery_fee := case
    when v_delivery_type = 'pickup' then 0
    when v_items_total >= v_threshold then 0
    else v_region_delivery_fee
  end;
  v_grand_total := v_items_total + v_delivery_fee;

  v_installment_months := case
    when v_payment_method = 'installment_request' then v_settings.installment_months
    else null
  end;

  -- ---- (g) insert order + items, adjust stock/sold_count, history ----
  begin
    insert into public.orders (
      user_id, status, delivery_type, region_id, address_text, lat, lng,
      customer_name, customer_phone, comment, tracking_note,
      payment_method, payment_status, installment_months,
      items_total, discount_total, delivery_fee, grand_total, idempotency_key
    ) values (
      p_user_id, 'new', v_delivery_type, v_region_id, v_address_text, v_lat, v_lng,
      v_customer_name, v_customer_phone, v_comment, null,
      v_payment_method, 'unpaid', v_installment_months,
      v_items_total, v_discount_total, v_delivery_fee, v_grand_total, v_idempotency_key
    )
    returning id, order_no into v_order_id, v_order_no;
  exception when unique_violation then
    -- Concurrent request with the same idempotency_key won the race.
    select id, order_no, user_id into v_existing_id, v_existing_order_no, v_existing_user_id
    from public.orders
    where idempotency_key = v_idempotency_key;

    if not found then
      raise;
    end if;
    if v_existing_user_id <> p_user_id then
      raise exception 'create_order: idempotency_key belongs to another user' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'ok', true,
      'order_id', v_existing_id,
      'order_no', v_existing_order_no,
      'duplicate', true
    );
  end;

  for v_item in
    select (elem->>'variant_id')::bigint as variant_id, (elem->>'qty')::int as qty
    from jsonb_array_elements(v_items) elem
  loop
    select
      pv.id, pv.price, pv.old_price, pv.color_name, pv.storage_gb,
      p.id as product_id, p.name, p.warranty_months
    into r
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = v_item.variant_id;

    insert into public.order_items (
      order_id, variant_id, product_id,
      name_snapshot, color_snapshot, storage_snapshot,
      price_snapshot, old_price_snapshot, warranty_snapshot, qty
    ) values (
      v_order_id, v_item.variant_id, r.product_id,
      r.name, r.color_name, r.storage_gb,
      r.price, r.old_price, r.warranty_months, v_item.qty
    );

    update public.product_variants
    set stock = stock - v_item.qty
    where id = v_item.variant_id;

    update public.products
    set sold_count = sold_count + v_item.qty
    where id = r.product_id;
  end loop;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (v_order_id, null, 'new', p_user_id);

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'order_no', v_order_no,
    'items_total', v_items_total,
    'discount_total', v_discount_total,
    'delivery_fee', v_delivery_fee,
    'grand_total', v_grand_total,
    'duplicate', false
  );
end;
$$;

create function public.set_order_status(
  p_order_id bigint,
  p_to public.order_status,
  p_admin_id bigint,
  p_tracking_note text default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_order record;
  v_allowed boolean;
  v_before jsonb;
  v_after jsonb;
begin
  select id, status, delivery_type, user_id, order_no into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'set_order_status: order % not found', p_order_id using errcode = '22023';
  end if;

  -- Mirrors shared/src/orderStatus.ts canTransition() exactly:
  --   new        -> confirmed | cancelled
  --   confirmed  -> shipped | on_the_way | cancelled, plus delivered when delivery_type = 'pickup'
  --   shipped    -> on_the_way | delivered | cancelled
  --   on_the_way -> delivered | cancelled
  --   delivered / cancelled -> nothing (terminal)
  v_allowed := (
    (v_order.status = 'new' and p_to in ('confirmed', 'cancelled'))
    or (v_order.status = 'confirmed' and (
      p_to in ('shipped', 'on_the_way', 'cancelled')
      or (p_to = 'delivered' and v_order.delivery_type = 'pickup')
    ))
    or (v_order.status = 'shipped' and p_to in ('on_the_way', 'delivered', 'cancelled'))
    or (v_order.status = 'on_the_way' and p_to in ('delivered', 'cancelled'))
  );

  if not v_allowed then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_transition',
      'from', v_order.status,
      'to', p_to
    );
  end if;

  v_before := jsonb_build_object('status', v_order.status);
  v_after := case
    when p_tracking_note is not null then jsonb_build_object('status', p_to, 'tracking_note', p_tracking_note)
    else jsonb_build_object('status', p_to)
  end;

  if p_to = 'cancelled' then
    -- Restore stock/sold_count from order_items. Aggregated by variant_id /
    -- product_id (not a plain join) so that if an order ever contained the
    -- same variant or product twice, all of its quantities would be summed
    -- and restored correctly instead of a naive join applying only one
    -- matching row. create_order rejects duplicate variant_id lines today,
    -- so this can't currently happen for variant_id -- but it's written
    -- defensively rather than relying on that invariant holding forever,
    -- and two different variants of the SAME product legitimately share one
    -- product_id, so the products aggregation is load-bearing right now.
    --
    -- order_items rows whose variant_id/product_id is null (the variant or
    -- product was hard-deleted after the order was placed) are silently
    -- skipped here -- accepted behaviour, same as XUMO.
    update public.product_variants v
    set stock = v.stock + agg.qty
    from (
      select variant_id, sum(qty) as qty
      from public.order_items
      where order_id = p_order_id and variant_id is not null
      group by variant_id
    ) agg
    where agg.variant_id = v.id;

    update public.products p
    set sold_count = greatest(p.sold_count - agg.qty, 0)
    from (
      select product_id, sum(qty) as qty
      from public.order_items
      where order_id = p_order_id and product_id is not null
      group by product_id
    ) agg
    where agg.product_id = p.id;
  end if;

  -- coalesce so a status change without a note does not erase an existing one.
  update public.orders
  set status = p_to, tracking_note = coalesce(p_tracking_note, tracking_note)
  where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (p_order_id, v_order.status, p_to, p_admin_id);

  insert into public.audit_log (admin_id, action, entity, entity_id, before, after)
  values (p_admin_id, 'order_status', 'orders', p_order_id, v_before, v_after);

  return jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'from', v_order.status,
    'to', p_to,
    'user_id', v_order.user_id,
    'order_no', v_order.order_no
  );
end;
$$;
