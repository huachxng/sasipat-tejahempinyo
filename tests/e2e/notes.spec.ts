import { test, expect } from '@playwright/test';
import { KNOWN, firstPath } from './helpers.ts';

test.describe('notes chapter', () => {
  test('a note shows backlinks with context and a static local graph', async ({ page }) => {
    const res = await page.goto(KNOWN.note);
    expect(res?.status()).toBe(200);
    const linkedFrom = page.getByRole('heading', { name: /linked from/i });
    await expect(linkedFrom).toBeVisible();
    const section = linkedFrom.locator('xpath=ancestor::*[self::section or self::aside or self::div][1]');
    expect(await section.locator('a[href^="/notes/"], a[href^="/blog/"], a[href^="/achievements/"]').count()).toBeGreaterThan(0);
    await expect(page.locator('main svg a[href^="/"]').first()).toBeAttached();
    await expect(page.locator('main[data-pagefind-body]')).toBeAttached();
    await expect(page.locator('body')).toContainText('Noah');
  });

  test('wikilinks render as gold links and never leak drafts', async ({ page }) => {
    await page.goto(KNOWN.note);
    expect(await page.locator('main a.wl').count()).toBeGreaterThan(0);
    for (const el of await page.locator('.wl-missing').all()) {
      expect(await el.getAttribute('href')).toBeNull();
    }
  });

  test('/notes landing has the 2D graph panel, tabs and the accessible list', async ({ page }) => {
    await page.goto('/notes');
    await expect(page.getByRole('link', { name: /^blog$/i }).or(page.getByRole('tab', { name: /blog/i })).first()).toBeVisible();
    expect(await page.locator('main a[href^="/notes/"]').count()).toBeGreaterThan(5);
    await page.waitForLoadState('load');
    await expect(page.locator('main canvas, main svg').first()).toBeAttached();
  });

  test('a post carries the giscus section without an iframe before scrolling', async ({ page, request }) => {
    const path = await firstPath(request, '/blog/', KNOWN.post);
    const res = await page.goto(path, { waitUntil: 'load' });
    expect(res?.status()).toBe(200);
    const comments = page.locator('#comments');
    await expect(comments).toBeAttached();
    await expect(comments).toHaveAttribute('data-pagefind-ignore', /.*/);
    await expect(comments.getByRole('heading', { name: /discussion/i })).toBeAttached();
    await expect(comments.getByRole('link', { name: /github/i }).first()).toBeAttached();
    expect(await page.locator('iframe').count(), 'no iframe before the section is near the viewport').toBe(0);
    expect(await page.locator('script[src*="giscus.app"]').count()).toBe(0);

    await comments.scrollIntoViewIfNeeded();
    const script = page.locator('script[src*="giscus.app/client.js"]');
    await expect(script).toHaveCount(1, { timeout: 5_000 });
    expect(await script.getAttribute('data-repo')).toMatch(/^[\w.-]+\/[\w.-]+$/);
    expect(await script.getAttribute('data-mapping')).toBe('pathname');
    expect(await script.getAttribute('data-strict')).toBe('1');
    await expect(page.locator('script[type="application/ld+json"]').filter({ hasText: 'BlogPosting' })).toHaveCount(1);
  });

  test('the search dialog opens with ⌘K, / and the nav button', async ({ page }) => {
    await page.goto('/notes', { waitUntil: 'load' });
    const dialog = page.locator('dialog#search-dialog');
    await page.keyboard.press('Meta+k');
    await expect(dialog).toHaveAttribute('open', /.*/);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toHaveAttribute('open', /.*/);

    await page.keyboard.press('/');
    await expect(dialog).toHaveAttribute('open', /.*/);
    await page.keyboard.press('Escape');

    await page.locator('[data-search-open]').first().click();
    await expect(dialog).toHaveAttribute('open', /.*/);
    await expect(dialog.locator('input[type="text"], input[type="search"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('a tag page lists notes, posts and achievements under one heading', async ({ page }) => {
    const res = await page.goto('/tags/archery');
    expect(res?.status()).toBe(200);
    await expect(page.locator('main h1')).toContainText(/archery/i);
    expect(await page.locator('main a[href^="/notes/"], main a[href^="/achievements/"], main a[href^="/blog/"]').count()).toBeGreaterThan(0);
  });
});
