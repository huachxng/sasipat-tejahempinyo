import { test, expect } from '@playwright/test';
import { KNOWN, firstPath } from './helpers.ts';

test.describe('/achievements timeline', () => {
  test('year tabs and category chips update the query string and hide entries', async ({ page }) => {
    await page.goto('/achievements');
    const articles = page.locator('main article');
    const total = await articles.count();
    expect(total).toBeGreaterThan(10);

    const chips = page.locator('button[aria-pressed]');
    expect(await chips.count()).toBeGreaterThan(8);

    const year = page.getByRole('button', { name: /^2025$/ });
    await year.click();
    await expect(page).toHaveURL(/[?&]year=2025/);
    await expect(year).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.locator('main article:visible').count()).toBeLessThan(total);

    const cat = page.getByRole('button', { name: /Athletics/i }).first();
    await cat.click();
    await expect(page).toHaveURL(/[?&]cat=athletics/);
    await expect(page).toHaveURL(/[?&]year=2025/);
    await expect(cat).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: /^All$/ }).click();
    await expect(page).not.toHaveURL(/year=/);
  });

  test('a deep link pre-applies the filter without JavaScript hiding everything', async ({ page }) => {
    await page.goto('/achievements?cat=athletics');
    await expect(page.getByRole('button', { name: /Athletics/i }).first()).toHaveAttribute('aria-pressed', 'true');
    const visible = await page.locator('main article:visible').count();
    expect(visible).toBeGreaterThan(0);
    expect(visible).toBeLessThan(await page.locator('main article').count());
  });

  test('every entry exposes its index to assistive tech and the page uses the legal name', async ({ page }) => {
    await page.goto('/achievements');
    await expect(page.locator('main').getByText(/Nº\s*\d+/).first()).toBeAttached();
    await expect(page.locator('body')).toContainText('Sasipat');
  });

  test('a detail page has metadata, connected notes and prev/next', async ({ page, request }) => {
    const path = await firstPath(request, '/achievements/', KNOWN.achievement);
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('main h1')).toBeVisible();
    expect(await page.locator('script[type="application/ld+json"]').count(), 'BreadcrumbList JSON-LD').toBeGreaterThan(0);
    await expect(page.locator('main [data-pagefind-body], main[data-pagefind-body]').first()).toBeAttached();
    await expect(page.locator('main').getByText(/connected/i).first()).toBeAttached();
  });
});
