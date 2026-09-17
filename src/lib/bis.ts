// Bubble Intensity Score data: CSV parsing/validation, lookups, chart geometry and the server-rendered chart markup.
// Plain TypeScript with no `astro:*` imports so scripts/check-content.ts, vitest and the openers can all import it.
// Design: docs/superpowers/plans/2026-09-17-research-openers.md §4 and §7.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTENT_DIR } from './vault.ts';

// ---------------------------------------------------------------------------------------------- constants

export type Series = 'V' | 'L' | 'S' | 'C' | 'BIS';
export type Pillar = Exclude<Series, 'BIS'>;
export const SERIES: readonly Series[] = ['V', 'L', 'S', 'C', 'BIS'] as const;
export const PILLARS: readonly Pillar[] = ['V', 'L', 'S', 'C'] as const;
export const PILLAR_NAMES: Record<Pillar, string> = { V: 'Valuation', L: 'Leverage', S: 'Sentiment', C: 'Concentration' };

export const BIS_CSV = join(CONTENT_DIR, 'data', 'bis_panel_monthly.csv');
/** The chart starts here; earlier rows are in the file (the trailing z-score window needs them) but are not drawn. */
export const BIS_PLOT_FROM = '1995-01';
export const BIS_DANGER = 1.5;

export type EpisodeKey = 'dotcom' | 'gfc' | 'ai';
export interface Episode { key: EpisodeKey; label: string; from: string; to: string }
export const BIS_EPISODES: readonly Episode[] = [
  { key: 'dotcom', label: 'Dot-com', from: '1995-01', to: '2003-12' },
  { key: 'gfc', label: '2008', from: '2003-01', to: '2010-12' },
  { key: 'ai', label: 'AI', from: '2019-01', to: '2026-08' }, // `to` clamps to the last row of the file
] as const;

export interface Signature { month: string; label: string; highlight?: Pillar }
export const BIS_SIGNATURES: readonly Signature[] = [
  { month: '2000-02', label: 'Dot-com peak' },
  { month: '2007-12', label: 'Credit-crunch onset', highlight: 'L' },
  { month: '2020-12', label: 'AI-era maximum' },
] as const;

/** First months the composite crossed the danger line (optional overlay). */
export const BIS_WARNINGS: readonly string[] = ['1999-07', '2020-08'] as const;

// ---------------------------------------------------------------------------------------------- types

export interface BisRow {
  /** YYYY-MM */
  month: string;
  /** position in the array the row belongs to (`rows` → file order, `plot` → x coordinate) */
  index: number;
  V: number | null;
  L: number | null;
  S: number | null;
  C: number | null;
  BIS: number | null;
}

export interface BisProblem {
  level: 'error' | 'warning';
  /** 1-based line in the CSV (1 is the header) */
  line?: number;
  message: string;
  fix: string;
}

export class BisCsvError extends Error {
  line: number | undefined;
  fix: string;
  problems: BisProblem[];
  constructor(problems: BisProblem[]) {
    const first = problems.find((p) => p.level === 'error') ?? problems[0];
    super(first ? `${first.line ? `line ${first.line}: ` : ''}${first.message}` : 'invalid BIS CSV');
    this.name = 'BisCsvError';
    this.line = first?.line;
    this.fix = first?.fix ?? '';
    this.problems = problems;
  }
}

export interface BisData {
  /** every row of the file, in order */
  rows: BisRow[];
  /** rows from BIS_PLOT_FROM on, re-indexed so `index` is the chart x coordinate */
  plot: BisRow[];
  /** first and last month in the file */
  first: string;
  last: string;
  /** last month with a non-NA composite */
  lastScored: string;
  /** integer z-score domains `[lo, hi]`: composite only, and all five series */
  yDomains: { composite: [number, number]; all: [number, number] };
}

// ---------------------------------------------------------------------------------------------- months

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** `2000-02` → `24002` (months since year 0), so consecutive months differ by exactly 1. */
export const monthOrdinal = (m: string): number => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
/** `2000-02` → `February 2000` */
export const monthName = (m: string): string => `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

// ---------------------------------------------------------------------------------------------- CSV

const NA = new Set(['', 'NA', 'N/A', 'NAN', 'NULL']);
const REQUIRED = ['month', 'V', 'L', 'S', 'C', 'BIS'] as const;
const MIN_ROWS = 120;
const SANE = 10;
const FIX_COLUMNS = 'export the panel again from the R project; it must keep the columns month, V, L, S, C and BIS';

/** Split one CSV line into fields (handles quotes and doubled quotes; no embedded newlines are expected). */
function splitCsvLine(line: string): string[] {
  if (!line.includes('"')) return line.split(',');
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

interface Parsed { rows: BisRow[]; problems: BisProblem[] }

/** Tolerant single pass: BOM, CRLF, quoted fields, NA/NaN/empty → null. Records every problem with its line number. */
function parseInternal(text: string): Parsed {
  const problems: BisProblem[] = [];
  const error = (message: string, fix: string, line?: number) => problems.push({ level: 'error', line, message, fix });
  const warning = (message: string, fix: string, line?: number) => problems.push({ level: 'warning', line, message, fix });
  const rows: BisRow[] = [];

  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  if (!lines.length) {
    error('the file is empty', FIX_COLUMNS, 1);
    return { rows, problems };
  }

  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const col: Partial<Record<(typeof REQUIRED)[number], number>> = {};
  for (const name of REQUIRED) {
    const i = header.indexOf(name);
    if (i < 0) error(`the header has no "${name}" column (found: ${header.join(', ') || 'nothing'})`, FIX_COLUMNS, 1);
    else col[name] = i;
  }
  if (problems.length) return { rows, problems };
  const ci = col as Record<(typeof REQUIRED)[number], number>;

  let prevOrd: number | null = null;
  let prevMonth = '';
  for (let li = 1; li < lines.length; li++) {
    const raw = lines[li];
    const lineNo = li + 1;
    if (raw.trim() === '') {
      error('blank line inside the table', 'delete the empty line', lineNo);
      continue;
    }
    const cells = splitCsvLine(raw).map((c) => c.trim());
    if (cells.length < header.length) {
      error(`the row has ${cells.length} cells but the header has ${header.length}`, 'every row needs one value (or NA) per column', lineNo);
      continue;
    }
    const month = cells[ci.month];
    if (!MONTH_RE.test(month)) {
      error(`"${month}" is not a month in YYYY-MM form`, 'months must look like 2000-02', lineNo);
      continue;
    }
    const ord = monthOrdinal(month);
    if (prevOrd !== null) {
      if (ord === prevOrd) error(`${month} appears twice`, 'keep one row per month', lineNo);
      else if (ord < prevOrd) error(`${month} comes after ${prevMonth}; rows must be in date order`, 'sort the rows by month, oldest first', lineNo);
      else if (ord > prevOrd + 1) error(`${ord - prevOrd - 1} month${ord - prevOrd - 1 === 1 ? ' is' : 's are'} missing between ${prevMonth} and ${month}`, 'the panel must have one row for every month with NA where a value is unknown', lineNo);
    }
    prevOrd = ord;
    prevMonth = month;

    const num = (name: Series): number | null => {
      const v = cells[ci[name]];
      if (NA.has(v.toUpperCase())) return null;
      const n = Number(v);
      if (!Number.isFinite(n)) {
        error(`"${v}" in column ${name} is not a number`, 'use a decimal number or NA', lineNo);
        return null;
      }
      return n;
    };
    const row: BisRow = { month, index: rows.length, V: num('V'), L: num('L'), S: num('S'), C: num('C'), BIS: num('BIS') };
    if (row.BIS !== null && Math.abs(row.BIS) > SANE) error(`BIS ${row.BIS} is outside ±${SANE}; z-scores of that size mean the pipeline broke`, 'check the R output for this month', lineNo);
    rows.push(row);
  }

  if (rows.length < MIN_ROWS) error(`only ${rows.length} data rows; the chart needs at least ${MIN_ROWS} months`, 'export the full monthly panel, not a sample');
  if (rows.length && !rows.some((r) => r.month >= BIS_PLOT_FROM && r.BIS !== null)) error(`no BIS value at or after ${BIS_PLOT_FROM}; the chart would be empty`, 'check the BIS column of the export');

  // NA only in leading and trailing runs (interior NA breaks the line; allowed, but worth a look)
  for (const s of SERIES) {
    let seen = false;
    let gapAt: number | null = null;
    for (const r of rows) {
      const v = r[s];
      if (v === null) {
        if (seen && gapAt === null) gapAt = r.index;
      } else {
        if (gapAt !== null) {
          warning(`column ${s} has an NA gap starting at ${rows[gapAt].month} with values on both sides; the line will break there`, 'nothing to do if the source series really has a hole', gapAt + 2);
          break;
        }
        seen = true;
      }
    }
  }
  return { rows, problems };
}

/** Every problem in a CSV text, errors first (the order the lines appear in). Empty array means the file is valid. */
export function validateBisCsv(text: string): BisProblem[] {
  return parseInternal(text).problems;
}

/** Parse a CSV text into rows; throws `BisCsvError` (with `line`, `fix`, `problems`) on the first error. Warnings are ignored. */
export function parseBisCsv(text: string): BisRow[] {
  const { rows, problems } = parseInternal(text);
  if (problems.some((p) => p.level === 'error')) throw new BisCsvError(problems);
  return rows;
}

// ---------------------------------------------------------------------------------------------- data

/** Outward-rounded integer domain covering every value; always contains 0 and the danger line. */
export function niceDomain(values: (number | null)[]): [number, number] {
  let lo = 0;
  let hi = BIS_DANGER;
  for (const v of values) {
    if (v === null) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [Math.floor(lo), Math.ceil(hi)];
}

/** Build the data object from parsed rows (exposed for tests and fixtures). */
export function buildBis(rows: BisRow[]): BisData {
  if (!rows.length) throw new Error('bis: no rows');
  const plot = rows.filter((r) => r.month >= BIS_PLOT_FROM).map((r, i) => ({ ...r, index: i }));
  if (plot.length < 2) throw new Error(`bis: fewer than two rows from ${BIS_PLOT_FROM}`);
  const scored = [...plot].reverse().find((r) => r.BIS !== null) ?? plot[plot.length - 1];
  return {
    rows,
    plot,
    first: rows[0].month,
    last: rows[rows.length - 1].month,
    lastScored: scored.month,
    yDomains: {
      composite: niceDomain(plot.map((r) => r.BIS)),
      all: niceDomain(plot.flatMap((r) => SERIES.map((s) => r[s]))),
    },
  };
}

let memo: BisData | undefined;
/** Read and validate `content/data/bis_panel_monthly.csv` once per process. */
export function loadBis(): BisData {
  if (memo) return memo;
  if (!existsSync(BIS_CSV)) {
    throw new Error(`content/data/bis_panel_monthly.csv is missing; the Research chapter cannot build. Copy output/bis_panel_monthly.csv from the R project into content/data/.`);
  }
  try {
    memo = buildBis(parseBisCsv(readFileSync(BIS_CSV, 'utf8')));
  } catch (e) {
    if (e instanceof BisCsvError) throw new Error(`content/data/bis_panel_monthly.csv${e.line ? `:${e.line}` : ''} — ${e.message.replace(/^line \d+: /, '')} (fix: ${e.fix})`);
    throw e;
  }
  return memo;
}

/** Test hook: forget the memoised file. */
export function resetBis(): void {
  memo = undefined;
}

// ---------------------------------------------------------------------------------------------- lookups

/** The plot row for a month (chart x = `row.index`), or undefined when the month is before the plot start or not in the file. */
export function rowAt(month: string, data: BisData = loadBis()): BisRow | undefined {
  const i = monthOrdinal(month) - monthOrdinal(data.plot[0].month);
  const r = data.plot[i];
  return r && r.month === month ? r : data.plot.find((x) => x.month === month);
}

/** Plot indices `{ i0, i1 }` (inclusive) of an episode; the AI window clamps to the last row. */
export function episodeRange(key: EpisodeKey, data: BisData = loadBis()): { i0: number; i1: number } {
  const ep = BIS_EPISODES.find((e) => e.key === key)!;
  const N = data.plot.length;
  const first = data.plot[0].month;
  const clamp = (i: number) => Math.min(N - 1, Math.max(0, i));
  const i0 = clamp(monthOrdinal(ep.from) - monthOrdinal(first));
  const to = ep.to > data.last ? data.last : ep.to;
  const i1 = clamp(monthOrdinal(to) - monthOrdinal(first));
  return { i0, i1: Math.max(i0, i1) };
}

export interface SignatureRow extends Signature {
  row: BisRow;
  /** fraction of the plot width, 0..1 */
  at: number;
}
/** The signature months with their CSV values (never hardcoded) and their x fraction. Months absent from the file are skipped. */
export function signatureRows(data: BisData = loadBis()): SignatureRow[] {
  const N = data.plot.length;
  const out: SignatureRow[] = [];
  for (const s of BIS_SIGNATURES) {
    const row = rowAt(s.month, data);
    if (row) out.push({ ...s, row, at: N > 1 ? row.index / (N - 1) : 0 });
  }
  return out;
}

export interface ThreeWayRow { key: string; label: string; month: string; row: BisRow; highlight?: Pillar; latest?: boolean }
/** Rows of the comparison table: the three signature months plus the latest scored month. */
export function threeWay(data: BisData = loadBis()): ThreeWayRow[] {
  const out: ThreeWayRow[] = signatureRows(data).map((s) => ({ key: s.month, label: s.label, month: s.month, row: s.row, highlight: s.highlight }));
  const latest = rowAt(data.lastScored, data);
  if (latest && !out.some((r) => r.month === latest.month)) out.push({ key: 'latest', label: 'Latest', month: latest.month, row: latest, latest: true });
  return out;
}

// ---------------------------------------------------------------------------------------------- geometry

/** SVG y for a z value (user units; the viewBox is `0 -hi*100 N-1 (hi-lo)*100`). */
export const yOf = (v: number): number => -v * 100;
const fy = (v: number): string => String(Math.round(yOf(v) * 10) / 10);

/** `M x y L x y …` with x = array position and a new `M` after every null; empty string when nothing is drawable. */
export function pathD(series: Series, rows: BisRow[]): string {
  let d = '';
  let pen = false;
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i][series];
    if (v === null || !Number.isFinite(v)) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${i} ${fy(v)}`;
    pen = true;
  }
  return d;
}

/** Format a z value for labels: 2 dp, real minus sign, `n/a` for null. */
export function fmtZ(v: number | null, dp = 2): string {
  if (v === null || !Number.isFinite(v)) return 'n/a';
  const s = Math.abs(v).toFixed(dp);
  return (v < 0 && Number(s) !== 0 ? '\u2212' : '') + s;
}

// ---------------------------------------------------------------------------------------------- chart markup

export interface BisChartOptions {
  /** element id of the figure; also prefixes the ids inside */
  id?: string;
  /** initial zoom; default `all` */
  zoom?: 'all' | EpisodeKey;
  /** pillars shown at first paint; default none */
  pillars?: Pillar[];
  /** href of the CSV download */
  csvHref?: string;
  /** visible heading and one-line dek */
  title?: string;
  dek?: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pct = (f: number) => `${(f * 100).toFixed(3).replace(/\.?0+$/, '')}%`;

/** One tooltip sentence for a row (also produced on the client; keep the two in step). */
export function rowSentence(r: BisRow): string {
  return `${r.month} · BIS ${fmtZ(r.BIS)} · V ${fmtZ(r.V)} · L ${fmtZ(r.L)} · S ${fmtZ(r.S)} · C ${fmtZ(r.C)}`;
}

/**
 * The complete chart as an HTML string: HTML for everything that carries text, SVG only for geometry.
 * `preserveAspectRatio="none"` + `vector-effect: non-scaling-stroke` let CSS pick the aspect per breakpoint and the
 * client script zoom by writing the viewBox alone. No `<text>` or `<circle>` inside the SVG (they would distort).
 */
export function bisChartHtml(data: BisData, opts: BisChartOptions = {}): string {
  const id = opts.id ?? 'bis';
  const { plot } = data;
  const N = plot.length;
  const W = N - 1;
  const firstYear = Number(plot[0].month.slice(0, 4));
  const lastYear = Number(plot[N - 1].month.slice(0, 4));
  const shown = new Set(opts.pillars ?? []);
  const dom = shown.size ? data.yDomains.all : data.yDomains.composite;
  const [lo, hi] = dom;
  const y0 = yOf(hi);
  const yh = (hi - lo) * 100;
  const zoom = opts.zoom ?? 'all';
  const range = zoom === 'all' ? { i0: 0, i1: W } : episodeRange(zoom, data);
  const span = Math.max(1, range.i1 - range.i0);
  const xf = (i: number) => (i - range.i0) / span;
  const yf = (v: number) => (hi - v) / (hi - lo);
  const csvHref = opts.csvHref ?? '/data/bis_panel_monthly.csv';
  const title = opts.title ?? `Bubble Intensity Score, ${firstYear}–${lastYear}`;
  const dek = opts.dek ?? `Monthly composite of four pillar z-scores. Danger line at +${BIS_DANGER.toFixed(1)}. Last scored month ${monthName(data.lastScored)}.`;
  const idx = (m: string) => rowAt(m, data)?.index;

  // episode bands
  const bands = BIS_EPISODES.map((e) => {
    const r = episodeRange(e.key, data);
    return `<rect class="bis-band" data-episode="${e.key}" x="${r.i0}" y="-100000" width="${r.i1 - r.i0}" height="200000"/>`;
  }).join('');

  // series paths, pillars first so the composite draws on top
  const paths = [...PILLARS, 'BIS' as const]
    .map((s) => {
      const k = s.toLowerCase();
      const hidden = s !== 'BIS' && !shown.has(s) ? ' hidden' : '';
      return `<path class="bis-series bis-series--${k}" data-series="${k}" d="${pathD(s, plot)}"${hidden}/>`;
    })
    .join('');

  const warns = BIS_WARNINGS.map((m) => {
    const i = idx(m);
    return i === undefined ? '' : `<line class="bis-warn" data-month="${m}" x1="${i}" x2="${i}" y1="-100000" y2="100000"/>`;
  }).join('');

  // axes as HTML
  const yearStep = zoom === 'all' ? 5 : 1;
  const xTicks: string[] = [];
  for (let y = Math.ceil(firstYear / yearStep) * yearStep; y <= lastYear; y += yearStep) {
    const i = idx(`${y}-01`);
    if (i === undefined || i < range.i0 || i > range.i1) continue;
    xTicks.push(`<span style="left:${pct(xf(i))}">${y}</span>`);
  }
  const yTicks: string[] = [];
  for (let v = hi; v >= lo; v--) yTicks.push(`<span style="top:${pct(yf(v))}">${v > 0 ? '+' : ''}${v}</span>`);
  yTicks.push(`<span class="bis-y-danger" style="top:${pct(yf(BIS_DANGER))}">+${BIS_DANGER.toFixed(1)}</span>`);

  const sigs = signatureRows(data)
    .map((s) => {
      const r = s.row;
      const v = r.BIS ?? 0;
      const extra = s.highlight ? `, ${s.highlight} ${fmtZ(r[s.highlight])}` : '';
      const label = `${monthName(s.month)}, BIS ${fmtZ(r.BIS)}${extra}, ${s.label}`;
      // the text sits above the dot unless the line climbs well above it nearby (a marker in a trough)
      const near = plot.slice(Math.max(0, r.index - 8), r.index + 9).map((x) => x.BIS ?? v);
      const below = Math.max(...near) > v + 0.4;
      return `<button type="button" class="bis-sig${below ? ' is-below' : ''}" data-month="${s.month}" data-index="${r.index}" style="left:${pct(xf(r.index))};top:${pct(yf(v))}" aria-label="${esc(label)}"><span class="bis-sig-dot"></span><span class="bis-sig-text mono">${esc(s.label)}</span></button>`;
    })
    .join('');

  const zoomBtns = [{ key: 'all', label: 'All' }, ...BIS_EPISODES.map((e) => ({ key: e.key, label: e.label }))]
    .map((z) => `<button type="button" class="bis-tab mono" data-zoom="${z.key}" aria-pressed="${z.key === zoom}">${esc(z.label)}</button>`)
    .join('');
  const chips = PILLARS.map(
    (p) =>
      `<button type="button" class="chip bis-chip" data-pillar="${p.toLowerCase()}" aria-pressed="${shown.has(p)}"><i class="bis-swatch bis-swatch--${p.toLowerCase()}" aria-hidden="true"></i>${p} ${PILLAR_NAMES[p]}</button>`,
  ).join('');

  // [month, BIS, V, L, S, C] per row, 3 dp (the client script indexes this order)
  const PAYLOAD_ORDER: Series[] = ['BIS', 'V', 'L', 'S', 'C'];
  const payload = JSON.stringify(plot.map((r) => [r.month, ...PAYLOAD_ORDER.map((s) => (r[s] === null ? null : Math.round((r[s] as number) * 1000) / 1000))]));

  const desc =
    `Line chart of the Bubble Intensity Score by month from ${monthName(plot[0].month)} to ${monthName(plot[N - 1].month)}: the composite in white, ` +
    `a gold danger line at +${BIS_DANGER.toFixed(1)}, and shaded bands for the dot-com (${BIS_EPISODES[0].from} to ${BIS_EPISODES[0].to}), 2008 (${BIS_EPISODES[1].from} to ${BIS_EPISODES[1].to}) and AI (${BIS_EPISODES[2].from} on) windows. ` +
    `Signature months: ${signatureRows(data)
      .map((s) => `${monthName(s.month)} BIS ${fmtZ(s.row.BIS)} (${s.label}${s.highlight ? `, ${PILLAR_NAMES[s.highlight]} ${fmtZ(s.row[s.highlight])}` : ''})`)
      .join('; ')}. The four pillar lines can be switched on; the table below and the CSV download carry the same numbers.`;

  return (
    `<figure class="bis" id="${esc(id)}" data-bis data-n="${N}" data-first="${plot[0].month}" data-last="${plot[N - 1].month}" ` +
    `data-y-composite="${yOf(data.yDomains.composite[1])} ${(data.yDomains.composite[1] - data.yDomains.composite[0]) * 100}" ` +
    `data-y-all="${yOf(data.yDomains.all[1])} ${(data.yDomains.all[1] - data.yDomains.all[0]) * 100}" ` +
    `data-domain="${range.i0} ${range.i1}" data-danger="${BIS_DANGER}" ` +
    `data-episodes="${esc(JSON.stringify(Object.fromEntries(BIS_EPISODES.map((e) => [e.key, [episodeRange(e.key, data).i0, episodeRange(e.key, data).i1]]))))}">` +
    `<figcaption class="bis-head"><h2 id="${esc(id)}-title" class="display t-3">${esc(title)}</h2><p class="bis-dek mono small muted">${esc(dek)}</p></figcaption>` +
    `<div class="bis-tools">` +
    `<div role="group" aria-label="Zoom" class="bis-zoom">${zoomBtns}</div>` +
    `<div role="group" aria-label="Pillars" class="bis-pillars">${chips}</div>` +
    `</div>` +
    `<div class="bis-frame" data-bis-frame tabindex="0" aria-roledescription="interactive chart" aria-label="Bubble Intensity Score by month. Use left and right arrow keys to move the cursor." aria-describedby="${esc(id)}-desc">` +
    `<div class="bis-y mono" data-y-axis aria-hidden="true">${yTicks.join('')}</div>` +
    `<div class="bis-plot" data-plot>` +
    `<svg viewBox="${range.i0} ${y0} ${span} ${yh}" preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
    `<g data-episodes>${bands}</g>` +
    `<line class="bis-zero" x1="0" x2="${W}" y1="0" y2="0"/>` +
    `<line class="bis-danger" x1="0" x2="${W}" y1="${yOf(BIS_DANGER)}" y2="${yOf(BIS_DANGER)}"/>` +
    `<g data-warnings>${warns}</g>` +
    paths +
    `</svg>` +
    `<div class="bis-marks">${sigs}</div>` +
    `<div class="bis-cursor" data-cursor hidden aria-hidden="true"></div>` +
    `<div class="bis-tip mono" data-tip hidden aria-hidden="true"></div>` +
    `</div>` +
    `<div class="bis-x mono" data-x-axis aria-hidden="true">${xTicks.join('')}</div>` +
    `</div>` +
    `<p id="${esc(id)}-desc" class="sr-only">${esc(desc)}</p>` +
    `<output class="sr-only" aria-live="polite" data-bis-live></output>` +
    `<p class="bis-foot mono small"><a href="${esc(csvHref)}" download>Download CSV</a><span class="bis-sep" aria-hidden="true"> · </span><span data-bis-status>Hover or focus the chart and use arrow keys</span></p>` +
    `<script type="application/json" data-bis-data>${payload.replace(/</g, '\\u003c')}</script>` +
    `</figure>`
  );
}
