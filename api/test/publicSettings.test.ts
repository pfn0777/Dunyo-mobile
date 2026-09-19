import { describe, expect, it } from 'vitest';
import { projectPublicSettings, type PublicSettingsRow } from '../src/lib/publicSettings';

const BASE_ROW: PublicSettingsRow = {
  min_order_amount: '0',
  free_delivery_threshold: '10000000',
  delivery_enabled: true,
  pickup_address: 'Samarqand Darvoza filiali',
  installment_months: 12,
  support_username: 'dunyo_support',
};

describe('projectPublicSettings', () => {
  it('projects the six public fields, converting money strings to numbers', () => {
    expect(projectPublicSettings(BASE_ROW)).toEqual({
      min_order_amount: 0,
      free_delivery_threshold: 10000000,
      delivery_enabled: true,
      pickup_address: 'Samarqand Darvoza filiali',
      installment_months: 12,
      support_username: 'dunyo_support',
    });
  });

  it('never leaks shop_group_chat_id or required_channel even if the row carries them', () => {
    const rowWithPrivateFields: PublicSettingsRow = {
      ...BASE_ROW,
      shop_group_chat_id: -1001234567890,
      required_channel: 'secret_channel',
    };
    const projected = projectPublicSettings(rowWithPrivateFields);
    expect(projected).not.toHaveProperty('shop_group_chat_id');
    expect(projected).not.toHaveProperty('required_channel');
    expect(Object.keys(projected).sort()).toEqual(
      [
        'delivery_enabled',
        'free_delivery_threshold',
        'installment_months',
        'min_order_amount',
        'pickup_address',
        'support_username',
      ].sort(),
    );
  });
});
