// Helpers shared by the two achievements pages (underscore = not a route).
import type { Entry } from '../../lib/published.ts';
import type { GraphData, NodeKind } from '../../lib/graph.ts';
import { CATEGORY_KEYS, type CategoryKey } from '../../site.config.ts';

export type Achievement = Entry<'achievements'>;

/** Newest first; ties broken by endDate then title so the order is stable across builds. */
export const byNewest = (a: Achievement, b: Achievement) =>
  b.data.date.getTime() - a.data.date.getTime() ||
  (b.data.endDate?.getTime() ?? 0) - (a.data.endDate?.getTime() ?? 0) ||
  (a.data.title ?? a.id).localeCompare(b.data.title ?? b.id);

export const yearOf = (e: Achievement) => e.data.date.getUTCFullYear();
export const titleOf = (e: Achievement) => e.data.title ?? e.id;
export const hrefOf = (e: Achievement) => `/achievements/${e.id}`;
export const nodeIdOf = (e: Achievement) => `achievements/${e.id}`;

/** Year tabs: the four most recent years present, then "Earlier" when older entries exist. */
export function yearTabs(entries: Achievement[]): { tabs: string[]; earlierBefore: number } {
  const years = [...new Set(entries.map(yearOf))].sort((a, b) => b - a);
  const shown = years.slice(0, 4);
  const earlierBefore = shown.length ? shown[shown.length - 1] : 0;
  const tabs = shown.map(String);
  if (years.length > shown.length) tabs.push('earlier');
  return { tabs, earlierBefore };
}

export function categoryCounts(entries: Achievement[]): Record<CategoryKey, number> {
  const counts = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0])) as Record<CategoryKey, number>;
  for (const e of entries) counts[e.data.category]++;
  return counts;
}

export interface ExternalLink { label: string; href: string; host: string }
/** Frontmatter links are "Label | https://…" or a bare URL. */
export function parseLink(raw: string): ExternalLink | null {
  const parts = raw.split('|').map((s) => s.trim()).filter(Boolean);
  const href = parts.find((p) => /^https?:\/\//i.test(p)) ?? parts[parts.length - 1];
  if (!href) return null;
  let host = href;
  try { host = new URL(href.includes('://') ? href : `https://${href}`).hostname.replace(/^www\./, ''); } catch { /* keep raw */ }
  const label = parts.find((p) => p !== href) ?? host;
  return { label, href: href.includes('://') ? href : `https://${href}`, host };
}

export interface Connected { id: string; title: string; href: string; kind: NodeKind; context?: string }

/** Outgoing wikilinks, backlinks and graph neighbours of an entry (tag hubs excluded), deduped and ordered. */
export function connectedFor(graph: GraphData, nodeId: string): { backlinks: Connected[]; related: Connected[] } {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const seen = new Set<string>([nodeId]);
  const backlinks: Connected[] = [];
  for (const b of graph.backlinks.get(nodeId) ?? []) {
    if (seen.has(b.from)) continue;
    seen.add(b.from);
    backlinks.push({ id: b.from, title: b.title, href: b.href, kind: b.kind, context: b.context });
  }
  const related: Connected[] = [];
  for (const o of graph.outgoing.get(nodeId) ?? []) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    related.push({ id: o.id, title: o.title, href: o.href, kind: o.kind });
  }
  for (const id of graph.neighbors.get(nodeId) ?? []) {
    if (seen.has(id) || id.startsWith('tag:')) continue;
    const n = byId.get(id);
    if (!n) continue;
    seen.add(id);
    related.push({ id, title: n.t, href: n.u, kind: n.k });
  }
  // notes and posts first, then other achievements
  const rank = (k: NodeKind) => (k === 'note' ? 0 : k === 'post' ? 1 : 2);
  related.sort((a, b) => rank(a.kind) - rank(b.kind) || a.title.localeCompare(b.title));
  return { backlinks, related };
}

export const KIND_LABEL: Record<NodeKind, string> = { note: 'Note', post: 'Essay', ach: 'Achievement', tag: 'Tag' };

/** One lightbox slide (built with getImage() at build time). */
export interface Slide { src: string; width: number; height: number; alt?: string; caption?: string }
