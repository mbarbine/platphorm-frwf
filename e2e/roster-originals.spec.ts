import { expect, test } from '@playwright/test';
import { FIGHTERS } from '../src/game/data/fighters';
import { FIGHTER_PORTRAITS } from '../src/game/data/fighterPortraits';

for (const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]) {
  test(`original photos and live wrestlers remain selectable at ${viewport.width}x${viewport.height}`, async ({page}, info) => {
    await page.setViewportSize(viewport);
    const errors: string[] = []; page.on('pageerror',error => errors.push(error.message));
    await page.goto('/');
    await page.getByRole('button',{name:'ENTER THE VOLT DOME'}).click();
    await page.getByRole('button',{name:'PLAY',exact:true}).click();
    await expect(page.locator('[data-fighter-select-id]')).toHaveCount(FIGHTERS.length);
    for (const fighter of FIGHTERS) {
      const button = page.locator(`[data-fighter-select-id="${fighter.id}"]`);
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed','true');
      await expect(page.locator('.fighter-preview')).toHaveAttribute('data-fighter-ready',fighter.id,{timeout:30000});
      if (FIGHTER_PORTRAITS[fighter.id]) {
        await expect(page.locator('.selection-photo img')).toBeVisible();
        await expect.poll(() => page.locator('.selection-photo img').evaluate((img:HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      }
      const confirm=page.getByRole('button',{name:new RegExp('^LOCK IN')});
      const box=await confirm.boundingBox();
      expect(box).not.toBeNull();
      if (box) { expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y+box.height).toBeLessThanOrEqual(viewport.height+1); }
      if (['chad','justin','mondo','gil','wrecking_ball'].includes(fighter.id)) await page.screenshot({path:info.outputPath(`${fighter.id}.png`)});
    }
    await page.getByRole('button',{name:/^LOCK IN/}).click();
    await expect(page.getByRole('button',{name:'START MATCH'})).toBeVisible();
    expect(errors).toEqual([]);
  });
}
