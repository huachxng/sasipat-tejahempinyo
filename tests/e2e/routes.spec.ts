import { test, expect } from '@playwright/test';
import { sitemapPaths, collectErrors } from './helpers.ts';

test.describe('every sitemap route', () => {
  test('is listed, returns 200 and logs no console errors', async ({ page, request }) => {
    test.slow();
    const paths = await sitemapPaths(request);
    expect(paths.length, 'sitemap-index.xml must list pages').toBeGreaterThan(0);
    expect(paths).toContain('/');
    for (const prefix of ['/achievements', '/notes', '/research', '/about', '/resume', '/contact']) expect(paths, `sitemap lists ${prefix}`).toContain(prefix);
    expect(paths.some((p) => p.startsWith('/tags/')), 'tag pages are excluded from the sitemap').toBe(false);

    const failures: string[] = [];
    for (const path of paths) {
      const errors = collectErrors(page);
      const res = await page.goto(path, { waitUntil: 'load' });
      if (!res || res.status() !== 200) failures.push(`${path} → HTTP ${res?.status()}`);
      await page.waitForTimeout(150);
      for (const e of errors) failures.push(`${path}: ${e}`);
      page.removeAllListeners('console');
      page.removeAllListeners('pageerror');
      page.removeAllListeners('requestfailed');
    }
    expect(failures).toEqual([]);
  });

  test('static endpoints exist with the right content types', async ({ request }) => {
    for (const [path, type] of [
      ['/graph.json', 'application/json'],
      ['/rss.xml', 'xml'],
      ['/robots.txt', 'text/plain'],
      ['/sitemap-index.xml', 'xml'],
    ] as const) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()['content-type'] ?? '', path).toContain(type);
    }
    const graph = await (await request.get('/graph.json')).json();
    expect(graph.v).toBe(1);
    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(graph.nodes.length).toBeGreaterThan(10);
  });

  test('the 404 page renders and is noindex', async ({ page }) => {
    const res = await page.goto('/this-page-does-not-exist');
    expect(res?.status()).toBe(404);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });
});
