import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { KNOWN, firstPath } from './helpers.ts';

const PAGES: [string, string | null][] = [
  ['/', null],
  ['/achievements', null],
  ['an achievement', '/achievements/'],
  ['/notes', null],
  ['a post', '/blog/'],
  ['/resume', null],
];

for (const [label, prefix] of PAGES) {
  test(`${label} has no serious or critical accessibility violations`, async ({ page, request }) => {
    const path = prefix ? await firstPath(request, prefix, prefix === '/blog/' ? KNOWN.post : KNOWN.achievement) : label;
    const res = await page.goto(path, { waitUntil: 'load' });
    expect(res?.status(), path).toBe(200);
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    const report = bad.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n  ')}`).join('\n');
    expect(bad, `${path}\n${report}`).toEqual([]);
  });
}
