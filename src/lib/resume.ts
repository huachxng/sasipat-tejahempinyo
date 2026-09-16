// Resume model: the single source for /resume, /resume.json and scripts/resume-pdf.mjs.
// Plain TypeScript on purpose: no astro:* imports, plain data in, JSON-serialisable data out,
// so Node (the PDF script) and vitest can import it directly.
import {
  PERSON,
  SITE_URL,
  RESUME_SECTIONS,
  RESUME_SECTION_BY_CATEGORY,
  RESUME_SECTION_CAP,
  type CategoryKey,
  type ResumeSection,
} from '../site.config.ts';
import { dateRange } from './dates.ts';

/** The fields of an achievement entry the model reads (a CollectionEntry<'achievements'> satisfies this). */
export interface ResumeAchievementInput {
  id: string;
  data: {
    title?: string;
    date: Date;
    endDate?: Date;
    dateText?: string;
    category: CategoryKey;
    org?: string;
    result?: string;
    resume?: boolean;
    resumeLine?: string;
    resumeSection?: ResumeSection;
  };
}

/** The fields of profile.md the model reads (a CollectionEntry<'profile'> satisfies this). */
export interface ResumeProfileInput {
  data: {
    name: string;
    nickname?: string;
    headline?: string;
    resumeHeadline?: string;
    school?: string;
    classOf?: number;
    location?: string;
    email?: string;
    links?: string[];
    skills?: string[];
    languages?: string[];
    coursework?: string[];
    tests?: string[];
    education?: string[];
  };
}

export interface ResumeLink {
  label: string;
  href: string;
}
export interface ResumeHeader {
  /** Legal name. Never the pen name. */
  name: string;
  nickname?: string;
  headline?: string;
  email?: string;
  github?: string;
  location?: string;
  school?: string;
  classOf?: number;
  /** Every profile link (GitHub included) for renderers that want the full list. */
  links: ResumeLink[];
}
export interface ResumeItem {
  id: string;
  title: string;
  line: string;
  org?: string;
  dateText: string;
  /** Root-relative URL of the achievement page. */
  href: string;
}
export interface ResumeSectionModel {
  title: ResumeSection;
  /** The newest `cap` entries: what the PDF prints. */
  items: ResumeItem[];
  /** Everything past the cap: the web page shows it under "more"; the PDF omits it. */
  more: ResumeItem[];
}
export interface ResumeModel {
  header: ResumeHeader;
  /** Education lines: the school line first, then profile.education. */
  education: string[];
  /** Achievement sections in RESUME_SECTIONS order; empty sections are omitted. */
  sections: ResumeSectionModel[];
  skills: string[];
  languages: string[];
  coursework: string[];
  tests: string[];
  /** Number of achievements on the resume (items + overflow). */
  count: number;
  /** Suggested download name for the PDF. */
  fileName: string;
  siteUrl: string;
}
export interface ResumeOptions {
  /** Per-section cap; defaults to RESUME_SECTION_CAP. */
  cap?: number;
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/** "Sasipat (Hua) Tejahempinyo" → "Sasipat Tejahempinyo". Falls back to the configured legal name. */
export function legalName(name: string | undefined): string {
  const stripped = collapse(
    (name ?? '')
      .replace(/\s*\([^)]*\)/g, ' ')
      .replace(/\s*["“”][^"“”]*["“”]/g, ' '),
  );
  return stripped || PERSON.legalName;
}

/** "https://www.github.com/huachxng/" → "github.com/huachxng" */
export const prettyUrl = (href: string) =>
  href
    .replace(/^[a-z]+:\/\//i, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');

/** "GitHub | https://github.com/x" → { label: 'GitHub', href }. A bare URL gets its host as label. */
export function parseLink(raw: string): ResumeLink | undefined {
  const [a = '', b] = raw.split('|').map((x) => x.trim());
  const href = b ?? a;
  if (!href) return undefined;
  return { label: b ? a : prettyUrl(href), href };
}

/** Drops empty "()" placeholders from profile lines. */
const cleanLine = (s: string) => collapse(s.replace(/\(\s*\)/g, ''));

const defaultLine = (title: string, org?: string, result?: string) =>
  title + (org ? ` — ${org}` : '') + (result ? `${org ? ', ' : ' — '}${result}` : '');

const time = (d?: Date) => (d ? d.getTime() : 0);
const byDateDesc = (a: ResumeAchievementInput, b: ResumeAchievementInput) =>
  time(b.data.date) - time(a.data.date) ||
  time(b.data.endDate) - time(a.data.endDate) ||
  (a.data.title ?? a.id).localeCompare(b.data.title ?? b.id);

export const sectionOf = (a: ResumeAchievementInput): ResumeSection =>
  a.data.resumeSection ?? RESUME_SECTION_BY_CATEGORY[a.data.category];

export function toResumeItem(a: ResumeAchievementInput): ResumeItem {
  const d = a.data;
  const title = collapse(d.title ?? a.id);
  return {
    id: a.id,
    title,
    line: collapse(d.resumeLine ?? defaultLine(title, d.org, d.result)),
    org: d.org,
    dateText: dateRange(d.date, d.endDate, d.dateText),
    href: `/achievements/${a.id}`,
  };
}

export function buildResumeModel(
  achievements: ResumeAchievementInput[],
  profile: ResumeProfileInput,
  options: ResumeOptions = {},
): ResumeModel {
  const cap = options.cap ?? RESUME_SECTION_CAP;
  const p = profile.data;

  const links = (p.links ?? []).map(parseLink).filter((l): l is ResumeLink => Boolean(l));
  const github = links.find((l) => /github/i.test(l.label) || /github\.com/i.test(l.href))?.href ?? PERSON.github;
  const school = p.school ?? PERSON.school;
  const classOf = p.classOf ?? PERSON.classOf;
  const name = legalName(p.name);
  const header: ResumeHeader = {
    name,
    nickname: p.nickname ?? PERSON.nickname,
    headline: p.resumeHeadline ?? p.headline,
    email: p.email ?? PERSON.email,
    github,
    location: p.location ?? PERSON.location,
    school,
    classOf,
    links,
  };

  // Education: the school line comes first. A fuller school line the author wrote in
  // profile.education wins; a bare school name is replaced by the generated line.
  const schoolLine = classOf ? `${school} — Class of ${classOf}` : school;
  const lines = (p.education ?? []).map(cleanLine).filter(Boolean);
  const isSchool = (l: string) => l.toLowerCase().startsWith(school.toLowerCase());
  const authored = lines.some((l) => isSchool(l) && l.length > school.length);
  const education = authored ? lines : [schoolLine, ...lines.filter((l) => !isSchool(l))];

  const eligible = achievements.filter((a) => a.data.resume !== false);
  const grouped = new Map<ResumeSection, ResumeAchievementInput[]>();
  for (const a of eligible) {
    const key = sectionOf(a);
    const list = grouped.get(key) ?? [];
    list.push(a);
    grouped.set(key, list);
  }
  const sections: ResumeSectionModel[] = [];
  for (const title of RESUME_SECTIONS) {
    const list = grouped.get(title);
    if (!list?.length) continue;
    const items = [...list].sort(byDateDesc).map(toResumeItem);
    sections.push({ title, items: items.slice(0, cap), more: items.slice(cap) });
  }

  return {
    header,
    education,
    sections,
    skills: p.skills ?? [],
    languages: p.languages ?? [],
    coursework: p.coursework ?? [],
    tests: p.tests ?? [],
    count: eligible.length,
    fileName: `${name.split(' ').join('-')}-Resume.pdf`,
    siteUrl: SITE_URL,
  };
}
