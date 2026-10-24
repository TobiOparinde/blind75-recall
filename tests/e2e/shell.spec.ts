import { expect, test } from '@playwright/test';

const viewports = [[375,667], [390,844], [430,932], [667,375], [844,390], [932,430], [820,1180], [320,568], [1024,768]] as const;

for (const [width, height] of viewports) {
  test(`shell fits ${width}x${height} without errors or clipping`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Blind 75 Recall' })).toBeVisible();
    await expect(page.getByText('75 problems in the collection.')).toBeVisible();
    const layout = await page.evaluate(() => {
      const main = document.querySelector('main')!;
      const box = main.getBoundingClientRect();
      const content = document.querySelector('.seed-count')!.getBoundingClientRect();
      return {
        pageWidth: document.documentElement.scrollWidth,
        pageHeight: document.documentElement.scrollHeight,
        mainOverflows: main.scrollWidth > main.clientWidth,
        contentFits: content.left >= box.left && content.right <= box.right && content.bottom <= box.bottom,
        background: getComputedStyle(document.body).backgroundColor,
        overflow: getComputedStyle(main).overflowY,
      };
    });
    expect(layout.pageWidth).toBeLessThanOrEqual(width);
    expect(layout.pageHeight).toBeLessThanOrEqual(height);
    expect(layout.mainOverflows).toBe(false);
    expect(layout.contentFits).toBe(true);
    expect(layout.overflow).toBe('auto');
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('shell.png') });
  });
}

test('shell survives rotation and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByText('75 problems in the collection.')).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--motion-duration').trim())).toMatch(/^0(?:ms|s)$/);
});

test('production shell and bundled seed reload offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  // The first load may not be controlled until the service worker activates.
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Blind 75 Recall' })).toBeVisible();
  await expect(page.getByText('75 problems in the collection.')).toBeVisible();
});

test('manifest, icons and iOS metadata support installation', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png');
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json() as { display: string; orientation: string; start_url: string; scope: string; icons: { src: string; sizes: string; purpose: string }[] };
  expect(manifest).toMatchObject({ display: 'standalone', orientation: 'any', start_url: '/', scope: '/' });
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512', '512x512']);
  for (const icon of [...manifest.icons, { src: '/apple-touch-icon.png', sizes: '180x180', purpose: 'any' }]) {
    const asset = await request.get(icon.src);
    expect(asset.ok()).toBe(true);
    const png = await asset.body();
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes);
  }
});
