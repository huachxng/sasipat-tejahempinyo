// JSON-LD helpers. Each function returns a plain object for Base's `jsonLd` prop (Seo.astro serialises it
// into <script type="application/ld+json">). No Astro imports on purpose: scripts and unit tests may import this.
import { PERSON, SITE_URL } from '../site.config.ts';
import type { ProfileData } from '../schemas/profile.ts';

export type JsonLd = Record<string, unknown>;

/** Stable identifier for the site owner, shared by `person()` and the `publisher` of `article()`. */
export const PERSON_ID = `${SITE_URL}/#person`;

/** Absolute URL for a root-relative href (`/about` → `https://…/about`). Absolute URLs pass through unchanged. */
export const absUrl = (href: string): string => new URL(href, SITE_URL).toString();

/** `"GitHub | https://github.com/x"` (the profile.links convention) → the URL part; a bare URL is returned as is. */
const urlOfLink = (line: string): string | undefined => line.split('|').map((s) => s.trim()).find((s) => /^https?:\/\//.test(s));

const uniq = <T>(xs: T[]) => [...new Set(xs)];

/**
 * schema.org Person for `/` and `/about`.
 * Names come from `site.config.ts`; `profile` (from `getProfile().data`) adds description, links, languages and skills.
 */
export function person(profile?: Partial<ProfileData>): JsonLd {
  const [locality, country] = PERSON.location.split(',').map((s) => s.trim());
  const sameAs = uniq([PERSON.github, PERSON.linkedin, ...(profile?.links ?? []).map(urlOfLink)].filter((u): u is string => Boolean(u)));
  const out: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': PERSON_ID,
    name: PERSON.legalName,
    alternateName: [PERSON.nickname, PERSON.penName, PERSON.stanfordAlias],
    givenName: PERSON.firstName,
    familyName: PERSON.lastName,
    url: SITE_URL,
    email: PERSON.email,
    affiliation: { '@type': 'EducationalOrganization', name: PERSON.school },
    address: { '@type': 'PostalAddress', addressLocality: locality, addressCountry: country },
    sameAs,
  };
  if (profile?.headline) out.description = profile.headline;
  if (profile?.languages?.length) out.knowsLanguage = profile.languages;
  if (profile?.skills?.length) out.knowsAbout = profile.skills;
  return out;
}

export interface LinkItem {
  name: string;
  /** root-relative (`/notes/x`) or absolute */
  href: string;
  description?: string;
}

/** BreadcrumbList for detail pages. `items` run from the chapter to the current page, e.g. `[{ name: 'Notes & Blog', href: '/notes' }, { name: title, href }]`. */
export function breadcrumb(items: LinkItem[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absUrl(it.href) })),
  };
}

/** ItemList of links (the achievements timeline, a tag page). Positions are 1-based in array order. */
export function itemList(items: LinkItem[], opts: { name?: string; description?: string } = {}): JsonLd {
  const out: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => {
      const li: JsonLd = { '@type': 'ListItem', position: i + 1, name: it.name, url: absUrl(it.href) };
      if (it.description) li.description = it.description;
      return li;
    }),
  };
  if (opts.name) out.name = opts.name;
  if (opts.description) out.description = opts.description;
  return out;
}

export interface ArticleInput {
  /** Defaults to BlogPosting (posts). Use 'Article' for notes and achievements. */
  type?: 'BlogPosting' | 'Article';
  title: string;
  /** root-relative or absolute URL of the page */
  href: string;
  published: Date;
  modified?: Date;
  description?: string;
  /** root-relative or absolute image URL (an OG crop or the cover) */
  image?: string;
  tags?: string[];
  /** Defaults to the pen name ("Noah"); pass `PERSON.legalName` for achievements. */
  authorName?: string;
  wordCount?: number;
}

/** BlogPosting / Article. The author is a Person linking to `/about`; the publisher is the site owner (`PERSON_ID`). */
export function article(a: ArticleInput): JsonLd {
  const url = absUrl(a.href);
  const out: JsonLd = {
    '@context': 'https://schema.org',
    '@type': a.type ?? 'BlogPosting',
    headline: a.title,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    datePublished: a.published.toISOString(),
    dateModified: (a.modified ?? a.published).toISOString(),
    inLanguage: 'en',
    author: { '@type': 'Person', name: a.authorName ?? PERSON.penName, alternateName: PERSON.legalName, url: absUrl('/about') },
    publisher: { '@type': 'Person', '@id': PERSON_ID, name: PERSON.legalName, url: SITE_URL },
  };
  if (a.description) out.description = a.description;
  if (a.image) out.image = [absUrl(a.image)];
  if (a.tags?.length) out.keywords = a.tags.join(', ');
  if (a.wordCount) out.wordCount = a.wordCount;
  return out;
}
