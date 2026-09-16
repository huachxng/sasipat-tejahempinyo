import { z } from 'astro/zod';
import { commonFields, dateField, optionalDate } from './common.ts';

export const postSchema = z.object({
  ...commonFields,
  date: dateField('date'),
  updated: optionalDate('updated'),
  comments: z.boolean().default(true),
  cover: z.string().trim().optional(),
});
export type PostData = z.infer<typeof postSchema>;
