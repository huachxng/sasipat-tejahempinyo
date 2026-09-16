import GithubSlugger from 'github-slugger';
import { getVault, hrefFor, norm, stripMd, IMAGE_EXT, type VaultEntry, type VaultIndex } from './vault.ts';

export interface WikiLink {
  raw: string;
  embed: boolean;
  target: string;
  heading?: string;
  block?: string;
  alias?: string;
  index: number;
}

/** [[Target]], [[Target|Alias]], [[Target#Heading]], [[Target#^block]], ![[image.jpg|480]] */
export const WIKILINK_RE = /(!?)\[\[([^\]|#\n]*?)(?:#([^\]|\n]+))?(?:\|([^\]\n]*))?\]\]/g;

export function parseWikilinks(text: string): WikiLink[] {
  const out: WikiLink[] = [];
  for (const m of text.matchAll(WIKILINK_RE)) {
    const [raw, bang, target, hash, alias] = m;
    const link: WikiLink = { raw, embed: bang === '!', target: target.trim(), index: m.index ?? 0 };
    if (hash) {
      if (hash.startsWith('^')) link.block = hash.slice(1);
      else link.heading = hash;
    }
    if (alias !== undefined) link.alias = alias.trim();
    out.push(link);
  }
  return out;
}

export const isImageTarget = (t: string) => IMAGE_EXT.test(t.trim());
export const isDocumentTarget = (t: string) => /\.(pdf|docx?|xlsx?|pptx?|mp4|mov|m4v|zip|heic)$/i.test(t.trim());

export function headingAnchor(heading: string): string {
  return '#' + new GithubSlugger().slug(heading.trim());
}

export type Resolution =
  | { ok: true; entry: VaultEntry; href: string }
  | { ok: false; reason: 'missing' | 'ambiguous' | 'unpublished' | 'empty'; candidates: VaultEntry[] };

/**
 * Resolve a wikilink target the way Obsidian does with "shortest path": exact vault path first,
 * then a vault-unique file name (or title), then an alias.
 */
export function resolveWikilink(target: string, vault: VaultIndex = getVault()): Resolution {
  const t = norm(stripMd(target));
  if (!t) return { ok: false, reason: 'empty', candidates: [] };
  const byPath = vault.byRel.get(t) ?? vault.byRel.get(t.replace(/^\/+/, ''));
  if (byPath) return finish(byPath);
  // "folder/Name" written with only the leaf folder
  const leaf = t.split('/').pop()!;
  const named = vault.byBasename.get(leaf) ?? [];
  if (t.includes('/')) {
    const folder = t.split('/')[0];
    const inFolder = named.filter((e) => e.collection === folder || e.rel.toLowerCase().startsWith(t));
    if (inFolder.length === 1) return finish(inFolder[0]);
  }
  if (named.length === 1) return finish(named[0]);
  if (named.length > 1) {
    const published = named.filter((e) => e.publish);
    if (published.length === 1) return finish(published[0]);
    return { ok: false, reason: 'ambiguous', candidates: named };
  }
  const aliased = vault.byAlias.get(t) ?? [];
  if (aliased.length === 1) return finish(aliased[0]);
  if (aliased.length > 1) return { ok: false, reason: 'ambiguous', candidates: aliased };
  return { ok: false, reason: 'missing', candidates: closest(t, vault) };

  function finish(entry: VaultEntry): Resolution {
    if (!entry.publish && process.env.SHOW_DRAFTS !== '1') return { ok: false, reason: 'unpublished', candidates: [entry] };
    return { ok: true, entry, href: hrefFor(entry.collection, entry.id) };
  }
}

/** Up to three closest names by a cheap similarity, for "did you mean" messages. */
export function closest(t: string, vault: VaultIndex): VaultEntry[] {
  const score = (a: string, b: string) => {
    const A = new Set(a.split(/\W+/).filter(Boolean));
    const B = new Set(b.split(/\W+/).filter(Boolean));
    let s = 0;
    for (const w of A) if (B.has(w)) s++;
    return s / Math.max(1, Math.max(A.size, B.size));
  };
  return [...vault.entries]
    .map((e) => ({ e, s: score(t, norm(e.title)) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((x) => x.e);
}

/** All outgoing note links (not images) in a body, resolved against the vault. */
export function outgoingLinks(body: string, vault: VaultIndex = getVault()): { link: WikiLink; res: Resolution }[] {
  return parseWikilinks(stripComments(body))
    .filter((l) => !isImageTarget(l.target) && !isDocumentTarget(l.target))
    .map((link) => ({ link, res: resolveWikilink(link.target, vault) }));
}

/** Image embeds in a body, in order (file names only). */
export function imageEmbeds(body: string): { name: string; width?: number; alt?: string; raw: string }[] {
  return parseWikilinks(stripComments(body))
    .filter((l) => l.embed && isImageTarget(l.target))
    .map((l) => {
      const width = l.alias && /^\d+$/.test(l.alias) ? Number(l.alias) : undefined;
      return { name: l.target.split('/').pop()!, width, alt: width ? undefined : l.alias, raw: l.raw };
    });
}

/** Remove %% comments %% (inline and multi-line). */
export function stripComments(body: string): string {
  return body.replace(/%%[\s\S]*?%%/g, '');
}

/** True when the body has an odd number of %% markers. */
export function hasUnbalancedComments(body: string): boolean {
  const n = (body.match(/%%/g) ?? []).length;
  return n % 2 === 1;
}
