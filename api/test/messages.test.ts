import { describe, expect, it } from 'vitest';
import {
  buildCustomerOrderConfirmationMessage,
  buildGroupOrderKeyboard,
  buildCustomerStatusMessage,
  buildGroupOrderMessage,
  buildStartGreeting,
  buildSubscribeKeyboard,
  buildSubscribeRequiredMessage,
  formatShopTime,
  isSubscriptionCallback,
  parseOrderStatusCallback,
  type OrderForMessage,
  type OrderStatusForMessage,
} from '../src/lib/messages.uz';

const BASE_ORDER: OrderForMessage = {
  orderNo: 'DM-000123',
  customerName: 'Ali',
  customerPhone: '+998901234567',
  deliveryType: 'delivery',
  regionName: 'Buxoro',
  addressText: 'Bukhoro, Registon 1',
  lat: null,
  lng: null,
  comment: null,
  paymentMethod: 'cash',
  installmentMonths: null,
  itemsTotal: 20000,
  deliveryFee: 15000,
  grandTotal: 35000,
  items: [{ name: 'Olma', colorName: 'Qora', storageGb: 128, qty: 2, price: 10000 }],
};

const NEW_STATUS: OrderStatusForMessage = { status: 'new', changedByName: null, changedAt: null };

describe('buildGroupOrderMessage', () => {
  it('escapes HTML in the customer name', () => {
    const order: OrderForMessage = { ...BASE_ORDER, customerName: '<b>Ali</b>' };
    const message = buildGroupOrderMessage(order, NEW_STATUS);
    expect(message).not.toContain('<b>Ali</b>');
    expect(message).toContain('&lt;b&gt;Ali&lt;/b&gt;');
  });

  it('escapes HTML in item names', () => {
    const order: OrderForMessage = {
      ...BASE_ORDER,
      items: [{ name: '<script>x</script>', colorName: null, storageGb: null, qty: 1, price: 1000 }],
    };
    const message = buildGroupOrderMessage(order, NEW_STATUS);
    expect(message).not.toContain('<script>');
  });

  it('includes region name and per-item color/storage', () => {
    const message = buildGroupOrderMessage(BASE_ORDER, NEW_STATUS);
    expect(message).toContain('Hudud: Buxoro');
    expect(message).toContain('Olma · Qora · 128GB');
  });

  it('omits map links when lat/lng are absent', () => {
    const message = buildGroupOrderMessage(BASE_ORDER, NEW_STATUS);
    expect(message).not.toContain('maps.google.com');
    expect(message).not.toContain('yandex.uz/maps');
  });

  it('includes both map links when lat/lng are present', () => {
    const order: OrderForMessage = { ...BASE_ORDER, lat: 39.77, lng: 64.42 };
    const message = buildGroupOrderMessage(order, NEW_STATUS);
    expect(message).toContain('https://maps.google.com/?q=39.77,64.42');
    expect(message).toContain('https://yandex.uz/maps/?pt=64.42,39.77&z=17');
  });

  it('shows "Olib ketish" for pickup and no address/region line', () => {
    const order: OrderForMessage = { ...BASE_ORDER, deliveryType: 'pickup', addressText: null, regionName: null };
    const message = buildGroupOrderMessage(order, NEW_STATUS);
    expect(message).toContain('Olib ketish');
    expect(message).not.toContain('Manzil:');
    expect(message).not.toContain('Hudud:');
  });

  it('formats item lines as "name · color · storageGB × qty = sum"', () => {
    const message = buildGroupOrderMessage(BASE_ORDER, NEW_STATUS);
    expect(message).toContain("Olma · Qora · 128GB × 2 = 20 000 so'm");
  });

  it('new order has the YANGI header and no actor line', () => {
    const message = buildGroupOrderMessage(BASE_ORDER, NEW_STATUS);
    expect(message.startsWith('🆕 <b>YANGI buyurtma DM-000123</b>')).toBe(true);
    expect(message).not.toContain('Qabul qildi:');
  });

  it('accepted order shows who accepted it and when, escaped', () => {
    const message = buildGroupOrderMessage(BASE_ORDER, {
      status: 'confirmed',
      changedByName: '<b>Vali</b>',
      changedAt: new Date('2026-09-17T16:26:00Z'),
    });
    expect(message.startsWith('✅ <b>QABUL QILINDI DM-000123</b>')).toBe(true);
    expect(message).toContain('Qabul qildi: &lt;b&gt;Vali&lt;/b&gt;, 21:26 17.09');
  });

  it('shipped order shows the JO\'NATILDI header', () => {
    const message = buildGroupOrderMessage(BASE_ORDER, {
      status: 'shipped',
      changedByName: 'Vali',
      changedAt: new Date('2026-09-17T16:26:00Z'),
    });
    expect(message.startsWith("📮 <b>JO'NATILDI DM-000123</b>")).toBe(true);
    expect(message).toContain("Jo'natdi: Vali, 21:26 17.09");
  });

  it('prefixes an installment_request order with the nasiya warning and shows the monthly figure', () => {
    const order: OrderForMessage = {
      ...BASE_ORDER,
      paymentMethod: 'installment_request',
      installmentMonths: 12,
      itemsTotal: 12_000_000,
      grandTotal: 12_000_000,
    };
    const message = buildGroupOrderMessage(order, NEW_STATUS);
    expect(message.startsWith("⚠️ <b>NASIYA SO'ROVI</b>")).toBe(true);
    expect(message).toContain('Oylik to\'lov (taxminiy):');
    expect(message).toContain('× 12 oy');
  });
});

describe('formatShopTime', () => {
  it('converts to UTC+5 across midnight', () => {
    expect(formatShopTime(new Date('2026-12-31T20:05:00Z'))).toBe('01:05 01.01');
  });
});

describe('buildGroupOrderKeyboard', () => {
  const buttonFor = (status: OrderStatusForMessage['status'], deliveryType: 'delivery' | 'pickup') =>
    buildGroupOrderKeyboard(42, status, deliveryType).inline_keyboard.flat();

  it('new -> Qabul qildim', () => {
    const accept = buttonFor('new', 'delivery');
    expect(accept.length).toBe(1);
    expect(accept[0]!.callback_data).toBe('os:42:confirmed');
    expect(accept[0]!.text).toBe('Qabul qildim');
  });

  it('confirmed delivery -> Jo\'natdim (shipped)', () => {
    const send = buttonFor('confirmed', 'delivery');
    expect(send.length).toBe(1);
    expect(send[0]!.callback_data).toBe('os:42:shipped');
  });

  it('confirmed pickup -> Topshirdim (delivered, skipping courier states)', () => {
    const handOver = buttonFor('confirmed', 'pickup');
    expect(handOver.length).toBe(1);
    expect(handOver[0]!.callback_data).toBe('os:42:delivered');
  });

  it('shipped -> Yo\'lga chiqardim (on_the_way)', () => {
    const onTheWay = buttonFor('shipped', 'delivery');
    expect(onTheWay.length).toBe(1);
    expect(onTheWay[0]!.callback_data).toBe('os:42:on_the_way');
  });

  it('on_the_way -> Topshirdim (delivered)', () => {
    const delivered = buttonFor('on_the_way', 'delivery');
    expect(delivered.length).toBe(1);
    expect(delivered[0]!.callback_data).toBe('os:42:delivered');
  });

  it('terminal statuses have no buttons', () => {
    for (const status of ['delivered', 'cancelled'] as const) {
      expect(buttonFor(status, 'delivery').length).toBe(0);
    }
  });
});

describe('parseOrderStatusCallback', () => {
  it('round-trips keyboard data and rejects anything else', () => {
    const data = buildGroupOrderKeyboard(7, 'new', 'delivery').inline_keyboard[0]![0]!.callback_data;
    const parsed = parseOrderStatusCallback(data);
    expect(parsed).toEqual({ orderId: 7, status: 'confirmed' });

    for (const bad of [
      undefined,
      '',
      'os:7:cancelled',
      'os:7:new',
      'os:0:confirmed',
      'os:-1:confirmed',
      'os:7:confirmed:x',
      'xx:7:confirmed',
      'os:99999999999999999:confirmed',
    ]) {
      expect(parseOrderStatusCallback(bad)).toBeNull();
    }
  });

  it('accepts shipped in the callback data', () => {
    expect(parseOrderStatusCallback('os:7:shipped')).toEqual({ orderId: 7, status: 'shipped' });
  });
});

describe('buildCustomerOrderConfirmationMessage', () => {
  it('includes order number and total', () => {
    const message = buildCustomerOrderConfirmationMessage(BASE_ORDER);
    expect(message).toContain('DM-000123');
    expect(message).toContain('35 000');
  });
});

describe('buildCustomerStatusMessage', () => {
  it('escapes the order number', () => {
    const message = buildCustomerStatusMessage('<b>DM-1</b>', 'confirmed', null);
    expect(message).not.toContain('<b>DM-1</b>');
  });

  it('includes the tracking note when the status is shipped', () => {
    const message = buildCustomerStatusMessage('DM-1', 'shipped', 'Yandex delivery #12345');
    expect(message).toContain('Kuzatuv: Yandex delivery #12345');
  });

  it('omits the tracking note for a non-shipped status even if present', () => {
    const message = buildCustomerStatusMessage('DM-1', 'confirmed', 'ignored');
    expect(message).not.toContain('Kuzatuv:');
  });

  it('omits the tracking note line when shipped has no note', () => {
    const message = buildCustomerStatusMessage('DM-1', 'shipped', null);
    expect(message).not.toContain('Kuzatuv:');
  });
});

describe('buildStartGreeting', () => {
  it('escapes the first name', () => {
    const greeting = buildStartGreeting('<i>Ali</i>');
    expect(greeting).not.toContain('<i>Ali</i>');
  });
});

describe('buildSubscribeRequiredMessage', () => {
  it('escapes the first name and names the channel', () => {
    const message = buildSubscribeRequiredMessage('<i>Ali</i>', 'dunyo_mobile_kanali');
    expect(message).not.toContain('<i>Ali</i>');
    expect(message).toContain('@dunyo_mobile_kanali');
  });

  it('omits the handle for a numeric channel id', () => {
    const message = buildSubscribeRequiredMessage('Ali', '-1001234567890');
    expect(message).not.toContain('-1001234567890');
  });
});

describe('buildSubscribeKeyboard', () => {
  it('offers the channel link and the re-check button', () => {
    const keyboard = buildSubscribeKeyboard('dunyo_mobile_kanali');
    expect(keyboard.inline_keyboard.length).toBe(2);
    expect(keyboard.inline_keyboard[0]![0]!.url).toBe('https://t.me/dunyo_mobile_kanali');
    expect(isSubscriptionCallback(keyboard.inline_keyboard[1]![0]!.callback_data)).toBe(true);
  });

  it('a numeric channel id gets only the re-check button', () => {
    const keyboard = buildSubscribeKeyboard('-1001234567890');
    expect(keyboard.inline_keyboard.length).toBe(1);
    expect(isSubscriptionCallback(keyboard.inline_keyboard[0]![0]!.callback_data)).toBe(true);
  });
});

describe('isSubscriptionCallback', () => {
  it('never claims order status callback_data', () => {
    const orderData = buildGroupOrderKeyboard(7, 'new', 'delivery').inline_keyboard[0]![0]!.callback_data;
    expect(isSubscriptionCallback(orderData)).toBe(false);
    expect(isSubscriptionCallback(undefined)).toBe(false);
    expect(isSubscriptionCallback('sub:')).toBe(false);
  });
});
