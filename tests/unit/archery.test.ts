import { describe, expect, it } from 'vitest';
import {
  archeryPresentation,
  averagePerArrow,
  bestScore,
  formatScore,
  formatScoreForResume,
  maxOf,
  ordinal,
  parseScore,
  radiusFor,
  ringFor,
  scoreProblems,
  shortTitle,
} from '../../src/lib/archery.ts';
import { achievementSchema } from '../../src/schemas/achievement.ts';

describe('parseScore grammar', () => {
  it('1. reads a full ranking-round line', () => {
    const raw = 'Ranking round | 560/720 | 72 arrows | 70 m';
    expect(parseScore(raw)).toEqual({ label: 'Ranking round', total: 560, max: 720, arrows: 72, distance: '70 m', raw });
  });
  it('2. derives the maximum from the arrow count', () => {
    const s = parseScore('Ranking round | 560 | 72 arrows')!;
    expect(s).toMatchObject({ label: 'Ranking round', total: 560, arrows: 72 });
    expect(s.max).toBeUndefined();
    expect(maxOf(s)).toBe(720);
  });
  it('3. reads a match set score with a note and normalises the dash', () => {
    const s = parseScore('Elimination | 6-4 | vs seed 3')!;
    expect(s).toMatchObject({ label: 'Elimination', matchScore: '6–4', note: 'vs seed 3' });
    expect(s.total).toBeUndefined();
    expect(averagePerArrow(s)).toBeUndefined();
  });
  it('4. tolerates segments out of order (indoor)', () => {
    const s = parseScore('Qualification | 18 m | 540/600 | 60 arrows')!;
    expect(s).toMatchObject({ label: 'Qualification', total: 540, max: 600, arrows: 60, distance: '18 m' });
    expect(averagePerArrow(s)).toBe(9);
  });
  it('5. keeps a total-only line without average or max', () => {
    const s = parseScore('Ranking round | 560')!;
    expect(s).toMatchObject({ label: 'Ranking round', total: 560 });
    expect(maxOf(s)).toBeUndefined();
    expect(averagePerArrow(s)).toBeUndefined();
  });
  it('6. defaults the label when the first segment is the score', () => {
    expect(parseScore('560/720')).toMatchObject({ label: 'Score', total: 560, max: 720 });
    expect(parseScore('6–4 | vs seed 3')).toMatchObject({ label: 'Match', matchScore: '6–4' });
  });
  it('returns null for everything that has no score', () => {
    for (const bad of ['personal best', 'Elimination | reached quarter-finals', ' | | ', '', 'Ranking | 560/720/800', '6-4-2', '72 arrows | 70 m']) {
      expect(parseScore(bad), bad).toBeNull();
    }
  });
  it('accepts "of", "pts"/"points", metres spellings, colons and "sets"', () => {
    expect(parseScore('Ranking | 560 of 720 pts')).toMatchObject({ total: 560, max: 720 });
    expect(parseScore('Ranking | 560 points | 72 arrow')).toMatchObject({ total: 560, arrows: 72 });
    expect(parseScore('Ranking | 560/720 | 70 metres')).toMatchObject({ distance: '70 m' });
    expect(parseScore('Ranking | 560/720 | 18meters')).toMatchObject({ distance: '18 m' });
    expect(parseScore('Ranking | 560/720 | 70m')).toMatchObject({ distance: '70 m' });
    expect(parseScore('Final | 6:4 sets')).toMatchObject({ matchScore: '6–4' });
    expect(parseScore('Final | 6–5')).toMatchObject({ matchScore: '6–5' });
  });
  it('aggregates unknown segments into the note and lets the first value win per field', () => {
    const s = parseScore('Ranking | 560/720 | indoor | shoot-off 9–8 | 72 arrows | 60 arrows')!;
    expect(s.note).toBe('indoor · shoot-off 9–8 · 60 arrows');
    expect(s.arrows).toBe(72);
  });
  it('collapses whitespace and never throws on odd input', () => {
    expect(parseScore('  Ranking   round |  560 / 720  |72   arrows ')).toMatchObject({ label: 'Ranking round', total: 560, max: 720, arrows: 72 });
    expect(() => parseScore('|||||' + '\n' + '\t')).not.toThrow();
  });
});

describe('derivations and formatting', () => {
  const kasetsart = parseScore('Ranking round | 560/720 | 72 arrows | 70 m')!;
  it('average per arrow and the ring/radius mapping', () => {
    expect(averagePerArrow(kasetsart)).toBeCloseTo(7.7777, 3);
    expect(ringFor(7.78)).toBe(8);
    expect(radiusFor(7.78)).toBeCloseTo(27.2, 5);
    expect(ringFor(10)).toBe(10);
    expect(ringFor(5.2)).toBe(5);
    expect(ringFor(0)).toBe(1);
    expect(ringFor(14)).toBe(10);
    expect(radiusFor(8)).toBe(25);
  });
  it('formats the readout and the resume fragment', () => {
    expect(formatScore(kasetsart)).toBe('560 / 720 · 72 arrows · 70 m · avg 7.8');
    expect(formatScore(parseScore('Ranking round | 560 | 72 arrows')!)).toBe('560 / 720 · 72 arrows · avg 7.8');
    expect(formatScore(parseScore('Ranking round | 560')!)).toBe('560');
    expect(formatScore(parseScore('Elimination | 6-4 | vs seed 3')!)).toBe('Elimination 6–4 · vs seed 3');
    expect(formatScoreForResume(kasetsart)).toBe('560/720, 72 arrows, 70 m');
    expect(formatScoreForResume(parseScore('560 | 72 arrows')!)).toBe('560/720, 72 arrows');
  });
  it('bestScore prefers the highest average, then the first with a total', () => {
    const best = bestScore(['Elimination | 6-4', 'Ranking | 540/720 | 72 arrows', 'Qualification | 540/600 | 60 arrows']);
    expect(best?.label).toBe('Qualification');
    const tie = bestScore(['A | 540/720 | 72 arrows', 'B | 270/360 | 36 arrows']);
    expect(tie?.label).toBe('A');
    expect(bestScore(['Elimination | 6-4', 'Ranking | 560'])?.label).toBe('Ranking');
    expect(bestScore(['Elimination | 6-4'])).toBeUndefined();
    expect(bestScore(['garbage', ''])).toBeUndefined();
    expect(bestScore([])).toBeUndefined();
  });
  it('ordinal and shortTitle', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd']);
    expect(shortTitle('23rd Kasetsart Open Archery Competition — 1st Runner-Up, Recurve Women Under-25 70 m')).toBe('23rd Kasetsart Open Archery Competition');
    expect(shortTitle('Nonthaburi Cup')).toBe('Nonthaburi Cup');
  });
  it('scoreProblems flags impossible numbers', () => {
    expect(scoreProblems('Ranking round | 560/500 | 50 arrows')).toEqual(['the total (560) is higher than the maximum (500)']);
    expect(scoreProblems('Ranking round | 560 | 50 arrows')).toEqual(['the total (560) is higher than 50 arrows can score (500)']);
    expect(scoreProblems('Ranking round | 560/720 | 60 arrows')).toEqual(['the maximum (720) is not 60 arrows × 10 (600)']);
    expect(scoreProblems('Ranking round | 560/720 | 72 arrows | 70 m')).toEqual([]);
    expect(scoreProblems('personal best')).toEqual([]);
  });
});

describe('archeryPresentation for the six real entries', () => {
  const kasetsart = { category: 'athletics', scores: ['Ranking round | 560/720 | 72 arrows | 70 m'], placing: 2, division: 'Recurve Women Under-25', distance: '70 m' } as const;
  it('Kasetsart → target', () => {
    const p = archeryPresentation(kasetsart);
    expect(p.kind).toBe('target');
    if (p.kind !== 'target') return;
    expect(p.ring).toBe(8);
    expect(p.avg).toBeCloseTo(7.7777, 3);
    expect(p.placing).toBe(2);
    expect(p.division).toBe('Recurve Women Under-25');
    expect(p.distance).toBe('70 m');
    expect(p.score.total).toBe(560);
  });
  it('the four placing-only entries → compact', () => {
    expect(archeryPresentation({ category: 'athletics', scores: [], placing: 1, division: 'Recurve U15 Women' })).toEqual({ kind: 'compact', placing: 1, division: 'Recurve U15 Women', distance: undefined });
    expect(archeryPresentation({ category: 'athletics', scores: [], placing: 3, division: 'Recurve Under-18 Women', distance: '18 m' })).toEqual({ kind: 'compact', placing: 3, division: 'Recurve Under-18 Women', distance: '18 m' });
    expect(archeryPresentation({ category: 'athletics', scores: [], placing: 3, division: "Women's Recurve", distance: '18 m' }).kind).toBe('compact');
    expect(archeryPresentation({ category: 'athletics', scores: [], placing: 2, division: 'Recurve Women U15 / Open Women' }).kind).toBe('compact');
  });
  it('WAYC (no score, no placing) → none; non-athletics with scores → none', () => {
    expect(archeryPresentation({ category: 'athletics', scores: [] })).toEqual({ kind: 'none' });
    expect(archeryPresentation({ ...kasetsart, category: 'academics' })).toEqual({ kind: 'none' });
  });
  it('a total without arrows falls back to the placing, and the score distance beats the top-level one', () => {
    expect(archeryPresentation({ category: 'athletics', scores: ['Ranking | 560'], placing: 2 })).toMatchObject({ kind: 'compact', placing: 2 });
    expect(archeryPresentation({ category: 'athletics', scores: ['Ranking | 560'] })).toEqual({ kind: 'none' });
    const p = archeryPresentation({ category: 'athletics', scores: ['Ranking | 540/600 | 60 arrows | 18 m'], distance: '70 m' });
    expect(p).toMatchObject({ kind: 'target', distance: '18 m' });
    const q = archeryPresentation({ category: 'athletics', scores: ['Ranking | 540 | 60 arrows'], distance: '70 m' });
    expect(q).toMatchObject({ kind: 'target', distance: '70 m' });
  });
  it('an unparseable line is skipped, not fatal', () => {
    expect(archeryPresentation({ category: 'athletics', scores: ['personal best', 'Ranking | 560/720 | 72 arrows'] }).kind).toBe('target');
  });
});

describe('achievementSchema archery fields', () => {
  const base = { publish: true, title: 'T', date: new Date('2025-03-13'), category: 'athletics' };
  const PLACING_MSG = 'placing must be a whole number from 1 to 3 (1 = winner). Leave it out for anything below the podium';
  it('accepts the Kasetsart block', () => {
    const r = achievementSchema.safeParse({ ...base, scores: ['Ranking round | 560/720 | 72 arrows | 70 m'], placing: 2, division: 'Recurve Women Under-25', distance: '70 m' });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.scores).toEqual(['Ranking round | 560/720 | 72 arrows | 70 m']);
    expect(r.data.placing).toBe(2);
    expect(r.data.division).toBe('Recurve Women Under-25');
    expect(r.data.distance).toBe('70 m');
  });
  it('defaults scores to [] and treats blank placing/division/distance as absent', () => {
    const r = achievementSchema.safeParse({ ...base, placing: null, division: '', distance: null, scores: null });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.scores).toEqual([]);
    expect(r.data.placing).toBeUndefined();
    expect(r.data.division).toBeUndefined();
    expect(r.data.distance).toBeUndefined();
    const s = achievementSchema.safeParse({ ...base, placing: '' });
    expect(s.success && s.data.placing).toBeUndefined();
  });
  it('coerces a bare YAML number in scores to text', () => {
    const r = achievementSchema.safeParse({ ...base, scores: [560, ' 6-4 '] });
    expect(r.success && r.data.scores).toEqual(['560', '6-4']);
    const bad = achievementSchema.safeParse({ ...base, scores: [null] });
    expect(bad.success).toBe(false);
    if (bad.success) return;
    expect(bad.error.issues[0].message).toBe('each scores line must be text like "Ranking round | 560/720 | 72 arrows | 70 m"');
  });
  it('rejects placing outside 1–3, fractions and words with the one message', () => {
    for (const v of [0, 4, 2.5, 'second']) {
      const r = achievementSchema.safeParse({ ...base, placing: v });
      expect(r.success, String(v)).toBe(false);
      if (r.success) continue;
      expect(r.error.issues[0].path).toEqual(['placing']);
      expect(r.error.issues[0].message).toBe(PLACING_MSG);
    }
  });
});
