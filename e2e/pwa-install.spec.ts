import { expect, test } from '@playwright/test';

test('RINGFALL install entry remains playable from the cached app shell without network', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'ENTER RINGFALL' })).toBeVisible();
  await expect(page.getByRole('button', { name: /INSTALL RINGFALL|INSTALL \/ ADD TO HOME SCREEN/ })).toBeVisible();

  const cacheState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { supported: false, controlled: false, cache: false, cachedHome: false, cachedApi: false };
    await navigator.serviceWorker.ready;
    await new Promise<void>(resolve => {
      if (navigator.serviceWorker.controller) return resolve();
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
      window.setTimeout(resolve, 5000);
    });
    const cacheNames = await caches.keys();
    const shell = cacheNames.includes('ringfall-shell-v1') ? await caches.open('ringfall-shell-v1') : null;
    const keys = shell ? (await shell.keys()).map(request => new URL(request.url).pathname) : [];
    return { supported: true, controlled: !!navigator.serviceWorker.controller, cache: !!shell, keys, cachedAssetCount: keys.filter(path => path.startsWith('/assets/')).length, cachedHome: keys.includes('/'), cachedApi: keys.some(path => path.startsWith('/api/')) };
  });
  expect(cacheState).toMatchObject({ supported: true, controlled: true, cache: true, cachedHome: true, cachedApi: false });
  expect(cacheState.cachedAssetCount).toBeGreaterThan(0);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'ENTER RINGFALL' })).toBeVisible();
  await context.setOffline(false);
});
