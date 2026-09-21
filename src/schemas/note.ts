import { z } from 'astro/zod';
import { commonFields, optionalDate } from './common.ts';

export const noteSchema = z.object({
  ...commonFields,
  date: optionalDate('date'),
  updated: optionalDate('updated'),
  comments: z.boolean().default(false),
  cover: z.string().trim().optional(),
  /** Literature pieces: kind: essay plus course / written / prompt. */
  kind: z.enum(['note', 'essay'], { error: 'kind must be note or essay' }).default('note'),
  course: z.string().trim().optional(),
  written: optionalDate('written'),
  prompt: z.string().trim().optional(),
});
export type NoteData = z.infer<typeof noteSchema>;
