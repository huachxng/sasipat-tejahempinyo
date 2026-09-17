import { test, expect, type Page } from '@playwright/test';

/** Whether this browser would give the hero a real (non-software) WebGL2 context, i.e. which renderer hero-graph.ts picks. */
const webgl2Available = (page: Page) => page.evaluate(() => !!document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true }));

test.describe('home hero', () => {
  test('shows the inline SVG poster before any JavaScript runs', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    const poster = page.locator('.hero svg').first();
    await expect(poster).toBeVisible();
    expect(await page.locator('.hero svg a[href^="/"]').count(), 'poster nodes are real links').toBeGreaterThan(0);
    await expect(page.locator('canvas.hero-gl')).toBeHidden();
    await expect(page.locator('.hero h1')).toContainText(/SASIPAT/i);
    await context.close();
  });

  test('mounts the canvas after load and fades the poster', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    const canvas = page.locator('canvas.hero-gl');
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
    await expect
      .poll(async () => page.locator('.hero svg').first().evaluate((el) => Number(getComputedStyle(el).opacity)), { timeout: 5_000 })
      .toBeLessThan(0.05);
    await expect(page.locator('.hero').getByRole('heading', { name: /most connected notes/i })).toBeAttached();
    const hero = page.locator('[data-hero]');
    await expect(hero).toHaveAttribute('data-renderer', /^(gl|2d)$/);
    // CI Chromium runs SwiftShader, so this usually exercises the 2D path there; developer machines with a GPU take the GL path.
    await expect(hero).toHaveAttribute('data-renderer', (await webgl2Available(page)) ? 'gl' : '2d');
  });

  test('falls back to Canvas 2D when WebGL2 is unavailable', async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        return type === 'webgl2' ? null : (orig as (this: HTMLCanvasElement, t: string, ...r: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof orig;
    });
    await page.goto('/', { waitUntil: 'load' });
    await expect(page.locator('canvas.hero-gl')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-hero]')).toHaveAttribute('data-renderer', '2d');
  });

  test.describe('WebGL context loss', () => {
    test('survives a restored loss and falls back to Canvas 2D after an unrestored one', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'WEBGL_lose_context is exercised on Chromium');
      await page.goto('/', { waitUntil: 'load' });
      const hero = page.locator('[data-hero]');
      await expect(hero).toHaveAttribute('data-renderer', /^(gl|2d)$/, { timeout: 10_000 });
      test.skip((await hero.getAttribute('data-renderer')) !== 'gl', 'this browser took the Canvas path (no real GPU)');
      await page.evaluate(() => {
        const gl = document.querySelector<HTMLCanvasElement>('canvas.hero-gl')!.getContext('webgl2')!;
        const ext = gl.getExtension('WEBGL_lose_context')!;
        ext.loseContext();
        setTimeout(() => ext.restoreContext(), 200);
      });
      await page.waitForTimeout(800);
      await expect(page.locator('canvas.hero-gl')).toBeVisible();
      await expect(hero).toHaveAttribute('data-renderer', 'gl');
      await page.evaluate(() => document.querySelector<HTMLCanvasElement>('canvas.hero-gl')!.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext());
      await expect(hero).toHaveAttribute('data-renderer', '2d', { timeout: 5_000 });
      await expect(page.locator('canvas.hero-gl')).toBeVisible();
    });
  });

  test.describe('with prefers-reduced-motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('never mounts the canvas or mosaic canvases, fetches no graph data and no GL chunk', async ({ page }) => {
      const urls: string[] = [];
      page.on('request', (r) => urls.push(r.url()));
      await page.goto('/', { waitUntil: 'load' });
      await page.waitForTimeout(3_000);
      await expect(page.locator('canvas.hero-gl')).toBeHidden();
      expect(await page.locator('canvas:visible').count()).toBe(0);
      await expect(page.locator('.hero svg').first()).toBeVisible();
      expect(urls.some((u) => u.includes('/graph.json')), 'graph.json is never fetched').toBe(false);
      expect(urls.some((u) => u.includes('graph-gl')), 'the WebGL chunk is never requested').toBe(false);
    });
  });

  test('honours the footer motion toggle (data-motion=off)', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('motion', 'off');
      } catch {}
    });
    const urls: string[] = [];
    page.on('request', (r) => urls.push(r.url()));
    await page.goto('/', { waitUntil: 'load' });
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
    await page.waitForTimeout(3_000);
    await expect(page.locator('canvas.hero-gl')).toBeHidden();
    expect(await page.locator('canvas:visible').count()).toBe(0);
    expect(urls.some((u) => u.includes('/graph.json') || u.includes('graph-gl'))).toBe(false);
  });

  test('keyboard order: skip link, nav, hub list, chapter index', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit on macOS does not move focus to links with Tab (Safari default); verified in Chromium');
    await page.goto('/', { waitUntil: 'load' });
    const seen: string[] = [];
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      const desc = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return 'body';
        const inHero = !!el.closest('.hero');
        const inNav = !!el.closest('.site-nav');
        const inMain = !!el.closest('main');
        const href = el.getAttribute('href') ?? '';
        if (el.classList.contains('skip-link')) return 'skip';
        if (inNav) return 'nav';
        if (inHero && /^\/(notes|blog|achievements)\//.test(href)) return 'hub';
        if (inHero) return 'hero';
        if (inMain && href === '/achievements') return 'chapter';
        return 'other';
      });
      seen.push(desc);
      if (desc === 'chapter') break;
    }
    const first = (k: string) => seen.indexOf(k);
    expect(seen[0], `first Tab lands on the skip link (got ${seen.slice(0, 3).join(', ')})`).toBe('skip');
    expect(first('nav'), 'nav follows the skip link').toBeGreaterThan(0);
    expect(first('hub'), 'hero hub links are in the tab order').toBeGreaterThan(first('nav'));
    expect(first('chapter'), 'chapter index comes after the hub list').toBeGreaterThan(first('hub'));
  });

  test('the poster reveals gold hubs and the label chip exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero .hg-label')).toBeAttached();
    expect(await page.locator('.hero svg a').count()).toBeGreaterThan(12);
  });
});
