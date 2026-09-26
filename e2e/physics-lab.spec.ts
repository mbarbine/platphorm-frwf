import { expect, test } from '@playwright/test';

test('Bodyworks lab exposes live Rapier diagnostics and drives real jump/walk input', async ({ page }) => {
  test.setTimeout(480_000);
  page.setDefaultTimeout(15_000);
  const errors: string[] = []; page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); }); page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER RINGFALL' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^SINGLES/ }).click({ timeout: 5_000 });
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: /^FRWF ARENA/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab'); const deck = page.getByTestId('control-deck');
  await expect(page.locator('html')).toHaveAttribute('data-fighters-ready', 'true', { timeout: 60_000 });
  await expect(lab).toBeVisible(); await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 }); await expect(hud).toHaveAttribute('data-physics-joints', '30');
  await lab.getByRole('button', { name: '0.5×' }).click(); await expect(lab).toHaveAttribute('data-lab-rate', '0.5');
  await lab.getByRole('button', { name: 'COLLISION OVERLAY' }).click(); await expect(lab).toHaveAttribute('data-lab-debug', 'true');
  await lab.getByRole('button', { name: 'PAUSE', exact: true }).click(); await expect(lab.getByRole('button', { name: 'PLAY', exact: true })).toBeVisible();
  await lab.getByRole('button', { name: 'STEP', exact: true }).click(); await expect(lab.getByRole('button', { name: 'PLAY', exact: true })).toBeVisible();
  await lab.getByRole('button', { name: 'COLLISION OVERLAY' }).click(); await expect(lab).toHaveAttribute('data-lab-debug', 'false');
  await lab.getByRole('button', { name: '1×' }).click(); await expect(lab).toHaveAttribute('data-lab-rate', '1');
  await lab.getByRole('button', { name: 'PLAY', exact: true }).click();
  await expect(deck).toBeVisible(); await expect(deck).toContainText('LIVE WRESTLING CONTROLS');
  for (const label of ['CIRCUIT JAB', 'PISTON BOOT', 'COLLAR REACH (MISS)', 'GUARD (HOLD)', 'DODGE / COUNTER']) await expect(deck).toContainText(label);
  await expect(hud).toHaveAttribute('data-player-state', 'idle');
  await page.waitForTimeout(2_500);
  const initialY = Number(await hud.getAttribute('data-player-pelvis-y'));
  await page.evaluate((startingY) => {
    document.documentElement.dataset.maxJumpPelvisY = String(startingY);
    const observe = (): void => {
      const liveY = Number(document.querySelector('.hud')?.getAttribute('data-player-pelvis-y')); const maximum = Number(document.documentElement.dataset.maxJumpPelvisY);
      if (Number.isFinite(liveY) && liveY > maximum) document.documentElement.dataset.maxJumpPelvisY = String(liveY);
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true }); observe();
  }, initialY);
  const jump = lab.getByRole('button', { name: 'STANDING JUMP' }); await expect(jump).toBeEnabled(); await jump.click();
  const resetJumpY = Number(await page.locator('html').getAttribute('data-lab-reset-pelvis-y'));
  await expect.poll(async () => Number(await page.locator('html').getAttribute('data-max-jump-pelvis-y')), { timeout: 3_000, intervals: [50, 100] }).toBeGreaterThan(resetJumpY + .2);
  await expect(lab).toHaveAttribute('data-lab-scenario', 'idle', { timeout: 10_000 });
  await expect(lab.getByRole('button', { name: 'WALK + STOP' })).toBeEnabled();
  const initialX = Number(await hud.getAttribute('data-player-x')); const initialZ = Number(await hud.getAttribute('data-player-z'));
  await page.evaluate(() => {
    const observe = (): void => {
      const deckNode = document.querySelector('[data-testid="control-deck"]');
      if (/MOVEMENT|STRAFE|SPRINTING/.test(deckNode?.getAttribute('data-control-state') ?? '')) {
        document.documentElement.dataset.sawLocomotionControl = 'true';
      }
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true, childList: true }); observe();
  });
  await page.evaluate(({ x, z }) => {
    const liveHud = document.querySelector('.hud'); if (!liveHud) return;
    const sample = (): void => {
      const originX = Number(document.documentElement.dataset.locomotionOriginX ?? x); const originZ = Number(document.documentElement.dataset.locomotionOriginZ ?? z);
      const displacement = Math.hypot(Number(liveHud.getAttribute('data-player-x')) - originX, Number(liveHud.getAttribute('data-player-z')) - originZ);
      document.documentElement.dataset.maxLabDisplacement = String(Math.max(Number(document.documentElement.dataset.maxLabDisplacement ?? 0), displacement));
    };
    document.documentElement.dataset.locomotionOriginX = String(x); document.documentElement.dataset.locomotionOriginZ = String(z);
    new MutationObserver(sample).observe(liveHud, { attributes: true }); sample();
  }, { x: initialX, z: initialZ });
  await page.evaluate(() => {
    const root = document.documentElement; const speed = document.querySelector('[data-player-physics-speed]');
    if (!speed) return;
    root.dataset.locomotionPeakSpeed = '0';
    const sample = (): void => {
      const value = Number(speed.getAttribute('data-player-physics-speed'));
      root.dataset.locomotionPeakSpeed = String(Math.max(Number(root.dataset.locomotionPeakSpeed ?? 0), value));
    };
    new MutationObserver(sample).observe(speed, { attributes: true, attributeFilter: ['data-player-physics-speed'] }); sample();
  });
  await lab.getByRole('button', { name: 'WALK + STOP' }).click();
  await expect(lab).toHaveAttribute('data-lab-scenario', 'walk');
  await page.waitForFunction(() => Number(document.documentElement.dataset.maxLabDisplacement) > .85, null, { timeout: 8_000 });
  await expect(lab).toHaveAttribute('data-lab-scenario', 'idle', { timeout: 8_000 });
  const walkingPeak = Number(await page.locator('html').getAttribute('data-locomotion-peak-speed'));
  expect(walkingPeak).toBeGreaterThan(.5);
  await expect(lab).toHaveAttribute('data-lab-foot-plant-drift', /^\d+\.\d{4}$/);
  const plantedFootDrift = Number(await lab.getAttribute('data-lab-foot-plant-drift'));
  expect(plantedFootDrift, 'a physically supported foot should stay within 2 cm of its stance anchor').toBeLessThanOrEqual(.02);
  await page.locator('html').evaluate(element => { (element as HTMLElement).dataset.locomotionPeakSpeed = '0'; });
  await lab.getByRole('button', { name: 'RUN + MOMENTUM' }).click();
  await expect(lab).toHaveAttribute('data-lab-scenario', 'run');
  await page.waitForFunction((walkingSpeed) => Number(document.documentElement.dataset.locomotionPeakSpeed) > walkingSpeed * 1.35, walkingPeak, { timeout: 5_000 });
  await expect(lab).toHaveAttribute('data-lab-scenario', 'idle', { timeout: 8_000 });
  const runningPeak = Number(await page.locator('html').getAttribute('data-locomotion-peak-speed'));
  expect(runningPeak).toBeGreaterThan(walkingPeak * 1.35);
  await expect(lab).toHaveAttribute('data-lab-foot-plant-drift', /^\d+\.\d{4}$/);
  const runningFootDrift = Number(await lab.getAttribute('data-lab-foot-plant-drift'));
  expect(runningFootDrift, 'a physically supported running foot should stay within 2 cm of its stance anchor').toBeLessThanOrEqual(.02);
  await expect(page.locator('html')).toHaveAttribute('data-saw-locomotion-control', 'true');
  for (const [label, scenario] of [['BACKPEDAL + STOP', 'backstep'], ['STRAFE + STOP', 'strafe']] as const) {
    await page.locator('html').evaluate((root) => {
      const element = root as HTMLElement; const liveHud = document.querySelector('.hud');
      element.dataset.locomotionOriginX = liveHud?.getAttribute('data-player-x') ?? '0'; element.dataset.locomotionOriginZ = liveHud?.getAttribute('data-player-z') ?? '0'; element.dataset.maxLabDisplacement = '0';
    });
    await lab.getByRole('button', { name: label }).click();
    await expect(lab).toHaveAttribute('data-lab-scenario', scenario);
    await page.waitForFunction(() => Number(document.documentElement.dataset.maxLabDisplacement) > .45, null, { timeout: 8_000 });
    await expect(lab).toHaveAttribute('data-lab-scenario', 'idle', { timeout: 10_000 });
    await expect(lab).toHaveAttribute('data-lab-foot-plant-drift', /^\d+\.\d{4}$/);
    const drift = Number(await lab.getAttribute('data-lab-foot-plant-drift'));
    expect(drift, `${label.toLowerCase()} supported-foot drift`).toBeLessThanOrEqual(.02);
  }
  await page.evaluate(() => {
    const observe = (): void => {
      const deckNode = document.querySelector('[data-testid="control-deck"]');
      if (deckNode?.getAttribute('data-control-state')?.includes('CIRCUIT JAB')) document.documentElement.dataset.sawJabControl = 'true';
      if (deckNode?.querySelector('[data-control="quick"]')?.classList.contains('is-active')) document.documentElement.dataset.sawActiveQuickControl = 'true';
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true, childList: true }); observe();
  });
  await expect(lab.getByRole('button', { name: 'CONTACT-TRUE JAB' })).toBeEnabled({ timeout: 4_000 }); const healthBeforeJab = Number(await hud.getAttribute('data-opponent-health')); await lab.getByRole('button', { name: 'CONTACT-TRUE JAB' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-saw-active-quick-control', 'true'); await expect(page.locator('html')).toHaveAttribute('data-saw-jab-control', 'true');
  await expect.poll(async () => Number(await hud.getAttribute('data-opponent-health')), { timeout: 12_000, intervals: [80, 120, 240] }).toBeLessThan(healthBeforeJab);
  await expect(lab).toHaveAttribute('data-lab-scenario', 'idle', { timeout: 10_000 });
  await page.evaluate(() => {
    const observe = (): void => {
      const liveHud = document.querySelector('.hud'); const liveDeck = document.querySelector('[data-testid="control-deck"]');
      const kick = /front_kick|low_kick|high_kick|roundhouse/.test(liveHud?.getAttribute('data-player-move') ?? '');
      if (kick) document.documentElement.dataset.sawDirectionalKick = 'true';
      if (kick && liveDeck?.querySelector('[data-control="heavy"]')?.classList.contains('is-active')) document.documentElement.dataset.sawActiveKickControl = 'true';
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true, childList: true }); observe();
  });
  await expect(lab.getByRole('button', { name: 'DIRECTIONAL KICK' })).toBeEnabled({ timeout: 3_000 }); await lab.getByRole('button', { name: 'DIRECTIONAL KICK' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-saw-directional-kick', 'true'); await expect(page.locator('html')).toHaveAttribute('data-saw-active-kick-control', 'true');
  await expect.poll(async () => Number(await hud.getAttribute('data-opponent-health')), { timeout: 4_000, intervals: [80, 120] }).toBeLessThan(100);
  await expect(lab).toHaveAttribute('data-lab-scenario', 'idle', { timeout: 10_000 });
  await expect(lab.getByRole('button', { name: 'BLOCK WINDOW' })).toBeEnabled({ timeout: 3_000 });
  await page.evaluate(() => {
    const observe = (): void => {
      const liveHud = document.querySelector('.hud'); const liveDeck = document.querySelector('[data-testid="control-deck"]');
      if (liveHud?.getAttribute('data-player-state') === 'blocking') document.documentElement.dataset.sawGuardState = 'true';
      if (liveDeck?.querySelector('[data-control="block"]')?.classList.contains('is-active')) document.documentElement.dataset.sawActiveGuardControl = 'true';
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true, childList: true }); observe();
  });
  await lab.getByRole('button', { name: 'BLOCK WINDOW' }).click(); await expect(page.locator('html')).toHaveAttribute('data-saw-guard-state', 'true'); await expect(page.locator('html')).toHaveAttribute('data-saw-active-guard-control', 'true');
  await expect(lab).toHaveAttribute('data-lab-scenario', 'idle', { timeout: 10_000 });
  await expect(lab.getByRole('button', { name: 'ROPE LOAD + STIFF-ARM' })).toBeEnabled();
  await page.evaluate(() => {
    const liveHud = document.querySelector('.hud'); const deckNode = document.querySelector('[data-testid="control-deck"]'); if (!liveHud || !deckNode) return;
    const observe = (): void => {
      if (liveHud.getAttribute('data-player-move') === 'stiff_arm') document.documentElement.dataset.sawStiffArm = 'true';
      if (document.documentElement.dataset.sawStiffArm === 'true' && /downed|airborne/.test(liveHud.getAttribute('data-opponent-state') ?? '')) document.documentElement.dataset.sawStiffArmKnockdown = 'true';
      if (deckNode.getAttribute('data-control-state')?.includes('ROPES LOADED') || deckNode.textContent?.includes('STIFF-ARM!')) document.documentElement.dataset.sawRopeCallout = 'true';
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true, childList: true }); observe();
  });
  await lab.getByRole('button', { name: 'ROPE LOAD + STIFF-ARM' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-saw-rope-callout', 'true', { timeout: 90_000 }); await expect(page.locator('html')).toHaveAttribute('data-saw-stiff-arm', 'true', { timeout: 90_000 });
  if (await page.locator('html').getAttribute('data-saw-stiff-arm-knockdown') !== 'true') {
    await expect(lab.getByRole('button', { name: 'ROPE LOAD + STIFF-ARM' })).toBeEnabled({ timeout: 90_000 });
    await lab.getByRole('button', { name: 'ROPE LOAD + STIFF-ARM' }).click();
  }
  await expect(page.locator('html')).toHaveAttribute('data-saw-stiff-arm-knockdown', 'true', { timeout: 90_000 });
  await expect(lab.getByRole('button', { name: 'GET-UP BUTTON' })).toBeEnabled({ timeout: 4_000 });
  await page.evaluate(() => {
    const observe = (): void => {
      const liveHud = document.querySelector('.hud'); const liveDeck = document.querySelector('[data-testid="control-deck"]');
      if (liveHud?.getAttribute('data-player-state') === 'recovering') document.documentElement.dataset.sawKickUpMove = 'true';
      if (liveDeck?.getAttribute('data-control-state')?.includes('GETTING UP') && liveDeck.querySelector('[data-control="counter"]')?.classList.contains('is-active')) document.documentElement.dataset.sawKickUpControl = 'true';
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true, childList: true }); observe();
  });
  await lab.getByRole('button', { name: 'GET-UP BUTTON' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-saw-kick-up-move', 'true', { timeout: 4_000 });
  await expect(page.locator('html')).toHaveAttribute('data-saw-kick-up-control', 'true', { timeout: 4_000 });
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0'); expect(errors).toEqual([]);
});

test('Physics Lab exposes deterministic recovery orientations and a complete runtime reset', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER RINGFALL' }).click(); await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click(); await page.getByRole('button', { name: /^STANDARD/ }).click(); await page.getByRole('button', { name: 'START MATCH' }).click();
  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab'); const orientation = hud.locator('[data-player-recovery-orientation]');
  await expect(hud).toHaveAttribute('data-physics-bodies', '80', { timeout: 30_000 });
  for (const [button, expected] of [['BACK GET-UP', 'back'], ['FRONT GET-UP', 'front'], ['SIDE GET-UP', 'left']] as const) {
    await lab.getByRole('button', { name: button }).click();
    await expect(orientation).toHaveAttribute('data-player-recovery-orientation', expected);
    await expect(lab).toHaveAttribute('data-lab-scenario', 'idle', { timeout: 4_000 });
    await expect.poll(async () => JSON.stringify({
      state: await hud.getAttribute('data-player-state'),
      balance: Number(await hud.getAttribute('data-player-balance')),
      upright: Number(await hud.getAttribute('data-player-upright')),
      supportFeet: Number(await hud.getAttribute('data-player-support-feet')),
      supportScore: Number(await hud.locator('[data-support-score]').getAttribute('data-support-score')),
      verticalVelocity: Number(await hud.getAttribute('data-player-vertical')),
      pelvisY: Number(await hud.getAttribute('data-player-pelvis-y')),
      footY: Number(await hud.getAttribute('data-player-foot-y')),
      leftFootY: Number(await hud.getAttribute('data-player-left-foot-y')),
      rightFootY: Number(await hud.getAttribute('data-player-right-foot-y')),
      restFootOffsetY: Number(await hud.getAttribute('data-player-rest-foot-offset-y')),
    }), { timeout: 120_000, intervals: [80, 160, 320, 640, 1_000] }).toContain('"state":"idle"');
    await expect(hud.locator('[data-motion-tasks]')).toHaveAttribute('data-motion-tasks', '0');
    await expect(hud.locator('[data-unknown-falls]')).toHaveAttribute('data-unknown-falls', '0');
    await expect.poll(async () => Number(await hud.getAttribute('data-player-support-feet')), { timeout: 15_000, intervals: [50, 100, 250] }).toBeGreaterThanOrEqual(1);
  }
  const runtimeBefore = await hud.getAttribute('data-runtime-id');
  await lab.getByRole('button', { name: 'COMPLETE RUNTIME RESET' }).click();
  await expect.poll(async () => await hud.getAttribute('data-runtime-id'), { timeout: 10_000, intervals: [100, 250] }).not.toBe(runtimeBefore);
  await expect(hud).toHaveAttribute('data-physics-bodies', '80', { timeout: 20_000 }); await expect(hud).toHaveAttribute('data-physics-joints', '75');
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
});
