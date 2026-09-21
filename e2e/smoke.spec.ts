import { expect, test } from '@playwright/test';

const PRODUCT_NAME = 'Redmi Note 13 Pro+';

test.beforeEach(async ({ page }) => {
  // The Telegram SDK is not needed outside Telegram; avoid the network call.
  await page.route('**/telegram.org/**', (route) => route.abort());
});

test('catalog -> cart -> checkout -> order success (mock mode)', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Katalog' }).click();
  await page.getByRole('button', { name: /Smartfonlar/ }).click();
  await page.getByRole('button', { name: PRODUCT_NAME, exact: true }).click();

  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Savatga' }).click();

  await page.getByRole('link', { name: /Savat/ }).click();
  await page.getByRole('button', { name: 'Rasmiylashtirish' }).click();

  await expect(page).toHaveURL(/\/checkout/);
  await page.getByRole('button', { name: 'Buyurtma berish' }).click();

  await expect(page).toHaveURL(/\/orders\/\d+\/success/);
  await expect(page.getByRole('heading', { name: 'Buyurtma qabul qilindi' })).toBeVisible();
  await expect(page.getByText(/DM-/)).toBeVisible();
});
