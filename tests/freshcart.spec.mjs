import { test, expect } from '@playwright/test';
for (const fixed of [false, true]) {
  const base =
    process.env.DZ_HOSTED === 'true'
      ? fixed
        ? 'https://dz-3003-fixed.web.app'
        : 'https://dz-3003-buggy.web.app'
      : `http://127.0.0.1:${fixed ? 5182 : 5181}`;
  test.describe(fixed ? 'fixed' : 'buggy', () => {
    test('home after connection loss', async ({ page, context }) => {
      await page.goto(base);
      await expect(page.getByRole('heading', { name: 'Orchard apples', exact: true })).toBeVisible();
      await context.setOffline(true);
      await page.locator('nav').getByRole('link', { name: 'Shop', exact: true }).click();
      if (fixed) {
        await expect(page.getByText(/showing saved items/)).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Orchard apples', exact: true })).toBeVisible();
      } else await expect(page.getByRole('progressbar')).toBeVisible();
    });
    test('cart is an offline control', async ({ page, context }) => {
      await page.goto(base + '/cart');
      await expect(page.getByRole('heading', { name: 'Your basket' })).toBeVisible();
      await context.setOffline(true);
      await page.locator('nav').getByRole('link', { name: 'Cart', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Your basket' })).toBeVisible();
      await expect(page.getByRole('progressbar')).toHaveCount(0);
    });
    test('profile handles offline', async ({ page, context }) => {
      await page.goto(base + '/profile');
      await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible();
      await context.setOffline(true);
      await page.locator('nav').getByRole('link', { name: 'Profile', exact: true }).click();
      if (fixed) {
        await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
        await expect(page.getByText('TypeError: Failed to fetch', { exact: true })).toHaveCount(0);
      } else await expect(page.getByText('TypeError: Failed to fetch', { exact: true })).toBeVisible();
    });
    test('orders handles offline', async ({ page, context }) => {
      await page.goto(base + '/orders');
      await expect(page.getByRole('heading', { name: 'Your orders' })).toBeVisible();
      await context.setOffline(true);
      await page.locator('nav').getByRole('link', { name: 'Orders', exact: true }).click();
      if (fixed) {
        await expect(page.getByText(/showing saved orders/)).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Your orders' })).toBeVisible();
      } else await expect(page.locator('#screen')).toBeEmpty();
    });
    test('checkout preserves input and queues while offline', async ({ page, context }) => {
      await page.goto(base + '/checkout');
      await page.locator('#name').fill('Asha Rao');
      await page.locator('#street').fill('12 Lake View Rd');
      await page.locator('#city').fill('Springfield');
      await context.setOffline(true);
      await page.getByRole('button', { name: /Place order/ }).click();
      if (fixed) {
        await expect(page.locator('#name')).toHaveValue('Asha Rao');
        await expect(page.locator('#street')).toHaveValue('12 Lake View Rd');
        await expect(page.locator('#notice')).toContainText("we'll place your order");
        await expect
          .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('freshcart-orders') || '[]').length))
          .toBe(1);
        await context.setOffline(false);
        await expect(page.locator('#name')).toHaveValue('Asha Rao');
      } else {
        await expect(page.getByRole('progressbar')).toBeVisible();
        await expect(page.locator('#name')).toHaveValue('');
        await expect(page.getByRole('button', { name: /Place order/ })).toBeDisabled();
      }
    });
  });
}

test('fixed checkout keeps input when local persistence fails', async ({ page, context }) => {
  await page.goto(
    process.env.DZ_HOSTED === 'true' ? 'https://dz-3003-fixed.web.app/checkout' : 'http://127.0.0.1:5182/checkout',
  );
  await page.locator('#name').fill('Asha Rao');
  await page.locator('#street').fill('12 Lake View Rd');
  await page.locator('#city').fill('Springfield');
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException('Storage full', 'QuotaExceededError');
    };
  });
  await context.setOffline(true);
  await page.getByRole('button', { name: /Place order/ }).click();
  await expect(page.locator('#notice')).toContainText('Could not save');
  await expect(page.locator('#name')).toHaveValue('Asha Rao');
  await expect(page.getByRole('button', { name: /Place order/ })).toBeEnabled();
});

for (const fixed of [false, true])
  test(`functional basket ${fixed ? 'fixed' : 'buggy'}`, async ({ page, context }) => {
    const base = `http://127.0.0.1:${fixed ? 5182 : 5181}`;
    await page.goto(base);
    await expect(page.getByRole('heading', { name: 'Orchard apples', exact: true })).toBeVisible();
    const apple = page
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: 'Orchard apples', exact: true }) });
    await apple.getByRole('button').click();
    await apple.getByRole('button').click();
    await page.locator('nav').getByRole('link', { name: 'Cart', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Total $4.00', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Increase Orchard apples', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Total $6.00', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Total $6.00', exact: true })).toBeVisible();
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Decrease Orchard apples', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Total $4.00', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Remove Orchard apples', exact: true }).click();
    await expect(page.getByText('Your basket is empty. Add products from the shop.', { exact: true })).toBeVisible();
  });

test('checkout reference layout remains responsive', async ({ page }) => {
  await page.goto('http://127.0.0.1:5182/checkout');
  await page.evaluate(() =>
    localStorage.setItem(
      'freshcart-cart',
      JSON.stringify([
        { name: 'Orchard apples', unitCents: 200, quantity: 2 },
        { name: 'Oat milk', unitCents: 425, quantity: 1 },
        { name: 'Sourdough loaf', unitCents: 470, quantity: 1 },
      ]),
    ),
  );
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole('heading', { name: 'Order summary', exact: true })).toBeVisible();
  await page.screenshot({ path: 'output/ui/freshcart-checkout-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'output/ui/freshcart-checkout-mobile.png', fullPage: true });
});

test('shopping journey with images search and next steps', async ({ page, context }) => {
  await page.goto('http://127.0.0.1:5182');
  await expect(page.getByRole('heading', { name: 'Orchard apples', exact: true })).toBeVisible();
  const images = page.locator('.product-image img');
  await expect(images).toHaveCount(12);
  await expect
    .poll(() => images.evaluateAll((nodes) => nodes.every((node) => node.complete && node.naturalWidth > 0)))
    .toBe(true);
  await page.getByRole('searchbox').fill('apple');
  await expect(page.locator('.product-grid article:visible')).toHaveCount(1);
  await page.getByRole('searchbox').fill('');
  await page.getByRole('button', { name: 'Bakery', exact: true }).click();
  await expect(page.locator('.product-grid article:visible')).toHaveCount(1);
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: 'Orchard apples', exact: true }) })
    .getByRole('button')
    .click();
  await page
    .locator('#basket-bar')
    .getByRole('link', { name: /View basket/ })
    .click();
  await page.getByRole('link', { name: /Continue to checkout/ }).click();
  await page.locator('#name').fill('Asha Rao');
  await page.locator('#street').fill('12 Lake View Rd');
  await page.locator('#city').fill('Springfield');
  await context.setOffline(true);
  await page.getByRole('button', { name: /Place order/ }).click();
  await expect(page.getByRole('link', { name: /View order confirmation/ })).toBeVisible();
  await context.setOffline(false);
  await page.getByRole('link', { name: /View order confirmation/ }).click();
  await expect(page.getByRole('heading', { name: 'Order saved', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue shopping', exact: true })).toBeVisible();
});
test('storefront desktop and mobile layout', async ({ page }) => {
  await page.goto('http://127.0.0.1:5182');
  await expect(page.getByRole('heading', { name: 'Orchard apples', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'output/ui/freshcart-storefront-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'output/ui/freshcart-storefront-mobile.png', fullPage: true });
});

for (const fixed of [false, true]) {
  test(`online order is placed and confirmed (${fixed ? 'fixed' : 'buggy'})`, async ({ page }) => {
    const base = `http://127.0.0.1:${fixed ? 5182 : 5181}`;
    await page.goto(base);
    const apple = page
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: 'Orchard apples', exact: true }) });
    await apple.getByRole('button').click();
    await page
      .locator('#basket-bar')
      .getByRole('link', { name: /View basket/ })
      .click();
    await expect(page.locator('#basket-bar')).not.toHaveClass(/visible/);
    await page.getByRole('link', { name: /Continue to checkout/ }).click();
    await expect(page.locator('#basket-bar')).not.toHaveClass(/visible/);
    await page.locator('#name').fill('Asha Rao');
    await page.locator('#street').fill('12 Lake View Rd');
    await page.locator('#city').fill('Springfield');
    await page.locator('#pin').fill('560001');
    await page.getByRole('button', { name: /Place order/ }).click();
    await expect(page).toHaveURL(/order-confirmation/, { timeout: 15000 });
    await expect(page.getByText(/Orchard apples × 1/)).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('freshcart-cart') || '[]').length)).toBe(0);
    await page.getByRole('link', { name: /View your orders/ }).click();
    await expect(page.getByRole('heading', { name: 'Your orders' })).toBeVisible();
  });
}

for (const fixed of [false, true]) {
  test(`connection drops while the order is processing (${fixed ? 'fixed' : 'buggy'})`, async ({ page, context }) => {
    test.setTimeout(60000);
    const base = `http://127.0.0.1:${fixed ? 5182 : 5181}`;
    await page.goto(base + '/checkout');
    await page.locator('#name').fill('Asha Rao');
    await page.locator('#street').fill('12 Lake View Rd');
    await page.locator('#city').fill('Springfield');
    await page.getByRole('button', { name: /Place order/ }).click();
    await expect(page.getByRole('progressbar', { name: 'Placing your order…' })).toBeVisible();
    await context.setOffline(true);
    if (fixed) {
      await expect(page.locator('#notice')).toContainText("we'll place your order", { timeout: 15000 });
      await expect(page.locator('#name')).toHaveValue('Asha Rao');
      await context.setOffline(false);
      await expect(page.locator('#notice')).toContainText('your order has been placed', { timeout: 20000 });
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('freshcart-orders') || '[]')[0].status)).toBe(
        'placed',
      );
    } else {
      await expect(page.locator('#name')).toHaveValue('', { timeout: 15000 });
      await context.setOffline(false);
      await page.waitForTimeout(1000);
      await expect(page.getByRole('progressbar')).toBeVisible();
      await expect(page.locator('#name')).toHaveValue('');
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('freshcart-orders') || '[]').length)).toBe(0);
    }
  });
}
