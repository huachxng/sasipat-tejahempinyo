// Archery scores: the tolerant parser for the `scores` frontmatter lines and the helpers the target
// face, the record panel, the resume and check-content share. Plain TypeScript on purpose (no astro:*)
// so vitest and the Node scripts import it directly.
//
// Grammar of one line:  <label> | <score> | <detail> | <detail> …
//   score   560/720 · 560 of 720 · 560 (optionally "pts"/"points") · 6-4 / 6–4 / 6:4 (match sets)
//   detail  72 arrows · 70 m / 70m / 70 metres · anything else becomes a note
// Segments may come in any order; the first segment is the label unless it is itself recognised.
//
// Visual mapping (the one design decision): the average score per arrow is drawn as a radius on a
// 100-unit face with radiusFor(avg) = (10.5 − avg) × 10, so an average of exactly 8.0 sits in the
// middle of the 8 ring (band r 20–30) and 7.78 lands at r 27.2, still inside ring 8. ringFor(avg)
// rounds to the nearest ring value; it is "where the average arrow lands", not a claim of precision.

export interface ParsedScore {
  label: string;
  total?: number;
  max?: number;
  arrows?: number;
  distance?: string;
  matchScore?: string;
  note?: string;
  raw: string;
}

const RE_FRACTION = /^(\d+)\s*(?:\/|of)\s*(\d+)\s*(?:pts|points)?$/i;
const RE_TOTAL = /^(\d+)\s*(?:pts|points)?$/i;
const RE_MATCH = /^(\d+)\s*[-–:]\s*(\d+)(?:\s*sets?)?$/i;
const RE_ARROWS = /^(\d+)\s*arrows?$/i;
const RE_DISTANCE = /^(\d+(?:\.\d+)?)\s*(?:m|metres?|meters?)$/i;

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Parses one `scores` line. Returns null when no score (total or match) can be found. Never throws. */
export function parseScore(raw: string): ParsedScore | null {
  const segments = String(raw ?? '').split('|').map(collapse).filter(Boolean);
  if (!segments.length) return null;
  const out: ParsedScore = { label: '', raw: String(raw) };
  const notes: string[] = [];
  segments.forEach((seg, i) => {
    let m: RegExpExecArray | null;
    if (out.total === undefined && out.matchScore === undefined && (m = RE_FRACTION.exec(seg))) {
      out.total = Number(m[1]);
      out.max = Number(m[2]);
    } else if (out.total === undefined && out.matchScore === undefined && (m = RE_TOTAL.exec(seg))) {
      out.total = Number(m[1]);
    } else if (out.total === undefined && out.matchScore === undefined && (m = RE_MATCH.exec(seg))) {
      out.matchScore = `${Number(m[1])}–${Number(m[2])}`;
    } else if (out.arrows === undefined && (m = RE_ARROWS.exec(seg))) {
      out.arrows = Number(m[1]);
    } else if (out.distance === undefined && (m = RE_DISTANCE.exec(seg))) {
      out.distance = `${m[1]} m`;
    } else if (i === 0) {
      out.label = seg;
    } else {
      notes.push(seg);
    }
  });
  if (out.total === undefined && out.matchScore === undefined) return null;
  if (!out.label) out.label = out.matchScore ? 'Match' : 'Score';
  if (notes.length) out.note = notes.join(' · ');
  return out;
}

/** Explicit maximum, else arrows × 10. Arrows are never derived from the maximum. */
export const maxOf = (s: ParsedScore): number | undefined => s.max ?? (s.arrows ? s.arrows * 10 : undefined);

export const averagePerArrow = (s: ParsedScore): number | undefined =>
  s.total !== undefined && s.arrows ? s.total / s.arrows : undefined;

/** Highest average per arrow wins (ties → first); else the first line with a total; else undefined. */
export function bestScore(raws: readonly string[]): ParsedScore | undefined {
  const parsed = raws.map(parseScore).filter((s): s is ParsedScore => s !== null);
  let best: ParsedScore | undefined;
  let bestAvg = -Infinity;
  for (const s of parsed) {
    const avg = averagePerArrow(s);
    if (avg !== undefined && avg > bestAvg) {
      best = s;
      bestAvg = avg;
    }
  }
  return best ?? parsed.find((s) => s.total !== undefined);
}

const fmtAvg = (avg: number) => avg.toFixed(1);

/** Mono readout: `560 / 720 · 72 arrows · 70 m · avg 7.8`; match scores read `Elimination 6–4 · vs seed 3`. */
export function formatScore(s: ParsedScore): string {
  if (s.matchScore) return [`${s.label} ${s.matchScore}`, s.note].filter(Boolean).join(' · ');
  const parts: string[] = [];
  const max = maxOf(s);
  parts.push(max !== undefined ? `${s.total} / ${max}` : `${s.total}`);
  if (s.arrows) parts.push(`${s.arrows} arrows`);
  if (s.distance) parts.push(s.distance);
  const avg = averagePerArrow(s);
  if (avg !== undefined) parts.push(`avg ${fmtAvg(avg)}`);
  if (s.note) parts.push(s.note);
  return parts.join(' · ');
}

/** `560/720, 72 arrows, 70 m` for the resume line. */
export function formatScoreForResume(s: ParsedScore): string {
  if (s.matchScore) return `${s.label} ${s.matchScore}`;
  const max = maxOf(s);
  const parts = [max !== undefined ? `${s.total}/${max}` : `${s.total}`];
  if (s.arrows) parts.push(`${s.arrows} arrows`);
  if (s.distance) parts.push(s.distance);
  return parts.join(', ');
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const suffix = ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Ring value (1–10) the average arrow lands in. */
export const ringFor = (avg: number): number => clamp(Math.round(avg), 1, 10);
/** Radius on a 100-unit face: an average of 8.0 sits in the middle of the 8 ring. */
export const radiusFor = (avg: number): number => clamp((10.5 - avg) * 10, 0, 100);

/** Text before the first " — " (every archery title uses it). */
export const shortTitle = (title: string): string => title.split(' — ')[0].trim() || title;

/** Human-readable problems with a line that parses but whose numbers cannot be right (for check-content). */
export function scoreProblems(raw: string): string[] {
  const s = parseScore(raw);
  if (!s || s.total === undefined) return [];
  const out: string[] = [];
  if (s.max !== undefined && s.total > s.max) out.push(`the total (${s.total}) is higher than the maximum (${s.max})`);
  else if (s.max === undefined && s.arrows && s.total > s.arrows * 10) out.push(`the total (${s.total}) is higher than ${s.arrows} arrows can score (${s.arrows * 10})`);
  if (s.max !== undefined && s.arrows && s.max !== s.arrows * 10) out.push(`the maximum (${s.max}) is not ${s.arrows} arrows × 10 (${s.arrows * 10})`);
  return out;
}

export interface ArcheryInput {
  category: string;
  scores?: readonly string[] | null;
  placing?: number | null;
  division?: string | null;
  distance?: string | null;
  result?: string | null;
}

export type ArcheryPresentation =
  | { kind: 'target'; score: ParsedScore; avg: number; ring: number; placing?: number; division?: string; distance?: string }
  | { kind: 'compact'; placing: number; division?: string; distance?: string }
  | { kind: 'none' };

/**
 * The one place that decides what an athletics entry shows: a target face (a score with total and
 * arrows), a compact placing badge (placing only), or nothing (WAYC, or any non-athletics entry).
 */
export function archeryPresentation(data: ArcheryInput): ArcheryPresentation {
  if (data.category !== 'athletics') return { kind: 'none' };
  const division = data.division || undefined;
  const placing = typeof data.placing === 'number' ? data.placing : undefined;
  const best = bestScore(data.scores ?? []);
  const avg = best ? averagePerArrow(best) : undefined;
  if (best && avg !== undefined) {
    return { kind: 'target', score: best, avg, ring: ringFor(avg), placing, division, distance: best.distance ?? data.distance ?? undefined };
  }
  if (placing !== undefined) return { kind: 'compact', placing, division, distance: data.distance ?? undefined };
  return { kind: 'none' };
}
