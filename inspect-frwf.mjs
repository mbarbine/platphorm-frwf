import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' });
console.log('url', page.url());
await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
await page.getByRole('button', { name: 'PLAY', exact: true }).click();
await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
await page.getByRole('button', { name: /^SINGLES/ }).click();
await page.getByRole('button', { name: /^STANDARD/ }).click();
await page.getByRole('button', { name: 'START MATCH' }).click();
const canvas = page.getByTestId('game-canvas');
await canvas.waitFor({ state: 'visible', timeout: 30000 });
const attrs = await canvas.evaluate((node) => ({
  draw: Number(node.getAttribute('data-draw-calls')),
  tris: Number(node.getAttribute('data-triangles')),
  tier: node.getAttribute('data-graphics-tier'),
  bodies: node.getAttribute('data-physics-bodies'),
  x: node.getAttribute('data-player-x'),
  z: node.getAttribute('data-player-z'),
  readiness: node.getAttribute('data-simulation-ready'),
}));
console.log('canvas attrs', attrs);
for (let i = 0; i < 10; i += 1) {
  const tick = await canvas.evaluate((node) => ({
    draw: Number(node.getAttribute('data-draw-calls')),
    tris: Number(node.getAttribute('data-triangles')),
    fps: node.getAttribute('data-frame-p95-ms'),
  }));
  console.log('sample', i, tick);
  await page.waitForTimeout(300);
}
await canvas.screenshot({ path: '/tmp/frwf-game.png' });
await browser.close();
