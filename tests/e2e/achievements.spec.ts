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

test.describe('archery', () => {
  test('Kasetsart shows the target face with an accessible title, the readout and the record with aria-current', async ({ page }) => {
    const res = await page.goto(KNOWN.archery);
    expect(res?.status()).toBe(200);
    const svg = page.locator('[data-archery-target] svg[role="img"]');
    await expect(svg).toBeVisible();
    await expect(svg.locator('title')).toContainText('560');
    const caption = page.locator('[data-archery-target] figcaption');
    await expect(caption).toContainText('560');
    await expect(caption).toContainText('7.8');
    await expect(page.locator('[data-archery-target] .ring.is-avg')).toHaveAttribute('data-v', '8');
    const record = page.locator('[data-archery-record]');
    await expect(record).toBeAttached();
    await expect(record).toHaveAttribute('id', 'archery-record');
    await expect(record.locator('a[aria-current="page"]')).toHaveAttribute('href', KNOWN.archery);
    expect(await record.locator('a[aria-current="page"]').count()).toBe(1);
    // zero-JS components: no script inside either archery block
    await expect(page.locator('[data-archery-target] script, [data-archery-record] script')).toHaveCount(0);
  });

  test('Nonthaburi shows a placing badge and no target face', async ({ page }) => {
    await page.goto('/achievements/nonthaburi-cup-2023');
    await expect(page.locator('[data-archery-placing]')).toContainText('1st');
    await expect(page.locator('[data-archery-target]')).toHaveCount(0);
  });

  test('WAYC shows neither a target nor a badge, but the record lists it as competed', async ({ page }) => {
    await page.goto('/achievements/thailand-youth-national-archery-team-wayc-2025');
    await expect(page.locator('[data-archery-target]')).toHaveCount(0);
    await expect(page.locator('[data-archery-placing]')).toHaveCount(0);
    const row = page.locator('[data-archery-record] li', { has: page.locator('a[aria-current="page"]') });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('competed');
    expect(await page.locator('[data-archery-record] li').count()).toBeGreaterThanOrEqual(2);
  });
});
