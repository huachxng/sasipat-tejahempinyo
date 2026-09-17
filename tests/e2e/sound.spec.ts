import { test, expect, type Page } from '@playwright/test';

// Opt-in synthesized sound (src/scripts/sound.ts). No AudioContext may exist before the toggle gesture; the stored
// preference persists but only produces sound after the first interaction on a later visit; motion off disables it.
declare global {
  interface Window { __acCount: number; __sfx: string[] }
}

const countContexts = (page: Page) =>
  page.addInitScript(() => {
    window.__acCount = 0;
    window.__sfx = [];
    addEventListener('sfx', (e) => window.__sfx.push(String((e as CustomEvent).detail)));
    const AC = window.AudioContext;
    if (AC) window.AudioContext = new Proxy(AC, { construct(target, args) { window.__acCount++; return new target(...(args as [])); } });
  });
const acCount = (page: Page) => page.evaluate(() => window.__acCount);
const heroLive = (page: Page) => expect(page.locator('[data-hero]')).toHaveAttribute('data-renderer', /^(gl|2d)$/, { timeout: 10_000 });

test.describe('sound', () => {
  test.beforeEach(async ({ page }) => { await countContexts(page); });

  test('is off by default and constructs nothing', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await heroLive(page);
    const chip = page.locator('[data-sound-toggle]');
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await expect(chip).toHaveText('Sound: off');
    await expect(page.locator('html')).not.toHaveAttribute('data-sound', /.*/);
    expect(await acCount(page)).toBe(0);
  });

  test('the chip creates exactly one AudioContext inside the click and it runs', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await heroLive(page);
    const chip = page.locator('[data-sound-toggle]');
    await chip.scrollIntoViewIfNeeded();
    expect(await acCount(page)).toBe(0);
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(chip).toHaveText('Sound: on');
    await expect(page.locator('html')).toHaveAttribute('data-sound', 'on');
    expect(await page.evaluate(() => localStorage.getItem('sound'))).toBe('on');
    expect(await acCount(page)).toBe(1);
    await expect.poll(() => chip.getAttribute('data-audio-state'), { timeout: 5_000 }).toBe('running');
    // the hero asks for the drone when it is running; the request goes over the sfx bus
    await page.evaluate(() => scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => window.__sfx.includes('drone:on')), { timeout: 5_000 }).toBe(true);
    // off again: attribute and storage cleared, no second context
    await chip.scrollIntoViewIfNeeded();
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('html')).not.toHaveAttribute('data-sound', /.*/);
    expect(await page.evaluate(() => localStorage.getItem('sound'))).toBeNull();
    expect(await acCount(page)).toBe(1);
  });

  test('a stored preference is applied before paint but makes no context until a gesture', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('sound', 'on'); } catch {} });
    let earlyAttr: string | null = 'unset';
    page.once('domcontentloaded', async () => { earlyAttr = await page.evaluate(() => document.documentElement.getAttribute('data-sound')); });
    await page.goto('/', { waitUntil: 'load' });
    await heroLive(page);
    expect(earlyAttr, 'html[data-sound] is set by the pre-paint script').toBe('on');
    await expect(page.locator('[data-sound-toggle]')).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(1_500);
    expect(await acCount(page), 'no AudioContext before the first interaction').toBe(0);
    await page.mouse.click(20, 400);
    await expect.poll(() => page.locator('[data-sound-toggle]').getAttribute('data-audio-state'), { timeout: 5_000 }).toBe('running');
    expect(await acCount(page)).toBe(1);
  });

  test('motion off disables the chip and forces sound off', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('sound', 'on'); localStorage.setItem('motion', 'off'); } catch {} });
    await page.goto('/', { waitUntil: 'load' });
    const chip = page.locator('[data-sound-toggle]');
    await expect(page.locator('html')).not.toHaveAttribute('data-sound', /.*/);
    await expect(chip).toHaveAttribute('aria-disabled', 'true');
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await chip.click({ force: true });
    await page.waitForTimeout(300);
    expect(await acCount(page)).toBe(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-sound', /.*/);
    // turning motion back on restores the stored preference
    const motion = page.locator('[data-motion-toggle]');
    await motion.click();
    await expect(page.locator('html')).toHaveAttribute('data-sound', 'on');
    await expect(chip).not.toHaveAttribute('aria-disabled', /.*/);
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  test.describe('with prefers-reduced-motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('behaves like motion off', async ({ page }) => {
      await page.addInitScript(() => { try { localStorage.setItem('sound', 'on'); } catch {} });
      await page.goto('/', { waitUntil: 'load' });
      const chip = page.locator('[data-sound-toggle]');
      await expect(page.locator('html')).not.toHaveAttribute('data-sound', /.*/);
      await expect(chip).toHaveAttribute('aria-disabled', 'true');
      await chip.click({ force: true });
      await page.waitForTimeout(300);
      expect(await acCount(page)).toBe(0);
    });
  });

  test('filter chips dispatch a tap on the sfx bus and make no sound while off', async ({ page }) => {
    await page.goto('/achievements', { waitUntil: 'load' });
    const btn = page.locator('[data-filters] button[data-cat]').first();
    await btn.click();
    await expect.poll(() => page.evaluate(() => window.__sfx.includes('tap'))).toBe(true);
    expect(await acCount(page)).toBe(0);
  });
});
