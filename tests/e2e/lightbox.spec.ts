import { test, expect } from '@playwright/test';
import { KNOWN, sitemapPaths } from './helpers.ts';

test.describe('achievement lightbox', () => {
  test('opens on click, moves with arrows, closes on Escape and returns focus', async ({ page, request }) => {
    test.slow();
    // find an achievement page with at least two gallery triggers
    const candidates = [KNOWN.achievementWithGallery, ...(await sitemapPaths(request)).filter((p) => p.startsWith('/achievements/'))];
    // Lightbox triggers: the achievements builder's `.lb-trigger`, or generic PhotoSwipe/gallery anchors (never the local-graph SVG links).
    const trigger = page.locator('main .lb-trigger, main a[data-pswp-width], main .gallery a[href]').filter({ hasNot: page.locator('.local-graph') });
    let opened = '';
    for (const path of candidates.slice(0, 12)) {
      const res = await page.goto(path);
      if (!res || res.status() !== 200) continue;
      if ((await trigger.count()) >= 2) {
        opened = path;
        break;
      }
    }
    expect(opened, 'an achievement page with a gallery').not.toBe('');

    const first = trigger.first();
    await first.scrollIntoViewIfNeeded();
    await first.focus();
    await first.click();
    const pswp = page.locator('.pswp.pswp--open');
    await expect(pswp).toBeVisible({ timeout: 10_000 });
    const counter = page.locator('.pswp__counter');
    await expect(counter).toContainText(/1\s*\/\s*\d+/);
    await page.waitForTimeout(600); // PhotoSwipe ignores navigation keys until its opening animation (333 ms) has finished

    await page.keyboard.press('ArrowRight');
    await expect(counter).toContainText(/2\s*\/\s*\d+/);
    await page.keyboard.press('ArrowLeft');
    await expect(counter).toContainText(/1\s*\/\s*\d+/);

    await page.keyboard.press('Escape');
    await expect(pswp).toBeHidden({ timeout: 5_000 });
    const focusedBack = await first.evaluate((el) => el === document.activeElement || el.contains(document.activeElement));
    expect(focusedBack, 'focus returns to the trigger').toBe(true);
  });

  test('the certificate slot is labelled and stays in colour', async ({ page, request }) => {
    const paths = (await sitemapPaths(request)).filter((p) => p.startsWith('/achievements/'));
    let found = false;
    for (const path of [KNOWN.achievementWithGallery, ...paths].slice(0, 20)) {
      const res = await page.goto(path);
      if (!res || res.status() !== 200) continue;
      const cert = page.locator('.is-certificate').first();
      if (await cert.count()) {
        await expect(page.locator('main').getByText(/Certificate/).first()).toBeVisible();
        const filter = await cert.evaluate((el) => getComputedStyle(el).filter);
        expect(filter === 'none' || !/grayscale\((?!0)/.test(filter)).toBe(true);
        found = true;
        break;
      }
    }
    expect(found, 'at least one achievement shows a certificate').toBe(true);
  });
});
