import { expect, test } from '@playwright/test';

test('Bodyworks lab exposes live Rapier diagnostics and drives real jump/walk input', async ({ page }) => {
  const errors: string[] = []; page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); }); page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click();
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click();
  await page.getByRole('button', { name: /^STANDARD/ }).click();
  await page.getByRole('button', { name: 'START MATCH' }).click();
  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab'); const deck = page.getByTestId('control-deck');
  await expect(lab).toBeVisible(); await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 }); await expect(hud).toHaveAttribute('data-physics-joints', '30');
  await lab.getByRole('button', { name: '0.5×' }).click(); await expect(lab).toHaveAttribute('data-lab-rate', '0.5');
  await lab.getByRole('button', { name: 'DEBUG RIG' }).click(); await expect(lab).toHaveAttribute('data-lab-debug', 'true');
  await lab.getByRole('button', { name: 'PAUSE', exact: true }).click(); await expect(lab.getByRole('button', { name: 'PLAY', exact: true })).toBeVisible();
  await lab.getByRole('button', { name: 'STEP', exact: true }).click(); await expect(lab.getByRole('button', { name: 'PLAY', exact: true })).toBeVisible();
  await lab.getByRole('button', { name: 'DEBUG RIG' }).click(); await expect(lab).toHaveAttribute('data-lab-debug', 'false');
  await lab.getByRole('button', { name: '1×' }).click(); await expect(lab).toHaveAttribute('data-lab-rate', '1');
  await lab.getByRole('button', { name: 'PLAY', exact: true }).click();
  await expect(deck).toBeVisible(); await expect(deck).toContainText('LIVE WRESTLING CONTROLS');
  for (const label of ['MOVE', 'SPRINT', 'CIRCUIT JAB', 'PISTON BOOT', 'CLOSE DISTANCE', 'GUARD (HOLD)', 'DODGE / COUNTER', 'JUMP', 'NO PROP ACTION', 'NO CONTEXT ACTION', 'SIGNATURE TAUNT']) await expect(deck).toContainText(label);
  await expect(hud).toHaveAttribute('data-player-state', 'idle');
  await page.waitForTimeout(2_500);
  const initialY = Number(await hud.getAttribute('data-player-pelvis-y'));
  await page.evaluate((startingY) => {
    const deckNode = document.querySelector('[data-testid="control-deck"]'); if (!deckNode) return;
    document.documentElement.dataset.maxJumpPelvisY = String(startingY);
    const observe = (): void => {
      const jumpActive = deckNode.querySelector('[data-control="jump"]')?.classList.contains('is-active') ?? false;
      if (jumpActive) document.documentElement.dataset.sawActiveJumpControl = 'true';
      const liveY = Number(document.querySelector('.hud')?.getAttribute('data-player-pelvis-y')); const maximum = Number(document.documentElement.dataset.maxJumpPelvisY);
      if (jumpActive && Number.isFinite(liveY) && liveY > maximum) document.documentElement.dataset.maxJumpPelvisY = String(liveY);
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true }); observe();
  }, initialY);
  const jump = lab.getByRole('button', { name: 'STANDING JUMP' }); await expect(jump).toBeEnabled(); await jump.click();
  const resetJumpY = Number(await page.locator('html').getAttribute('data-lab-reset-pelvis-y'));
  await expect(page.locator('html')).toHaveAttribute('data-saw-active-jump-control', 'true');
  await expect.poll(async () => Number(await page.locator('html').getAttribute('data-max-jump-pelvis-y')), { timeout: 3_000, intervals: [50, 100] }).toBeGreaterThan(resetJumpY + .2);
  await expect(lab.getByRole('button', { name: 'WALK + STOP' })).toBeEnabled({ timeout: 3_000 });
  const initialX = Number(await hud.getAttribute('data-player-x')); const initialZ = Number(await hud.getAttribute('data-player-z'));
  await page.evaluate(() => {
    const observe = (): void => {
      const deckNode = document.querySelector('[data-testid="control-deck"]');
      if (/MOVEMENT|STRAFE|SPRINTING/.test(deckNode?.getAttribute('data-control-state') ?? '')) {
        document.documentElement.dataset.sawLocomotionControl = 'true';
        const quick = deckNode?.querySelector('[data-control="quick"]')?.getAttribute('data-move-label') ?? '';
        const heavy = deckNode?.querySelector('[data-control="heavy"]')?.getAttribute('data-move-label') ?? '';
        if (/SKYLINE CROSS|CIRCUIT LOW KICK|NEON ONE-TWO/.test(quick)) document.documentElement.dataset.sawLocomotionQuickLabel = quick;
        if (/VOLTAGE UPPERCUT|PISTON BOOT|ARC ROUNDHOUSE|HALO HIGH KICK|RAILWAY STIFF-ARM|(?:LEFT|RIGHT) ARM STIFF-ARM/.test(heavy)) document.documentElement.dataset.sawLocomotionHeavyLabel = heavy;
      }
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true, childList: true }); observe();
  });
  await page.evaluate(({ x, z }) => {
    const liveHud = document.querySelector('.hud'); if (!liveHud) return;
    const sample = (): void => {
      const displacement = Math.hypot(Number(liveHud.getAttribute('data-player-x')) - x, Number(liveHud.getAttribute('data-player-z')) - z);
      document.documentElement.dataset.maxLabDisplacement = String(Math.max(Number(document.documentElement.dataset.maxLabDisplacement ?? 0), displacement));
    };
    new MutationObserver(sample).observe(liveHud, { attributes: true }); sample();
  }, { x: initialX, z: initialZ });
  await lab.getByRole('button', { name: 'WALK + STOP' }).click();
  await page.waitForFunction(() => Number(document.documentElement.dataset.maxLabDisplacement) > .85, null, { timeout: 8_000 });
  await expect(page.locator('html')).toHaveAttribute('data-saw-locomotion-control', 'true');
  expect(await page.locator('html').getAttribute('data-saw-locomotion-quick-label')).toMatch(/SKYLINE CROSS|CIRCUIT LOW KICK|NEON ONE-TWO/);
  expect(await page.locator('html').getAttribute('data-saw-locomotion-heavy-label')).toMatch(/VOLTAGE UPPERCUT|PISTON BOOT|ARC ROUNDHOUSE|HALO HIGH KICK|RAILWAY STIFF-ARM|(?:LEFT|RIGHT) ARM STIFF-ARM/);
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
  await expect(lab.getByRole('button', { name: 'ROPE LOAD + STIFF-ARM' })).toBeEnabled({ timeout: 3_000 });
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
  await expect(page.locator('html')).toHaveAttribute('data-saw-rope-callout', 'true', { timeout: 4_000 }); await expect(page.locator('html')).toHaveAttribute('data-saw-stiff-arm', 'true', { timeout: 4_000 });
  if (await page.locator('html').getAttribute('data-saw-stiff-arm-knockdown') !== 'true') {
    await expect(lab.getByRole('button', { name: 'ROPE LOAD + STIFF-ARM' })).toBeEnabled({ timeout: 4_000 });
    await lab.getByRole('button', { name: 'ROPE LOAD + STIFF-ARM' }).click();
  }
  await expect(page.locator('html')).toHaveAttribute('data-saw-stiff-arm-knockdown', 'true', { timeout: 5_000 });
  await expect(lab.getByRole('button', { name: 'KICK-UP RECOVERY' })).toBeEnabled({ timeout: 4_000 });
  await page.evaluate(() => {
    const observe = (): void => {
      const liveHud = document.querySelector('.hud'); const liveDeck = document.querySelector('[data-testid="control-deck"]');
      if (liveHud?.getAttribute('data-player-move') === 'kick_up') document.documentElement.dataset.sawKickUpMove = 'true';
      if (liveDeck?.getAttribute('data-control-state')?.includes('KICK-UP') && liveDeck.querySelector('[data-control="counter"]')?.classList.contains('is-active')) document.documentElement.dataset.sawKickUpControl = 'true';
    };
    new MutationObserver(observe).observe(document.body, { subtree: true, attributes: true, childList: true }); observe();
  });
  await lab.getByRole('button', { name: 'KICK-UP RECOVERY' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-saw-kick-up-move', 'true', { timeout: 4_000 });
  await expect(page.locator('html')).toHaveAttribute('data-saw-kick-up-control', 'true', { timeout: 4_000 });
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0'); expect(errors).toEqual([]);
});

test('Physics Lab exposes deterministic recovery orientations and a complete runtime reset', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/?physicsLab=1');
  await page.getByRole('button', { name: 'ENTER THE VOLT DOME' }).click(); await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.getByRole('button', { name: /LOCK IN ATLAS/ }).click(); await page.getByRole('button', { name: /^STANDARD/ }).click(); await page.getByRole('button', { name: 'START MATCH' }).click();
  const hud = page.locator('.hud'); const lab = page.getByTestId('physics-lab'); const orientation = hud.locator('[data-player-recovery-orientation]');
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 30_000 });
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
  await expect(hud).toHaveAttribute('data-physics-bodies', '32', { timeout: 20_000 }); await expect(hud).toHaveAttribute('data-physics-joints', '30');
  await expect(hud).toHaveAttribute('data-physics-emergency-resets', '0');
});
