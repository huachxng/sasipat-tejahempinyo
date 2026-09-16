import { z } from 'astro/zod';
import { stringList } from './common.ts';

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Add your legal name'),
  nickname: z.string().trim().optional(),
  penName: z.string().trim().optional(),
  stanfordAlias: z.string().trim().optional(),
  headline: z.string().trim().optional(),
  school: z.string().trim().optional(),
  classOf: z.coerce.number().int().optional(),
  location: z.string().trim().optional(),
  email: z.string().trim().email('email must look like name@example.com').optional(),
  links: stringList,
  skills: stringList,
  languages: stringList,
  coursework: stringList,
  tests: stringList,
  now: stringList,
  resumeHeadline: z.string().trim().optional(),
  education: stringList,
});
export type ProfileData = z.infer<typeof profileSchema>;
