// Static endpoint: the raw BIS monthly panel behind /research, served as CSV for the "Download CSV" link and the Dataset JSON-LD.
import { readFileSync } from 'node:fs';
import type { APIRoute } from 'astro';
import { BIS_CSV, loadBis } from '../../lib/bis.ts';

export const GET: APIRoute = () => {
  loadBis(); // validates the file first so a broken CSV fails the build here as well as on /research
  return new Response(readFileSync(BIS_CSV, 'utf8'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' },
  });
};
