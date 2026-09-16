// Build-time index of the Obsidian vault at content/. Synchronous so remark plugins can use it.
import { readFileSync, existsSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'tinyglobby';
import { parse as parseYaml } from 'yaml';
import GithubSlugger from 'github-slugger';

export type Collection = 'notes' | 'blog' | 'achievements';
export interface VaultEntry {
  collection: Collection;
  /** URL id, identical to the content collection id */
  id: string;
  title: string;
  publish: boolean;
  /** absolute path of the .md file */
  path: string;
  /** vault-relative path without extension, e.g. "notes/Bubble Intensity Score" */
  rel: string;
  basename: string;
  aliases: string[];
  frontmatter: Record<string, unknown>;
  body: string;
}
export interface VaultIndex {
  root: string;
  mediaDir: string;
  entries: VaultEntry[];
  byRel: Map<string, VaultEntry>;
  byBasename: Map<string, VaultEntry[]>;
  byAlias: Map<string, VaultEntry[]>;
  media: Map<string, string>; // normalized basename -> absolute path
  mediaExact: Set<string>; // exact-case basenames present on disk
}

export const CONTENT_DIR = fileURLToPath(new URL('../../content/', import.meta.url));
const FOLDERS: Record<Collection, string> = { notes: 'notes', blog: 'blog', achievements: 'achievements' };
export const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|svg)$/i;

export const norm = (s: string) => s.normalize('NFC').trim().toLowerCase();
export const stripMd = (s: string) => s.replace(/\.md$/i, '');
export function makeId(slug: unknown, fileBasename: string): string {
  const slugger = new GithubSlugger();
  const raw = typeof slug === 'string' && slug.trim() ? slug.trim() : fileBasename;
  return slugger.slug(raw.normalize('NFC'));
}
export function hrefFor(collection: Collection, id: string): string {
  return `/${collection}/${id}`;
}
export function kindOf(collection: Collection): 'note' | 'post' | 'ach' {
  return collection === 'notes' ? 'note' : collection === 'blog' ? 'post' : 'ach';
}

export function splitFrontmatter(src: string): { data: Record<string, unknown>; body: string; raw: string } {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) return { data: {}, body: src, raw: '' };
  let data: Record<string, unknown> = {};
  try {
    const parsed = parseYaml(m[1]);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch {
    data = {};
  }
  return { data, body: src.slice(m[0].length), raw: m[1] };
}

const isHidden = (rel: string) => rel.split(/[\\/]/).some((seg) => seg.startsWith('_') || seg.startsWith('.'));

let cache: VaultIndex | null = null;
export function resetVaultCache() {
  cache = null;
}

export function buildVaultIndex(root: string = CONTENT_DIR): VaultIndex {
  const entries: VaultEntry[] = [];
  const byRel = new Map<string, VaultEntry>();
  const byBasename = new Map<string, VaultEntry[]>();
  const byAlias = new Map<string, VaultEntry[]>();
  for (const collection of Object.keys(FOLDERS) as Collection[]) {
    const folder = join(root, FOLDERS[collection]);
    if (!existsSync(folder)) continue;
    const files = globSync(['**/*.md'], { cwd: folder, absolute: true }).sort();
    for (const path of files) {
      const relToFolder = relative(folder, path);
      if (isHidden(relToFolder)) continue;
      const src = readFileSync(path, 'utf8');
      const { data, body } = splitFrontmatter(src);
      const base = basename(path, extname(path)).normalize('NFC');
      const id = makeId(data.slug, base);
      const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : base;
      const aliases = Array.isArray(data.aliases) ? data.aliases.filter((a): a is string => typeof a === 'string') : [];
      const rel = `${FOLDERS[collection]}/${stripMd(relToFolder.split(sep).join('/'))}`;
      const entry: VaultEntry = { collection, id, title, publish: data.publish === true, path, rel, basename: base, aliases, frontmatter: data, body };
      entries.push(entry);
      byRel.set(norm(rel), entry);
      const bk = norm(base);
      byBasename.set(bk, [...(byBasename.get(bk) ?? []), entry]);
      const tk = norm(title);
      if (tk !== bk) byBasename.set(tk, [...(byBasename.get(tk) ?? []), entry]);
      for (const a of aliases) {
        const ak = norm(a);
        byAlias.set(ak, [...(byAlias.get(ak) ?? []), entry]);
      }
    }
  }
  const mediaDir = join(root, 'media');
  const media = new Map<string, string>();
  const mediaExact = new Set<string>();
  if (existsSync(mediaDir)) {
    for (const p of globSync(['**/*'], { cwd: mediaDir, absolute: true })) {
      if (!IMAGE_EXT.test(p)) continue;
      const b = basename(p);
      mediaExact.add(b.normalize('NFC'));
      media.set(norm(b), p);
    }
  }
  return { root, mediaDir, entries, byRel, byBasename, byAlias, media, mediaExact };
}

export function getVault(): VaultIndex {
  if (!cache) cache = buildVaultIndex();
  return cache;
}

/** Relative path from a markdown file to a media file, for mdast image nodes. */
export function relativeMediaPath(fromMdPath: string, mediaAbsPath: string): string {
  const rel = relative(dirname(resolve(fromMdPath)), mediaAbsPath).split(sep).join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}
