import { z } from 'astro/zod';
import { commonFields, dateField, emptyAsAbsent, optionalDate, stringList } from './common.ts';
import { CATEGORY_KEYS, RESUME_SECTIONS } from '../site.config.ts';

const categoryField = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.enum(CATEGORY_KEYS, { error: `category is missing or misspelled. Choose one of: ${CATEGORY_KEYS.join(', ')}` }),
);

// Archery (athletics only). Flat and optional; the grammar of a scores line lives in src/lib/archery.ts.
const SCORE_LINE_MSG = 'each scores line must be text like "Ranking round | 560/720 | 72 arrows | 70 m"';
const PLACING_MSG = 'placing must be a whole number from 1 to 3 (1 = winner). Leave it out for anything below the podium';
/** One line per round. A bare `- 560` arrives from YAML as a number, so numbers are coerced to text. */
const scoresField = emptyAsAbsent(
  z.array(z.preprocess((v) => (typeof v === 'number' ? String(v) : v), z.string({ error: SCORE_LINE_MSG }).trim().min(1, SCORE_LINE_MSG))).default([]),
);
const placingField = emptyAsAbsent(z.number({ error: PLACING_MSG }).int(PLACING_MSG).min(1, PLACING_MSG).max(3, PLACING_MSG).optional());
const optionalText = emptyAsAbsent(z.string().trim().optional());

export const achievementSchema = z
  .object({
    ...commonFields,
    date: dateField('date'),
    endDate: optionalDate('endDate'),
    dateText: z.string().trim().optional(),
    category: categoryField,
    org: z.string().trim().optional(),
    location: z.string().trim().optional(),
    result: z.string().trim().optional(),
    cover: z.string().trim().optional(),
    certificate: z.string().trim().optional(),
    links: stringList,
    resume: z.boolean().default(true),
    resumeLine: z.string().trim().optional(),
    resumeSection: z.enum(RESUME_SECTIONS).optional(),
    featured: z.boolean().default(false),
    /** Archery: one line per round, "Round | score | details" (see content/README.md). Ignored outside athletics. */
    scores: scoresField,
    /** Archery: best podium place at the event, 1–3. */
    placing: placingField,
    /** Archery: division as a clean chip, e.g. "Recurve U18 Women". */
    division: optionalText,
    /** Archery: event distance, e.g. "70 m"; a distance inside a scores line wins. */
    distance: optionalText,
  })
  .refine((d) => !d.endDate || d.endDate >= d.date, { message: 'endDate must be on or after date', path: ['endDate'] });
export type AchievementData = z.infer<typeof achievementSchema>;
