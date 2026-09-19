import { describe, expect, it } from 'vitest';
import { adminParentPath } from '../adminParentPath.ts';

describe('adminParentPath', () => {
  it('leaves the panel from its root', () => {
    expect(adminParentPath('/admin')).toBe('/profile');
    expect(adminParentPath('/admin/')).toBe('/profile');
  });

  it('goes one segment up inside the panel', () => {
    expect(adminParentPath('/admin/orders')).toBe('/admin');
    expect(adminParentPath('/admin/settings')).toBe('/admin');
    expect(adminParentPath('/admin/orders/42')).toBe('/admin/orders');
    expect(adminParentPath('/admin/products/new')).toBe('/admin/products');
    expect(adminParentPath('/admin/products/7/variants')).toBe('/admin/products/7');
  });

  it('falls back to the panel root for anything unexpected', () => {
    expect(adminParentPath('/admin/orders/42/')).toBe('/admin/orders');
    expect(adminParentPath('/elsewhere')).toBe('/admin');
  });
});
