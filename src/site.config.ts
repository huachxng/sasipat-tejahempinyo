// Single place for names, chapters, categories and service ids.
export const SITE_URL = 'https://sasipat-tejahempinyo.vercel.app';
export const REPO = 'huachxng/sasipat-tejahempinyo';

export const PERSON = {
  legalName: 'Sasipat Tejahempinyo',
  displayName: 'Sasipat (Hua) Tejahempinyo',
  firstName: 'Sasipat',
  lastName: 'Tejahempinyo',
  nickname: 'Hua',
  penName: 'Noah',
  stanfordAlias: 'Landa Tejahempinyo',
  school: 'BASIS International School Bangkok',
  classOf: 2027,
  location: 'Bangkok, Thailand',
  email: 's.tejahempinyo@gmail.com',
  github: 'https://github.com/huachxng',
  linkedin: '' as string, // set when the profile is live
} as const;

export const BYLINE = {
  notes: PERSON.penName,
  blog: PERSON.penName,
  achievements: PERSON.displayName,
  profile: PERSON.displayName,
} as const;

export type ChapterSlug = 'achievements' | 'notes' | 'about' | 'resume' | 'contact';
export interface Chapter { num: string; slug: ChapterSlug; title: string; href: string; dek: string }
export const CHAPTERS: Chapter[] = [
  { num: '01', slug: 'achievements', title: 'Achievements', href: '/achievements', dek: 'Competitions, research, ventures and service, newest first.' },
  { num: '02', slug: 'notes', title: 'Notes & Blog', href: '/notes', dek: 'Connected notes on markets, data and archery, plus longer essays.' },
  { num: '03', slug: 'about', title: 'About', href: '/about', dek: 'Who is writing, and under which names.' },
  { num: '04', slug: 'resume', title: 'Resume', href: '/resume', dek: 'One page, generated from the same entries as the timeline.' },
  { num: '05', slug: 'contact', title: 'Contact', href: '/contact', dek: 'Email and links.' },
];
export const chapterBySlug = (slug: ChapterSlug) => CHAPTERS.find((c) => c.slug === slug)!;

export const CATEGORY_KEYS = ['academics', 'research', 'ventures', 'leadership', 'athletics', 'arts', 'mathematics', 'camps'] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];
export const CATEGORIES: Record<CategoryKey, string> = {
  academics: 'Academics',
  research: 'Research',
  ventures: 'Ventures',
  leadership: 'Leadership & Service',
  athletics: 'Athletics / Archery',
  arts: 'Arts & Music',
  mathematics: 'Mathematics',
  camps: 'Camps & Summer Programs',
};

export const RESUME_SECTIONS = ['Education', 'Research', 'Honors & Awards', 'Athletics', 'Leadership & Service', 'Ventures & Media', 'Arts & Music', 'Programs', 'Skills'] as const;
export type ResumeSection = (typeof RESUME_SECTIONS)[number];
export const RESUME_SECTION_BY_CATEGORY: Record<CategoryKey, ResumeSection> = {
  academics: 'Honors & Awards',
  mathematics: 'Honors & Awards',
  research: 'Research',
  leadership: 'Leadership & Service',
  athletics: 'Athletics',
  ventures: 'Ventures & Media',
  arts: 'Arts & Music',
  camps: 'Programs',
};
export const RESUME_SECTION_CAP = 8;

// Discussions are enabled on the repo. Ids (captured 2026-09-16): repoId 'R_kgDOUdpVhQ', category 'Announcements' id 'DIC_kwDOUdpVhc4DFvw9'.
// Fill them in below ONLY after the giscus GitHub App is installed on the repo, otherwise visitors see a giscus error box.
export const GISCUS = {
  repo: REPO,
  repoId: 'R_kgDOUdpVhQ',
  category: 'Announcements',
  categoryId: 'DIC_kwDOUdpVhc4DFvw9',
};

export const GRAPH = {
  tagHubMin: 7, // tags with at least this many members become hub nodes
  hubCount: 12,
};
