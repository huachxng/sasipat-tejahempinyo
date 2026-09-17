import { test, expect, type Page } from '@playwright/test';

// Scroll openers (plan §2, §3, §6, §8, §9): /achievements (photo + numeral pre-roll) and /research (BIS line draw-in).
// Motion on: the scene arms, pins, and `--scene-p` reaches 1 at the end of the track. Reduced motion, the footer
// toggle and no-JS all leave the static frame: no arm, no pin, everything revealed.

const PAGES = ['/achievements', '/research'] as const;
const pad = (n: number) => String(n).padStart(2, '0');
/** `calc(0.53px)` / `0%` / `1px` → number (Chromium reports the computed dash offset as a calc string). */
const num = (s: string) => parseFloat(s.replace(/[^0-9.\-]/g, '')) || 0;

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

/** Scroll so the scene is at the end of its track (p = 1). */
const scrollToEnd = (page: Page) =>
  page.evaluate(() => {
    const s = document.querySelector<HTMLElement>('[data-scene]')!;
    const stage = s.querySelector<HTMLElement>('.scene-stage')!;
    window.scrollTo(0, s.offsetTop + s.offsetHeight - stage.offsetHeight);
  });

const sceneP = (page: Page) =>
  page.evaluate(() => Number(getComputedStyle(document.querySelector('[data-scene]')!).getPropertyValue('--scene-p') || 0));

const staticFrame = async (page: Page, path: string) => {
  const scene = page.locator('[data-scene]');
  await expect(scene).toBeAttached();
  await expect(scene).not.toHaveClass(/is-armed/);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.scene-stage')!).position)).not.toBe('sticky');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-scene]')!).getPropertyValue('--scene-p').trim())).toBe('');
  if (path === '/achievements') {
    const total = await page.locator('main article').count();
    await expect(scene.locator('[data-open-num]')).toHaveText(pad(total));
    await expect(scene.locator('img')).toBeVisible();
  } else {
    await expect(scene.locator('svg path[data-line]')).toBeAttached();
    expect(num(await scene.locator('path[data-line]').evaluate((el) => getComputedStyle(el).strokeDashoffset))).toBe(0);
    for (const sig of await scene.locator('.res-sig').all()) expect(await sig.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  }
};

for (const path of PAGES) {
  test.describe(`${path} opener`, () => {
    test('arms, pins and drives --scene-p to 1 at the end of the track', async ({ page }) => {
      await page.goto(path, { waitUntil: 'load' });
      const scene = page.locator('[data-scene]');
      await expect(scene).toHaveClass(/is-armed/);
      expect(await noHorizontalScroll(page)).toBe(true);
      expect(await page.evaluate(() => getComputedStyle(document.querySelector('.scene-stage')!).position)).toBe('sticky');
      // desktop budget: stage one viewport, track two
      const dims = await page.evaluate(() => {
        const s = document.querySelector<HTMLElement>('[data-scene]')!;
        return { track: s.offsetHeight, stage: s.querySelector<HTMLElement>('.scene-stage')!.offsetHeight, vh: innerHeight };
      });
      expect(dims.stage).toBeLessThanOrEqual(dims.vh + 1);
      expect(dims.track).toBeLessThanOrEqual(dims.vh * 2 + 1);

      if (path === '/achievements') {
        await expect(scene.locator('[data-open-num]')).toHaveText('00');
        const total = await page.locator('main article').count();
        await scrollToEnd(page);
        await expect.poll(() => scene.locator('[data-open-num]').textContent()).toBe(pad(total));
      } else {
        expect(num(await scene.locator('path[data-line]').evaluate((el) => getComputedStyle(el).strokeDashoffset))).toBeGreaterThan(0.9);
        await scrollToEnd(page);
        await expect.poll(async () => num(await scene.locator('path[data-line]').evaluate((el) => getComputedStyle(el).strokeDashoffset))).toBe(0);
        const sigs = scene.locator('.res-sig');
        expect(await sigs.count()).toBe(3);
        for (const sig of await sigs.all()) await expect.poll(() => sig.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
      }
      await expect.poll(() => sceneP(page)).toBeGreaterThanOrEqual(0.98);
      await expect(scene).toHaveClass(/is-done/);
      expect(await noHorizontalScroll(page)).toBe(true);
    });

    test('keeps the h1 and chapter number inside the scene', async ({ page }) => {
      await page.goto(path);
      const h1 = page.locator('[data-scene] h1');
      await expect(h1).toBeVisible();
      await expect(h1).toContainText(path === '/achievements' ? /Achievements/ : /Research/);
      await expect(page.locator('[data-scene] h1 .num')).toHaveAttribute('style', /view-transition-name: chapter-0[13]/);
    });

    test.describe('with prefers-reduced-motion', () => {
      test.use({ reducedMotion: 'reduce' });
      test('never arms and shows the static frame', async ({ page }) => {
        await page.goto(path, { waitUntil: 'load' });
        await page.waitForTimeout(300);
        await staticFrame(page, path);
      });
    });

    test('honours the footer motion toggle (data-motion=off)', async ({ page }) => {
      await page.addInitScript(() => {
        try {
          localStorage.setItem('motion', 'off');
        } catch {}
      });
      await page.goto(path, { waitUntil: 'load' });
      await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
      await page.waitForTimeout(300);
      await staticFrame(page, path);
    });

    test('un-arms live when the toggle flips mid-page', async ({ page }) => {
      await page.goto(path, { waitUntil: 'load' });
      const scene = page.locator('[data-scene]');
      await expect(scene).toHaveClass(/is-armed/);
      await page.evaluate(() => {
        document.documentElement.dataset.motion = 'off';
        dispatchEvent(new CustomEvent('motionchange'));
      });
      await expect(scene).not.toHaveClass(/is-armed/);
      await staticFrame(page, path);
    });

    test('renders the static frame without JavaScript', async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(path);
      await staticFrame(page, path);
      if (path === '/research') await expect(page.locator('main svg').first()).toBeAttached();
      await context.close();
    });

    test.describe('phone', () => {
      test.use({ viewport: { width: 375, height: 720 }, isMobile: true, hasTouch: true });
      test('stage ≤ 70 % of the viewport, track ≤ 1.5 viewports, no horizontal scroll', async ({ page }) => {
        await page.goto(path, { waitUntil: 'load' });
        expect(await noHorizontalScroll(page)).toBe(true);
        const dims = await page.evaluate(() => {
          const s = document.querySelector<HTMLElement>('[data-scene]')!;
          return { track: s.offsetHeight, stage: s.querySelector<HTMLElement>('.scene-stage')!.offsetHeight, vh: innerHeight };
        });
        expect(dims.stage).toBeLessThanOrEqual(dims.vh * 0.7 + 2);
        expect(dims.track).toBeLessThanOrEqual(dims.vh * 1.5 + 1);
        await scrollToEnd(page);
        await expect.poll(() => sceneP(page)).toBeGreaterThanOrEqual(0.98);
        expect(await noHorizontalScroll(page)).toBe(true);
      });
    });
  });
}
