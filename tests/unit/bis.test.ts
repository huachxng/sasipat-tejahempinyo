import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BIS_CSV,
  BisCsvError,
  bisChartHtml,
  buildBis,
  episodeRange,
  fmtZ,
  loadBis,
  niceDomain,
  parseBisCsv,
  pathD,
  rowAt,
  signatureRows,
  threeWay,
  validateBisCsv,
  type BisRow,
} from '../../src/lib/bis.ts';

const SMALL = readFileSync(resolve('tests/fixtures/data/bis_small.csv'), 'utf8');
const lines = () => SMALL.split(/\r?\n/).filter(Boolean);
const withLines = (f: (l: string[]) => string[]) => f(lines()).join('\n') + '\n';
const errorsOf = (text: string) => validateBisCsv(text).filter((p) => p.level === 'error');

describe('parseBisCsv', () => {
  it('parses the header and rows, tolerating CRLF and a BOM', () => {
    const rows = parseBisCsv('﻿' + SMALL);
    expect(rows).toHaveLength(160);
    expect(rows[0].month).toBe('1990-01');
    expect(rows[159].month).toBe('2003-04');
    expect(rows[0].index).toBe(0);
    expect(rows[3].index).toBe(3);
  });
  it('turns NA into null and keeps numbers', () => {
    const rows = parseBisCsv(SMALL);
    expect(rows[0].S).toBeNull();
    expect(rows[0].BIS).toBeNull();
    expect(rows[159].C).toBeNull();
    expect(rows.find((r) => r.month === '2000-02')?.BIS).toBe(2.5);
  });
  it('accepts extra columns and any column order', () => {
    const swapped = withLines((l) => l.map((line) => line.split(',').reverse().join(',') + ',extra'));
    expect(errorsOf(swapped)).toEqual([]);
  });
  it('throws BisCsvError with the line of the first error', () => {
    const bad = withLines((l) => l.map((line) => (line.startsWith('1995-06') ? line.replace('1995-06', '1995-6') : line)));
    let err: unknown;
    try {
      parseBisCsv(bad);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(BisCsvError);
    expect((err as BisCsvError).line).toBe(lines().findIndex((x) => x.startsWith('1995-06')) + 1);
    expect((err as BisCsvError).fix).toContain('2000-02');
  });
});

describe('validateBisCsv', () => {
  it('is clean for the fixture', () => {
    expect(errorsOf(SMALL)).toEqual([]);
  });
  it('rejects a missing column on line 1', () => {
    const p = errorsOf(withLines((l) => [l[0].replace('BIS', 'Score'), ...l.slice(1)]));
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ line: 1 });
    expect(p[0].message).toContain('"BIS"');
  });
  it('rejects a bad month', () => {
    const at = lines().findIndex((x) => x.startsWith('1995-06')) + 1;
    const p = errorsOf(withLines((l) => l.map((line) => (line.startsWith('1995-06') ? line.replace('1995-06', '1995-13') : line))));
    expect(p[0]).toMatchObject({ line: at });
    expect(p[0].message).toMatch(/not a month/);
  });
  it('rejects a gap with the neighbouring months', () => {
    const p = errorsOf(withLines((l) => l.filter((line) => !line.startsWith('1995-07'))));
    expect(p).toHaveLength(1);
    expect(p[0].message).toBe('1 month is missing between 1995-06 and 1995-08');
    expect(p[0].line).toBe(lines().findIndex((x) => x.startsWith('1995-08')));
  });
  it('rejects a duplicate and an out-of-order row', () => {
    const dup = errorsOf(withLines((l) => l.flatMap((line) => (line.startsWith('1995-07') ? [line, line] : [line]))));
    expect(dup[0].message).toBe('1995-07 appears twice');
    const i = lines().findIndex((x) => x.startsWith('1995-07'));
    const ooo = errorsOf(withLines((l) => [...l.slice(0, i), l[i + 1], l[i], ...l.slice(i + 2)]));
    const back = ooo.find((p) => /comes after/.test(p.message));
    expect(back?.message).toMatch(/1995-07 comes after 1995-08/);
    expect(back?.line).toBe(i + 2);
  });
  it('rejects a non-numeric cell', () => {
    const p = errorsOf(withLines((l) => l.map((line) => (line.startsWith('1996-01') ? line.replace(/,[^,]*$/, ',abc') : line))));
    expect(p[0].message).toBe('"abc" in column BIS is not a number');
    expect(p[0].line).toBe(lines().findIndex((x) => x.startsWith('1996-01')) + 1);
  });
  it('rejects a short file and an empty chart range', () => {
    expect(errorsOf(withLines((l) => l.slice(0, 50)))[0].message).toMatch(/only 49 data rows/);
    const noBis = withLines((l) => l.map((line, i) => (i === 0 || line < '1995-01' ? line : line.replace(/,[^,]*$/, ',NA'))));
    expect(errorsOf(noBis).some((p) => /no BIS value at or after 1995-01/.test(p.message))).toBe(true);
  });
  it('warns, not errors, about an interior NA', () => {
    const p = validateBisCsv(withLines((l) => l.map((line) => (line.startsWith('1997-05') ? line.replace(/,[^,]*$/, ',NA') : line))));
    expect(p.filter((x) => x.level === 'error')).toEqual([]);
    expect(p.find((x) => x.level === 'warning')?.message).toMatch(/column BIS has an NA gap starting at 1997-05/);
  });
});

describe('buildBis on the fixture', () => {
  const d = buildBis(parseBisCsv(SMALL));
  it('starts the plot at 1995-01 and re-indexes', () => {
    expect(d.plot[0].month).toBe('1995-01');
    expect(d.plot[0].index).toBe(0);
    expect(d.plot.length).toBe(100);
    expect(d.first).toBe('1990-01');
    expect(d.last).toBe('2003-04');
    expect(d.lastScored).toBe('2003-04');
  });
  it('clamps episodes to the file', () => {
    expect(episodeRange('dotcom', d)).toEqual({ i0: 0, i1: 99 });
    expect(episodeRange('gfc', d)).toEqual({ i0: 96, i1: 99 });
    expect(episodeRange('ai', d)).toEqual({ i0: 99, i1: 99 });
  });
  it('looks rows up by month', () => {
    expect(rowAt('2000-02', d)?.index).toBe(61);
    expect(rowAt('1994-12', d)).toBeUndefined();
    expect(rowAt('2030-01', d)).toBeUndefined();
  });
  it('lists only the signatures present in the file', () => {
    const s = signatureRows(d);
    expect(s.map((x) => x.month)).toEqual(['2000-02']);
    expect(s[0].row.BIS).toBe(2.5);
    expect(s[0].at).toBeCloseTo(61 / 99, 6);
    expect(threeWay(d).map((r) => r.label)).toEqual(['Dot-com peak', 'Latest']);
  });
});

describe('geometry', () => {
  const rows: BisRow[] = [
    { month: '2000-01', index: 0, V: 1, L: null, S: 0, C: 0, BIS: 0.5 },
    { month: '2000-02', index: 1, V: 1, L: null, S: 0, C: 0, BIS: null },
    { month: '2000-03', index: 2, V: 1, L: null, S: 0, C: 0, BIS: -1.25 },
    { month: '2000-04', index: 3, V: 1, L: null, S: 0, C: 0, BIS: 2 },
  ];
  it('pathD starts a new M after a null and never emits NaN', () => {
    expect(pathD('BIS', rows)).toBe('M0 -50M2 125L3 -200');
    expect(pathD('L', rows)).toBe('');
    expect(pathD('V', rows)).toBe('M0 -100L1 -100L2 -100L3 -100');
    expect(pathD('BIS', rows)).not.toMatch(/NaN/);
  });
  it('niceDomain rounds outward to integers and always holds 0 and the danger line', () => {
    expect(niceDomain([-0.2, 2.7])).toEqual([-1, 3]);
    expect(niceDomain([0.1, 0.2])).toEqual([0, 2]);
    expect(niceDomain([null, -3, 5.01])).toEqual([-3, 6]);
  });
  it('fmtZ uses a real minus sign and n/a', () => {
    expect(fmtZ(-0.154)).toBe('−0.15');
    expect(fmtZ(2.2009)).toBe('2.20');
    expect(fmtZ(-0.001)).toBe('0.00');
    expect(fmtZ(null)).toBe('n/a');
  });
});

describe('bisChartHtml', () => {
  const d = buildBis(parseBisCsv(SMALL));
  const html = bisChartHtml(d, { id: 'bis' });
  it('emits the composite path, the pillar paths hidden, and no distortable SVG text', () => {
    expect(html).toContain('data-series="bis"');
    expect(html).toMatch(/data-series="v" d="M[^"]+" hidden/);
    expect(html).not.toMatch(/<text|<circle/);
    expect(html).toContain('preserveAspectRatio="none"');
  });
  it('sets the viewBox from the composite domain', () => {
    const [lo, hi] = d.yDomains.composite;
    expect(html).toContain(`viewBox="0 ${-hi * 100} ${d.plot.length - 1} ${(hi - lo) * 100}"`);
  });
  it('renders one signature button per present signature and a parsable payload', () => {
    expect(html.match(/class="bis-sig"/g)).toHaveLength(1);
    const payload = JSON.parse(/data-bis-data>(.*?)<\/script>/s.exec(html)![1]);
    expect(payload).toHaveLength(d.plot.length);
    expect(payload[0][0]).toBe('1995-01');
    expect(payload[0]).toHaveLength(6);
  });
  it('can start zoomed with pillars shown', () => {
    const z = bisChartHtml(d, { zoom: 'dotcom', pillars: ['V'] });
    expect(z).toMatch(/data-series="v" d="M[^"]+"\/>/);
    expect(z).toContain('data-pillar="v" aria-pressed="true"');
    expect(z).toContain('data-zoom="dotcom" aria-pressed="true"');
  });
});

describe.skipIf(!existsSync(BIS_CSV))('the real content/data/bis_panel_monthly.csv', () => {
  it('validates with no errors', () => {
    expect(errorsOf(readFileSync(BIS_CSV, 'utf8'))).toEqual([]);
  });
  it('has the three signature readings from the paper', () => {
    const d = loadBis();
    const s = Object.fromEntries(signatureRows(d).map((x) => [x.month, x.row]));
    expect(s['2000-02'].BIS).toBeCloseTo(2.201, 2);
    expect(s['2007-12'].BIS).toBeCloseTo(0.345, 2);
    expect(s['2007-12'].L).toBeCloseTo(2.107, 2);
    expect(s['2020-12'].BIS).toBeCloseTo(1.625, 2);
  });
  it('plots from 1995-01 and clamps the AI window to the last row', () => {
    const d = loadBis();
    expect(d.plot[0].month).toBe('1995-01');
    expect(episodeRange('dotcom', d)).toEqual({ i0: 0, i1: rowAt('2003-12', d)!.index });
    expect(episodeRange('ai', d).i1).toBe(d.plot.length - 1);
    expect(bisChartHtml(d).match(/class="bis-sig"/g)).toHaveLength(3);
  });
});
