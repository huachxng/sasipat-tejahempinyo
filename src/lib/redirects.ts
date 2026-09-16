import { buildVaultIndex, hrefFor } from './vault.ts';
import GithubSlugger from 'github-slugger';

/** { '/notes/old-name': '/notes/new-name' } from every entry's previousSlugs. Cheap frontmatter scan. */
export function previousSlugsRedirects(): Record<string, string> {
  const out: Record<string, string> = {};
  const vault = buildVaultIndex();
  for (const e of vault.entries) {
    if (!e.publish) continue;
    const prev = e.frontmatter.previousSlugs;
    if (!Array.isArray(prev)) continue;
    for (const p of prev) {
      if (typeof p !== 'string' || !p.trim()) continue;
      const slug = new GithubSlugger().slug(p.trim().normalize('NFC'));
      if (slug && slug !== e.id) out[hrefFor(e.collection, slug)] = hrefFor(e.collection, e.id);
    }
  }
  return out;
}
