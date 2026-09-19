import { describe, expect, it } from 'vitest';
import {
  isOrderStatus,
  isWebpMagicBytes,
  parsePositiveIntegerId,
  validateAddressWriteBody,
  validateBannerPatchBody,
  validateBannerWriteBody,
  validateBrandWriteBody,
  validateOrderCreateBody,
  validateOrderStatusBody,
  validateProductWriteBody,
  validateRegionWriteBody,
  validateSettingsWriteBody,
  validateVariantWriteBody,
} from '../src/lib/validators';

// ---------------------------------------------------------------------------
// WebP magic bytes
// ---------------------------------------------------------------------------

describe('isWebpMagicBytes', () => {
  it('accepts a valid RIFF....WEBP header', () => {
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x00]);
    expect(isWebpMagicBytes(bytes)).toBe(true);
  });

  it('rejects a PNG header', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(isWebpMagicBytes(bytes)).toBe(false);
  });

  it('rejects a buffer shorter than the header', () => {
    expect(isWebpMagicBytes(new Uint8Array([0x52, 0x49]))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

const VALID_ORDER_BODY = {
  idempotency_key: '11111111-1111-4111-8111-111111111111',
  delivery_type: 'delivery',
  region_id: 1,
  address_text: 'Bukhoro, Registon 1',
  customer_name: 'Ali',
  customer_phone: '+998901234567',
  payment_method: 'cash',
  items: [{ variant_id: 1, qty: 2, expected_price: 10000 }],
};

describe('validateOrderCreateBody', () => {
  it('accepts a well-formed order', () => {
    const result = validateOrderCreateBody(VALID_ORDER_BODY);
    expect(result.ok).toBe(true);
  });

  it('normalizes the phone number', () => {
    const result = validateOrderCreateBody({ ...VALID_ORDER_BODY, customer_phone: '998 90 123-45-67' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.customerPhone).toBe('+998901234567');
    }
  });

  it('rejects an invalid phone number', () => {
    const result = validateOrderCreateBody({ ...VALID_ORDER_BODY, customer_phone: '90 123' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_phone');
    }
  });

  it('requires address_text for delivery', () => {
    const result = validateOrderCreateBody({ ...VALID_ORDER_BODY, address_text: undefined });
    expect(result.ok).toBe(false);
  });

  it('pickup does not require address_text or region_id', () => {
    const result = validateOrderCreateBody({
      ...VALID_ORDER_BODY,
      delivery_type: 'pickup',
      address_text: undefined,
      region_id: undefined,
    });
    expect(result.ok).toBe(true);
  });

  it('accepts an order without region_id (route/RPC decides if delivery requires it)', () => {
    const { region_id: _unused, ...body } = VALID_ORDER_BODY;
    const result = validateOrderCreateBody(body);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.regionId).toBeNull();
    }
  });

  it('rejects a non-integer region_id', () => {
    const result = validateOrderCreateBody({ ...VALID_ORDER_BODY, region_id: 1.5 });
    expect(result.ok).toBe(false);
  });

  it('accepts payment_method installment_request', () => {
    const result = validateOrderCreateBody({ ...VALID_ORDER_BODY, payment_method: 'installment_request' });
    expect(result.ok).toBe(true);
  });

  it('rejects an empty items array', () => {
    const result = validateOrderCreateBody({ ...VALID_ORDER_BODY, items: [] });
    expect(result.ok).toBe(false);
  });

  it('items carry variant_id, not product_id', () => {
    const result = validateOrderCreateBody({
      ...VALID_ORDER_BODY,
      items: [{ product_id: 1, qty: 2, expected_price: 10000 }],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a non-uuid idempotency_key', () => {
    const result = validateOrderCreateBody({ ...VALID_ORDER_BODY, idempotency_key: 'not-a-uuid' });
    expect(result.ok).toBe(false);
  });

  it('rejects lat/lng out of range', () => {
    const result = validateOrderCreateBody({ ...VALID_ORDER_BODY, lat: 999 });
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Order status
// ---------------------------------------------------------------------------

describe('validateOrderStatusBody', () => {
  it('accepts a valid status with no tracking_note', () => {
    const result = validateOrderStatusBody({ status: 'confirmed' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.trackingNote).toBeNull();
    }
  });

  it('accepts a trimmed tracking_note', () => {
    const result = validateOrderStatusBody({ status: 'shipped', tracking_note: '  track 123  ' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.trackingNote).toBe('track 123');
    }
  });

  it('rejects an unknown status', () => {
    const result = validateOrderStatusBody({ status: 'bogus' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_status');
    }
  });

  it('rejects an overly long tracking_note', () => {
    const result = validateOrderStatusBody({ status: 'shipped', tracking_note: 'x'.repeat(501) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_tracking_note');
    }
  });
});

// ---------------------------------------------------------------------------
// Products (no price/stock)
// ---------------------------------------------------------------------------

describe('validateProductWriteBody', () => {
  it('accepts a minimal well-formed product', () => {
    const result = validateProductWriteBody({ name: 'iPhone 15', brand_id: 1, category_id: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.warrantyMonths).toBe(12);
    }
  });

  it('requires a brand_id', () => {
    const result = validateProductWriteBody({ name: 'iPhone 15', category_id: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_brand');
    }
  });

  it('rejects price/stock fields being required (they no longer exist here)', () => {
    const result = validateProductWriteBody({ name: 'iPhone 15', brand_id: 1, category_id: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect('price' in result.value).toBe(false);
      expect('stock' in result.value).toBe(false);
    }
  });

  it('rejects an invalid specs value', () => {
    const result = validateProductWriteBody({ name: 'iPhone 15', brand_id: 1, category_id: 1, specs: 'not-an-object' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_specs');
    }
  });
});

// ---------------------------------------------------------------------------
// Product variants
// ---------------------------------------------------------------------------

describe('validateVariantWriteBody', () => {
  const VALID_VARIANT = { color_name: 'Qora', storage_gb: 128, price: 12_000_000, stock: 5 };

  it('accepts a well-formed variant', () => {
    const result = validateVariantWriteBody(VALID_VARIANT);
    expect(result.ok).toBe(true);
  });

  it('requires price > 0', () => {
    const result = validateVariantWriteBody({ ...VALID_VARIANT, price: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_price');
    }
  });

  it('old_price must be greater than price', () => {
    const result = validateVariantWriteBody({ ...VALID_VARIANT, old_price: 100 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_old_price');
    }
  });

  it('rejects a malformed color_hex', () => {
    const result = validateVariantWriteBody({ ...VALID_VARIANT, color_hex: 'not-a-hex' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_color_hex');
    }
  });

  it('accepts a valid color_hex', () => {
    const result = validateVariantWriteBody({ ...VALID_VARIANT, color_hex: '#00ff00' });
    expect(result.ok).toBe(true);
  });

  it('storage_gb is optional (accessories have none)', () => {
    const { storage_gb: _unused, ...body } = VALID_VARIANT;
    const result = validateVariantWriteBody(body);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.storageGb).toBeNull();
    }
  });

  it('rejects a non-positive storage_gb', () => {
    const result = validateVariantWriteBody({ ...VALID_VARIANT, storage_gb: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_storage_gb');
    }
  });

  it('stock must be a non-negative integer', () => {
    const result = validateVariantWriteBody({ ...VALID_VARIANT, stock: -1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_stock');
    }
  });

  it('rejects a blank sku', () => {
    const result = validateVariantWriteBody({ ...VALID_VARIANT, sku: '   ' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_sku');
    }
  });

  it('rejects a non-boolean is_active', () => {
    const result = validateVariantWriteBody({ ...VALID_VARIANT, is_active: 'yes' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_is_active');
    }
  });

  it('rejects a non-integer sort_order', () => {
    const result = validateVariantWriteBody({ ...VALID_VARIANT, sort_order: 1.5 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_sort_order');
    }
  });
});

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

describe('validateBrandWriteBody', () => {
  it('accepts a well-formed brand and defaults sort_order/is_active', () => {
    const result = validateBrandWriteBody({ name: 'Apple' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sortOrder).toBe(0);
      expect(result.value.isActive).toBe(true);
    }
  });

  it('rejects a blank name', () => {
    const result = validateBrandWriteBody({ name: '   ' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_name');
    }
  });
});

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

describe('validateRegionWriteBody', () => {
  const VALID_REGION = { name: 'Buxoro', delivery_fee: 15000 };

  it('accepts a well-formed region', () => {
    const result = validateRegionWriteBody(VALID_REGION);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.freeDeliveryThreshold).toBeNull();
    }
  });

  it('rejects a negative delivery_fee', () => {
    const result = validateRegionWriteBody({ ...VALID_REGION, delivery_fee: -1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_delivery_fee');
    }
  });

  it('allows a null free_delivery_threshold (falls back to the global one)', () => {
    const result = validateRegionWriteBody({ ...VALID_REGION, free_delivery_threshold: null });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.freeDeliveryThreshold).toBeNull();
    }
  });

  it('rejects a negative free_delivery_threshold', () => {
    const result = validateRegionWriteBody({ ...VALID_REGION, free_delivery_threshold: -1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_free_delivery_threshold');
    }
  });
});

// ---------------------------------------------------------------------------
// Banners
// ---------------------------------------------------------------------------

describe('validateBannerWriteBody', () => {
  it('defaults and ignores a client-supplied image_path', () => {
    const result = validateBannerWriteBody({ title: 'Aksiya', image_path: 'attacker/controlled.webp' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe('Aksiya');
      expect('image_path' in result.value).toBe(false);
      expect(result.value.isActive).toBe(true);
      expect(result.value.sortOrder).toBe(0);
    }
  });

  it('rejects a non-object body', () => {
    const result = validateBannerWriteBody('not an object');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('bad_request');
    }
  });
});

describe('validateBannerPatchBody', () => {
  it('only includes fields present in the body', () => {
    const result = validateBannerPatchBody({ sort_order: 5 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sortOrder).toBe(5);
      expect(result.value.title).toBeUndefined();
    }
  });

  it('ignores a client-supplied image_path even when present', () => {
    const result = validateBannerPatchBody({ image_path: 'attacker/controlled.webp', title: 'New title' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect('image_path' in result.value).toBe(false);
      expect(result.value.title).toBe('New title');
    }
  });

  it('rejects a non-string title', () => {
    const result = validateBannerPatchBody({ title: 123 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_title');
    }
  });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

describe('validateSettingsWriteBody', () => {
  it('no longer has a delivery_fee field (regions own it now)', () => {
    const result = validateSettingsWriteBody({ delivery_fee: -1 });
    // delivery_fee is simply not a recognized key any more -- it is ignored,
    // not rejected, since validateSettingsWriteBody only checks keys it knows.
    expect(result.ok).toBe(true);
  });

  it('accepts a null shop_group_chat_id', () => {
    const result = validateSettingsWriteBody({ shop_group_chat_id: null });
    expect(result.ok).toBe(true);
  });

  it('rejects a non-integer shop_group_chat_id', () => {
    const result = validateSettingsWriteBody({ shop_group_chat_id: 1.5 });
    expect(result.ok).toBe(false);
  });

  it('normalizes required_channel', () => {
    const result = validateSettingsWriteBody({ required_channel: '  @dunyo_mobile_kanali ' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.requiredChannel).toBe('dunyo_mobile_kanali');
    }
  });

  it('null and blank required_channel switch the gate off', () => {
    const nulled = validateSettingsWriteBody({ required_channel: null });
    expect(nulled.ok && nulled.value.requiredChannel === null).toBe(true);
    const blank = validateSettingsWriteBody({ required_channel: '   ' });
    expect(blank.ok && blank.value.requiredChannel === null).toBe(true);
  });

  it('rejects a malformed required_channel', () => {
    for (const bad of ['abc', 'has space', 'https://t.me/kanal', 42]) {
      const result = validateSettingsWriteBody({ required_channel: bad });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('invalid_required_channel');
      }
    }
  });

  it('accepts a positive installment_months', () => {
    const result = validateSettingsWriteBody({ installment_months: 12 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.installmentMonths).toBe(12);
    }
  });

  it('rejects a non-positive installment_months', () => {
    const result = validateSettingsWriteBody({ installment_months: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_installment_months');
    }
  });

  it('rejects a blank support_username', () => {
    const result = validateSettingsWriteBody({ support_username: '   ' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_support_username');
    }
  });

  it('accepts a null support_username', () => {
    const result = validateSettingsWriteBody({ support_username: null });
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

describe('validateAddressWriteBody', () => {
  it('requires non-empty text', () => {
    const result = validateAddressWriteBody({ text: '   ' });
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parsePositiveIntegerId (path/query id params)
// ---------------------------------------------------------------------------

describe('parsePositiveIntegerId', () => {
  it('accepts a plain positive integer', () => {
    expect(parsePositiveIntegerId('42')).toBe(42);
    expect(parsePositiveIntegerId('1')).toBe(1);
  });

  it('rejects zero', () => {
    expect(parsePositiveIntegerId('0')).toBeNull();
  });

  it('rejects a negative number', () => {
    expect(parsePositiveIntegerId('-1')).toBeNull();
  });

  it('rejects a decimal', () => {
    expect(parsePositiveIntegerId('1.5')).toBeNull();
  });

  it('rejects non-numeric input', () => {
    expect(parsePositiveIntegerId('abc')).toBeNull();
    expect(parsePositiveIntegerId('')).toBeNull();
  });

  it('rejects a leading zero', () => {
    expect(parsePositiveIntegerId('007')).toBeNull();
  });

  it('rejects a value with trailing garbage', () => {
    expect(parsePositiveIntegerId('42abc')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isOrderStatus (POST /admin/orders/:id/status body)
// ---------------------------------------------------------------------------

describe('isOrderStatus', () => {
  it('accepts all 6 known statuses', () => {
    for (const status of ['new', 'confirmed', 'shipped', 'on_the_way', 'delivered', 'cancelled']) {
      expect(isOrderStatus(status)).toBe(true);
    }
  });

  it('rejects an unknown string', () => {
    expect(isOrderStatus('processing')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isOrderStatus(null)).toBe(false);
    expect(isOrderStatus(1)).toBe(false);
    expect(isOrderStatus(undefined)).toBe(false);
  });
});
