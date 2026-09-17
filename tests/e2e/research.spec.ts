import { test, expect } from '@playwright/test';

test.describe('/research', () => {
  test('renders the chart, table, method, CSV and Dataset JSON-LD without JavaScript', async ({ browser, request }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/research');
    await expect(page.locator('h1')).toContainText(/Research/i);
    const fig = page.locator('figure[data-bis]');
    await expect(fig.locator('svg path[data-series="bis"]')).toBeAttached();
    await expect(fig.locator('svg path[data-series="v"]')).toBeHidden();
    await expect(fig.locator('.bis-sig')).toHaveCount(3);
    expect(await page.locator('.research-method h2').count()).toBe(4);
    expect(await page.locator('.bis-table tbody tr').count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator('main')).toContainText('Sasipat');

    const csv = page.getByRole('link', { name: /Download CSV/ }).first();
    const href = await csv.getAttribute('href');
    expect(href).toBe('/data/bis_panel_monthly.csv');
    const res = await request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/csv');
    expect((await res.text()).split('\n')[0]).toContain('month');

    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(ld.some((s) => s.includes('"Dataset"'))).toBe(true);
    await context.close();
  });

  test('hover shows a tooltip with every series', async ({ page }) => {
    await page.goto('/research', { waitUntil: 'load' });
    const plot = page.locator('[data-plot]');
    await plot.scrollIntoViewIfNeeded();
    const b = (await plot.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    const tip = page.locator('[data-tip]');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(/\d{4}/);
    for (const k of ['BIS', 'V', 'L', 'S', 'C']) await expect(tip).toContainText(k);
    await expect(page.locator('[data-bis-status]')).toContainText(/\d{4}-\d{2} · BIS/);
    await page.mouse.move(0, 0);
    await expect(tip).toBeHidden();
  });

  test('arrow keys move a cursor and announce it', async ({ page }) => {
    await page.goto('/research', { waitUntil: 'load' });
    const frame = page.locator('[data-bis-frame]');
    await frame.focus();
    await page.keyboard.press('ArrowRight');
    const cursor = page.locator('[data-cursor]');
    await expect(cursor).toBeVisible();
    const start = (await cursor.getAttribute('data-month'))!;
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    const after = (await cursor.getAttribute('data-month'))!;
    const ord = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7));
    expect(ord(after) - ord(start)).toBe(3);
    await expect.poll(() => page.locator('[data-bis-live]').textContent()).toMatch(/BIS/);
    await page.keyboard.press('End');
    await expect(cursor).toHaveAttribute('data-month', (await page.locator('figure[data-bis]').getAttribute('data-last'))!);
    await page.keyboard.press('Home');
    await expect(cursor).toHaveAttribute('data-month', (await page.locator('figure[data-bis]').getAttribute('data-first'))!);
  });

  test('pillar chips and zoom tabs update the chart and the URL', async ({ page }) => {
    await page.goto('/research', { waitUntil: 'load' });
    const fig = page.locator('figure[data-bis]');
    const n = Number(await fig.getAttribute('data-n'));
    const chip = fig.locator('[data-pillar="v"]');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(fig.locator('path[data-series="v"]')).toBeVisible();
    await expect(page).toHaveURL(/[?&]pillars=v/);

    await fig.locator('[data-zoom="dotcom"]').click();
    await expect(page).toHaveURL(/[?&]zoom=dotcom/);
    await expect(fig.locator('[data-zoom="dotcom"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(fig.locator('[data-zoom="all"]')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => Number((await fig.locator('svg').getAttribute('viewBox'))!.split(' ')[2])).toBeLessThan(n - 1);

    await fig.locator('[data-zoom="all"]').click();
    await expect(page).not.toHaveURL(/zoom=/);
    await expect.poll(async () => Number((await fig.locator('svg').getAttribute('viewBox'))!.split(' ')[2])).toBe(n - 1);
    await chip.click();
    await expect(page).not.toHaveURL(/pillars=/);
    await expect(fig.locator('path[data-series="v"]')).toBeHidden();
  });

  test('a deep link pre-applies zoom and pillars', async ({ page }) => {
    await page.goto('/research?zoom=ai&pillars=l,c', { waitUntil: 'load' });
    const fig = page.locator('figure[data-bis]');
    await expect(fig.locator('[data-zoom="ai"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(fig.locator('[data-pillar="l"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(fig.locator('[data-pillar="c"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(fig.locator('path[data-series="l"]')).toBeVisible();
    await expect(fig.locator('path[data-series="v"]')).toBeHidden();
  });

  test('signature buttons jump the cursor', async ({ page }) => {
    await page.goto('/research', { waitUntil: 'load' });
    const sig = page.locator('.bis-sig[data-month="2000-02"]');
    await sig.scrollIntoViewIfNeeded();
    await sig.click();
    await expect(page.locator('[data-cursor]')).toHaveAttribute('data-month', '2000-02');
    await expect(page.locator('[data-tip]')).toContainText('February 2000');
  });

  test.describe('phone', () => {
    test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    test('has no horizontal overflow and the chart survives a tap', async ({ page }) => {
      await page.goto('/research', { waitUntil: 'load' });
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
      const plot = page.locator('[data-plot]');
      await plot.scrollIntoViewIfNeeded();
      const b = (await plot.boundingBox())!;
      await page.touchscreen.tap(b.x + b.width * 0.4, b.y + b.height * 0.5);
      await expect(page.locator('[data-tip]')).toBeVisible();
    });
  });
});
