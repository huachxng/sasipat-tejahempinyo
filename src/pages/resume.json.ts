import type { APIRoute } from 'astro';
import { getProfile, getPublished } from '../lib/published.ts';
import { buildResumeModel } from '../lib/resume.ts';

// Build-time only. scripts/resume-pdf.mjs reads dist/resume.json in postbuild, writes
// dist/resume.pdf from it and deletes the JSON, so the PDF can never drift from /resume.
export const GET: APIRoute = async () => {
  const [achievements, profile] = await Promise.all([getPublished('achievements'), getProfile()]);
  const model = buildResumeModel(achievements, profile);
  return new Response(`${JSON.stringify(model, null, 2)}\n`, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
