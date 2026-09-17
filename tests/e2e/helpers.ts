import type { APIRequestContext, Page } from '@playwright/test';

/** Fallback routes from the real content, used when the sitemap is not built yet. */
export const KNOWN = {
  achievement: '/achievements/one-day-mba-2026',
  achievementWithGallery: '/achievements/navy-archer-open-2024',
  /** The one archery entry with a scores line (target face + record panel). */
  archery: '/achievements/kasetsart-open-archery-2025',
  note: '/notes/bubble-intensity-score',
  post: '/blog/what-replicating-a-bubble-indicator-taught-me-about-data',
};

const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

/** Every page path listed by the sitemap (index → children), as pathnames. */
export async function sitemapPaths(request: APIRequestContext): Promise<string[]> {
  const index = await request.get('/sitemap-index.xml');
  if (!index.ok()) return [];
  const children = locs(await index.text());
  const out = new Set<string>();
  for (const child of children) {
    const path = new URL(child).pathname;
    const res = await request.get(path);
    if (!res.ok()) continue;
    for (const loc of locs(await res.text())) out.add(new URL(loc).pathname || '/');
  }
  return [...out].sort();
}

export async function firstPath(request: APIRequestContext, prefix: string, fallback: string): Promise<string> {
  const paths = await sitemapPaths(request);
  return paths.find((p) => p.startsWith(prefix) && p !== prefix.replace(/\/$/, '')) ?? fallback;
}

/** Console errors and uncaught exceptions on a page, ignoring things `astro preview` cannot serve. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  const ignore = /_vercel\/insights|giscus\.app|ERR_BLOCKED_BY_CLIENT|favicon\.ico/;
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (ignore.test(text) || ignore.test(msg.location().url)) return;
    errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (ignore.test(url)) return;
    errors.push(`requestfailed: ${url} — ${req.failure()?.errorText ?? ''}`);
  });
  return errors;
}
