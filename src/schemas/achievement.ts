import { z } from 'astro/zod';
import { commonFields, dateField, optionalDate, stringList } from './common.ts';
import { CATEGORY_KEYS, RESUME_SECTIONS } from '../site.config.ts';

const categoryField = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.enum(CATEGORY_KEYS, { error: `category is missing or misspelled. Choose one of: ${CATEGORY_KEYS.join(', ')}` }),
);

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
  })
  .refine((d) => !d.endDate || d.endDate >= d.date, { message: 'endDate must be on or after date', path: ['endDate'] });
export type AchievementData = z.infer<typeof achievementSchema>;
