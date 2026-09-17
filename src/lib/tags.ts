import { stripComments } from './wikilinks.ts';

export const normalizeTag = (t: string) =>
  t.normalize('NFC').trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-').replace(/\/+$/, '');

/** Inline #tags in Markdown, excluding code, math, URLs, headings and pure numbers. */
export function extractInlineTags(body: string): string[] {
  let text = stripComments(body);
  text = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]*\$/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^#{1,6}\s.*$/gm, ' ')
    .replace(/!?\[\[[^\]]*\]\]/g, ' ');
  const out = new Set<string>();
  for (const m of text.matchAll(/(?<![\w#&/.])#([\p{L}\p{M}\p{N}_/-]+)/gu)) {
    const tag = m[1].replace(/[/-]+$/, '');
    if (!tag || !/[\p{L}_]/u.test(tag)) continue;
    out.add(normalizeTag(tag));
  }
  return [...out];
}

export function allTags(frontmatterTags: unknown, body: string): string[] {
  const fm = Array.isArray(frontmatterTags) ? frontmatterTags : typeof frontmatterTags === 'string' ? [frontmatterTags] : [];
  const set = new Set<string>();
  for (const t of fm) if (typeof t === 'string' && t.trim()) set.add(normalizeTag(t));
  for (const t of extractInlineTags(body)) set.add(t);
  set.delete('');
  return [...set].sort();
}
