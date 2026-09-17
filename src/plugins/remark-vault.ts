// Obsidian syntax for the site: %% comments %%, [[wikilinks]], ![[image embeds]], inline #tags, ==highlights==.
// Runs before Astro collects images, so ![[img.jpg]] becomes a real mdast image node that Sharp optimises.
import type { Root, RootContent, Parent, Text, PhrasingContent } from 'mdast';
import type { VFile } from 'vfile';
import { toString } from 'mdast-util-to-string';
import { getVault, relativeMediaPath, norm } from '../lib/vault.ts';
import { WIKILINK_RE, resolveWikilink, isImageTarget, isDocumentTarget, headingAnchor } from '../lib/wikilinks.ts';
import { normalizeTag } from '../lib/tags.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TOKEN_RE = new RegExp(
  [
    '(%%[\\s\\S]*?%%)', // 1 inline comment
    WIKILINK_RE.source.replace(/\(\?<[a-z]+>/g, '('), // 2 bang, 3 target, 4 hash, 5 alias
    '(==([^=\\n]+?)==)', // 6,7 highlight
    '((?<![\\w#&/.])#([\\p{L}\\p{M}\\p{N}_/-]*[\\p{L}_][\\p{L}\\p{M}\\p{N}_/-]*))', // 8,9 tag
  ].join('|'),
  'gu',
);

export interface VaultWarning { file: string; message: string }

export function remarkVault() {
  return (tree: Root, file: VFile) => {
    const vault = getVault();
    const warnings: VaultWarning[] = [];
    const filePath = file.path ?? '';
    const warn = (message: string) => {
      warnings.push({ file: filePath, message });
      if (process.env.NODE_ENV !== 'test') console.warn(`[vault] ${filePath}: ${message}`);
    };

    // 1. Block comments: a root paragraph starting with %% through the root node ending with %%.
    const kids = tree.children;
    for (let i = 0; i < kids.length; i++) {
      const s = toString(kids[i]).trim();
      if (!s.startsWith('%%')) continue;
      const closesItself = s.length > 2 && s.slice(2).includes('%%');
      if (closesItself) continue; // handled inline
      let j = i;
      while (j < kids.length && !toString(kids[j]).trim().endsWith('%%')) j++;
      if (j >= kids.length) {
        warn(`unbalanced %% comment: everything after this point would be hidden (line ${kids[i].position?.start.line ?? '?'})`);
        j = kids.length - 1;
      }
      kids.splice(i, j - i + 1);
      i--;
    }

    // 2. Inline tokens in text nodes.
    walk(tree, [], (node, parents) => {
      const inHeading = parents.some((p) => p.type === 'heading');
      const inLink = parents.some((p) => p.type === 'link' || p.type === 'linkReference');
      const parent = parents[parents.length - 1] as Parent;
      const idx = parent.children.indexOf(node as RootContent);
      const value = node.value;
      const out: PhrasingContent[] = [];
      let last = 0;
      let changed = false;
      for (const m of value.matchAll(TOKEN_RE)) {
        const start = m.index ?? 0;
        const push = (n: PhrasingContent | null) => {
          if (start > last) out.push({ type: 'text', value: value.slice(last, start) });
          if (n) out.push(n);
          last = start + m[0].length;
          changed = true;
        };
        if (m[1] !== undefined) { push(null); continue; }
        if (m[3] !== undefined || m[2] !== undefined) {
          if (inLink) continue;
          push(wikilinkNode(m[2] === '!', (m[3] ?? '').trim(), m[4], m[5]));
          continue;
        }
        if (m[7] !== undefined) { push({ type: 'html', value: `<mark>${esc(m[7])}</mark>` }); continue; }
        if (m[9] !== undefined) {
          if (inHeading || inLink) continue;
          const tag = normalizeTag(m[9]);
          push({ type: 'link', url: `/tags/${encodeURIComponent(tag)}`, children: [{ type: 'text', value: `#${tag}` }], data: { hProperties: { className: ['tag-inline'], rel: 'tag' } } } as unknown as PhrasingContent);
        }
      }
      if (!changed) return;
      if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
      parent.children.splice(idx, 1, ...(out as RootContent[]));
    });

    (file.data as Record<string, unknown>).vaultWarnings = warnings;

    function wikilinkNode(embed: boolean, target: string, hash?: string, alias?: string): PhrasingContent {
      if (isDocumentTarget(target)) {
        warn(`"${target}" is a document; link out instead of embedding it`);
        return { type: 'html', value: `<span class="wl-missing">${esc(alias ?? target)}</span>` };
      }
      if (embed && isImageTarget(target)) {
        const name = target.split('/').pop()!;
        const abs = vault.media.get(norm(name));
        if (!abs) {
          warn(`image "${name}" not found in content/media`);
          return { type: 'html', value: `<span class="wl-missing">[image missing: ${esc(name)}]</span>` };
        }
        const width = alias && /^\d+$/.test(alias) ? Number(alias) : undefined;
        const alt = alias && !width ? alias : '';
        const url = filePath ? relativeMediaPath(filePath, abs) : abs;
        const hProperties: Record<string, unknown> = { class: 'vault-img' };
        if (width) hProperties.width = width;
        return { type: 'image', url, alt, title: null, data: { hProperties } } as unknown as PhrasingContent;
      }
      const res = resolveWikilink(target, vault);
      const text = alias && alias.trim() ? alias.trim() : hash && !hash.startsWith('^') ? `${res.ok ? res.entry.title : target} › ${hash}` : res.ok ? res.entry.title : target;
      if (!res.ok) {
        if (res.reason === 'ambiguous') warn(`"[[${target}]]" matches ${res.candidates.length} files; write [[${res.candidates[0].collection}/${target}]]`);
        else if (res.reason === 'unpublished') warn(`"[[${target}]]" points to an unpublished note; it renders as plain text`);
        else if (res.reason === 'missing') warn(`"[[${target}]]" not found${res.candidates.length ? ` (did you mean: ${res.candidates.map((c) => c.title).join(', ')})` : ''}`);
        return { type: 'html', value: `<span class="wl-missing" title="not published yet">${esc(text)}</span>` };
      }
      let url = res.href;
      if (hash && !hash.startsWith('^')) url += headingAnchor(hash);
      else if (hash) warn(`block reference "^${hash.slice(1)}" is not supported; linking to the note instead`);
      return { type: 'link', url, title: null, children: [{ type: 'text', value: text }], data: { hProperties: { className: ['wl'], 'data-kind': res.entry.collection } } } as unknown as PhrasingContent;
    }
  };
}

function walk(node: Parent, parents: Parent[], fn: (t: Text, parents: Parent[]) => void) {
  // iterate over a copy because fn may splice the children array
  for (const child of [...node.children]) {
    if (child.type === 'text') fn(child as Text, [...parents, node]);
    else if (child.type === 'code' || child.type === 'inlineCode' || child.type === 'math' || child.type === 'inlineMath' || child.type === 'html') continue;
    else if ('children' in child) walk(child as Parent, [...parents, node], fn);
  }
}
export default remarkVault;
