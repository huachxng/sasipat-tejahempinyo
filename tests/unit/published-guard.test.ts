import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { globSync } from 'tinyglobby';

// Spec §4.3 (b): src/lib/published.ts is the only place that may call getCollection().
const ALLOWED = new Set(['src/lib/published.ts']);
const files = globSync(['src/**/*.{astro,ts,tsx,mts,js,mjs}'], { cwd: resolve('.'), ignore: ['src/env.d.ts'] }).sort();

const offenders: string[] = [];
for (const rel of files) {
  if (ALLOWED.has(rel)) continue;
  const lines = readFileSync(resolve(rel), 'utf8').split('\n');
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '').replace(/<!--.*?-->/g, '');
    if (/\bgetCollection\s*\(/.test(code)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
  });
}

describe('draft guard', () => {
  it('scans src/pages and src/components', () => {
    expect(files.some((f) => f.startsWith('src/pages/'))).toBe(true);
    expect(files.some((f) => f.startsWith('src/components/'))).toBe(true);
  });
  it('finds no getCollection( outside src/lib/published.ts', () => {
    expect(offenders, `Read collections through getPublished()/getProfile() in src/lib/published.ts:\n${offenders.join('\n')}`).toEqual([]);
  });
  it('keeps the accessor itself in place', () => {
    const src = readFileSync(resolve('src/lib/published.ts'), 'utf8');
    expect(src).toMatch(/export async function getPublished/);
    expect(src).toMatch(/e\.data\.publish === true/);
  });
});
