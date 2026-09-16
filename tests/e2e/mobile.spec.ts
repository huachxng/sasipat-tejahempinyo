import { test, expect } from '@playwright/test';
import { KNOWN } from './helpers.ts';

test.describe('375 px viewport', () => {
  test.use({ viewport: { width: 375, height: 720 }, isMobile: true, hasTouch: true });

  for (const path of ['/', '/achievements', KNOWN.note]) {
    test(`${path} has no horizontal scroll`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'load' });
      await page.waitForTimeout(500);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth, `${path}: scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`).toBeLessThanOrEqual(clientWidth + 1);
    });
  }

  test('the menu button opens the chapter dialog', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-menu-open]').click();
    const menu = page.locator('dialog#site-menu');
    await expect(menu).toHaveAttribute('open', /.*/);
    await expect(menu.getByRole('link', { name: /achievements/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).not.toHaveAttribute('open', /.*/);
  });
});
