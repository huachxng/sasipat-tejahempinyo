import { test, expect } from '@playwright/test';

const LEGAL_NAME = 'Sasipat Tejahempinyo';

test.describe('resume', () => {
  test('/resume.pdf is a real PDF', async ({ request }) => {
    const res = await request.get('/resume.pdf');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/pdf');
    const body = await res.body();
    expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(body.length).toBeGreaterThan(10_000);
    expect(body.includes('/Type /Page') || body.includes('/Type/Page')).toBe(true);
  });

  test('/resume shows the legal name, the download and print buttons and every resume entry', async ({ page }) => {
    await page.goto('/resume');
    await expect(page.locator('main')).toContainText(LEGAL_NAME);
    await expect(page.locator('main')).not.toContainText('Noah');
    const download = page.getByRole('link', { name: /download pdf/i });
    await expect(download).toHaveAttribute('href', '/resume.pdf');
    await expect(download).toHaveAttribute('download', /Resume\.pdf$/);
    await expect(page.getByRole('button', { name: /print/i })).toBeVisible();
    for (const heading of ['Education', 'Research', 'Honors & Awards', 'Athletics']) {
      await expect(page.locator('main').getByText(heading, { exact: true }).first()).toBeVisible();
    }
  });

  test('/resume.json is not shipped', async ({ request }) => {
    const res = await request.get('/resume.json');
    expect(res.status()).toBe(404);
  });
});
