import { z } from 'astro/zod';

export const publishField = z.boolean({ error: 'publish must be true or false (tick the checkbox)' }).default(false);
export const stringList = z.array(z.string().trim().min(1)).default([]);

/** Fields shared by notes, blog posts and achievements. Flat on purpose: Obsidian's Properties panel cannot edit nested YAML. */
export const commonFields = {
  publish: publishField,
  title: z.string({ error: 'title must be text' }).trim().min(1, 'Add a title').optional(),
  slug: z.string().trim().min(1).optional(),
  previousSlugs: stringList,
  tags: stringList,
  aliases: stringList,
  summary: z.string({ error: 'summary must be text' }).trim().optional(),
  thai: z.string().trim().optional(),
};

export const dateField = (label: string) =>
  z.coerce.date({ error: `${label} must be a date like 2026-09-16` });

/** Obsidian writes `field:` with no value (YAML null) or `""` when a template field is left blank; treat both as absent. */
export const emptyAsAbsent = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === null || v === undefined || (typeof v === 'string' && v.trim() === '') ? undefined : v), schema);

/** Obsidian writes `endDate:` with no value when a template field is left blank; treat empty as absent. */
export const optionalDate = (label: string) => emptyAsAbsent(dateField(label).optional());
