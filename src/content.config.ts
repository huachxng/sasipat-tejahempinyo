import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import GithubSlugger from 'github-slugger';
import { basename, extname } from 'node:path';
import { noteSchema } from './schemas/note.ts';
import { postSchema } from './schemas/post.ts';
import { achievementSchema } from './schemas/achievement.ts';
import { profileSchema } from './schemas/profile.ts';

// Id = frontmatter slug if given, else the file name. Underscore-prefixed files and folders are never loaded.
const generateId = ({ entry, data }: { entry: string; data: Record<string, unknown> }) => {
  const slugger = new GithubSlugger();
  const raw = typeof data.slug === 'string' && data.slug.trim() ? data.slug.trim() : basename(entry, extname(entry));
  return slugger.slug(raw.normalize('NFC'));
};
const patternFor = (folder: string) => [`${folder}/**/*.md`, '!**/_*', '!**/_*/**'];

export const collections = {
  notes: defineCollection({ loader: glob({ pattern: patternFor('notes'), base: './content', generateId }), schema: noteSchema }),
  blog: defineCollection({ loader: glob({ pattern: patternFor('blog'), base: './content', generateId }), schema: postSchema }),
  achievements: defineCollection({ loader: glob({ pattern: patternFor('achievements'), base: './content', generateId }), schema: achievementSchema }),
  profile: defineCollection({ loader: glob({ pattern: 'profile.md', base: './content', generateId: () => 'profile' }), schema: profileSchema }),
};
