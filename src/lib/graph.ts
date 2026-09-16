// Graph of published content: nodes (notes, posts, achievements, tag hubs), edges (wikilinks, shared tags),
// backlinks with a context sentence, and deterministic 3D + 2D force layouts. Computed once per build.
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceRadial, forceCenter } from 'd3-force-3d';
import { getVault, kindOf, hrefFor, type Collection, type VaultEntry } from './vault.ts';
import { outgoingLinks, stripComments } from './wikilinks.ts';
import { allTags } from './tags.ts';
import { GRAPH } from '../site.config.ts';

export type NodeKind = 'note' | 'post' | 'ach' | 'tag';
export interface GraphNode {
  i: number;
  id: string; // "notes/slug" | "blog/slug" | "achievements/slug" | "tag:name"
  t: string; // title
  k: NodeKind;
  u: string; // url
  c?: string; // achievement category
  y?: number; // achievement year
  deg: number;
  p3: [number, number, number];
  p2: [number, number];
}
export interface GraphEdge { s: number; t: number; k: 'link' | 'tag'; w: number }
export interface Backlink { from: string; title: string; href: string; kind: NodeKind; context: string }
export interface Graph {
  v: 1;
  built: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  hubs: number[];
  tags: Record<string, number>;
}
export interface GraphData extends Graph {
  backlinks: Map<string, Backlink[]>;
  outgoing: Map<string, { id: string; title: string; href: string; kind: NodeKind }[]>;
  tagsOf: Map<string, string[]>;
  neighbors: Map<string, string[]>;
}

const nodeId = (e: VaultEntry) => `${e.collection}/${e.id}`;

/** Sentence around the first occurrence of `raw` in `body`, cleaned of Markdown, at most 140 chars. */
export function contextSentence(body: string, raw: string): string {
  const text = stripComments(body);
  const at = text.indexOf(raw);
  if (at < 0) return '';
  const start = Math.max(text.lastIndexOf('. ', at), text.lastIndexOf('\n', at), text.lastIndexOf('! ', at), text.lastIndexOf('? ', at)) + 1;
  let end = text.length;
  for (const p of ['. ', '.\n', '\n', '! ', '? ']) {
    const i = text.indexOf(p, at + raw.length);
    if (i >= 0) end = Math.min(end, i + (p.trim() ? 1 : 0));
  }
  let s = text
    .slice(start, end)
    .replace(/!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_, t, a) => a ?? t)
    .replace(/[*_`>#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > 140) s = s.slice(0, 137).trimEnd() + '…';
  return s;
}

let cache: GraphData | null = null;
export function resetGraphCache() {
  cache = null;
}

export function buildGraph(entries: VaultEntry[] = getVault().entries.filter((e) => e.publish || process.env.SHOW_DRAFTS === '1')): GraphData {
  const vault = getVault();
  const sorted = [...entries].sort((a, b) => nodeId(a).localeCompare(nodeId(b)));
  const nodes: GraphNode[] = [];
  const index = new Map<string, number>();
  for (const e of sorted) {
    const i = nodes.length;
    index.set(nodeId(e), i);
    const node: GraphNode = { i, id: nodeId(e), t: e.title, k: kindOf(e.collection), u: hrefFor(e.collection, e.id), deg: 0, p3: [0, 0, 0], p2: [0, 0] };
    if (e.collection === 'achievements') {
      if (typeof e.frontmatter.category === 'string') node.c = e.frontmatter.category.trim().toLowerCase();
      const d = e.frontmatter.date;
      const dt = d instanceof Date ? d : typeof d === 'string' ? new Date(d) : undefined;
      if (dt && !isNaN(dt.getTime())) node.y = dt.getUTCFullYear();
    }
    nodes.push(node);
  }

  // Link edges (undirected, deduped) + directed backlinks with context.
  const edgeKey = new Set<string>();
  const edges: GraphEdge[] = [];
  const backlinks = new Map<string, Backlink[]>();
  const outgoing = new Map<string, { id: string; title: string; href: string; kind: NodeKind }[]>();
  const addEdge = (a: number, b: number, k: 'link' | 'tag', w: number) => {
    if (a === b) return;
    const key = `${Math.min(a, b)}-${Math.max(a, b)}-${k}`;
    if (edgeKey.has(key)) return;
    edgeKey.add(key);
    edges.push({ s: a, t: b, k, w });
  };
  for (const e of sorted) {
    const from = index.get(nodeId(e))!;
    const seen = new Set<string>();
    for (const { link, res } of outgoingLinks(e.body, vault)) {
      if (!res.ok) continue;
      const toId = nodeId(res.entry);
      const to = index.get(toId);
      if (to === undefined || to === from || seen.has(toId)) continue;
      seen.add(toId);
      addEdge(from, to, 'link', 1);
      const list = backlinks.get(toId) ?? [];
      list.push({ from: nodeId(e), title: e.title, href: hrefFor(e.collection, e.id), kind: kindOf(e.collection), context: contextSentence(e.body, link.raw) });
      backlinks.set(toId, list);
      const out = outgoing.get(nodeId(e)) ?? [];
      out.push({ id: toId, title: res.entry.title, href: res.href, kind: kindOf(res.entry.collection) });
      outgoing.set(nodeId(e), out);
    }
  }

  // Tags: 2..6 members → pairwise edges; ≥ tagHubMin → hub node with spokes.
  const members = new Map<string, number[]>();
  const tagsOf = new Map<string, string[]>();
  for (const e of sorted) {
    const i = index.get(nodeId(e))!;
    const tags = allTags(e.frontmatter.tags, e.body);
    if (e.collection === 'achievements' && typeof e.frontmatter.category === 'string') tags.push(`category/${e.frontmatter.category.trim().toLowerCase()}`);
    tagsOf.set(nodeId(e), tags.filter((t) => !t.startsWith('category/')));
    for (const t of new Set(tags)) members.set(t, [...(members.get(t) ?? []), i]);
  }
  const tagCounts: Record<string, number> = {};
  for (const [tag, ms] of [...members.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!tag.startsWith('category/')) tagCounts[tag] = ms.length;
    if (ms.length < 2) continue;
    if (ms.length < GRAPH.tagHubMin) {
      const w = 1 / (ms.length - 1);
      for (let a = 0; a < ms.length; a++) for (let b = a + 1; b < ms.length; b++) addEdge(ms[a], ms[b], 'tag', w);
    } else {
      const i = nodes.length;
      const label = tag.startsWith('category/') ? tag.slice('category/'.length) : tag;
      nodes.push({ i, id: `tag:${tag}`, t: `#${label}`, k: 'tag', u: tag.startsWith('category/') ? `/achievements?cat=${label}` : `/tags/${encodeURIComponent(tag)}`, deg: 0, p3: [0, 0, 0], p2: [0, 0] });
      for (const m of ms) addEdge(i, m, 'tag', 0.5);
    }
  }
  for (const e of edges) {
    nodes[e.s].deg++;
    nodes[e.t].deg++;
  }
  const neighbors = new Map<string, string[]>();
  for (const e of edges) {
    const a = nodes[e.s].id, b = nodes[e.t].id;
    neighbors.set(a, [...(neighbors.get(a) ?? []), b]);
    neighbors.set(b, [...(neighbors.get(b) ?? []), a]);
  }

  layout(nodes, edges, 3);
  layout(nodes, edges, 2);
  const hubs = nodes
    .filter((n) => n.k !== 'tag')
    .sort((a, b) => b.deg - a.deg || a.id.localeCompare(b.id))
    .slice(0, GRAPH.hubCount)
    .map((n) => n.i);

  return { v: 1, built: new Date().toISOString().slice(0, 10), nodes, edges, hubs, tags: tagCounts, backlinks, outgoing, tagsOf, neighbors };
}

function layout(nodes: GraphNode[], edges: GraphEdge[], dims: 2 | 3) {
  const radius = (n: GraphNode) => 1.6 + 0.9 * Math.log2(1 + n.deg);
  const simNodes = nodes.map((n) => ({ id: n.i, deg: n.deg, k: n.k, r: radius(n) }));
  const simLinks = edges.map((e) => ({ source: e.s, target: e.t, k: e.k }));
  const sim = forceSimulation(simNodes, dims)
    .force('link', forceLink(simLinks).id((d: { id: number }) => d.id).distance((l: { k: string }) => (l.k === 'link' ? 14 : 20)).strength((l: { k: string }) => (l.k === 'link' ? 0.7 : 0.3)))
    .force('charge', forceManyBody().strength((d: { k: string }) => (d.k === 'tag' ? -30 : -60)).distanceMax(150))
    .force('collide', forceCollide((d: { r: number }) => d.r * 1.6 + 1.5))
    .force('radial', forceRadial((d: { deg: number }) => (d.deg === 0 ? 48 : 30)).strength((d: { deg: number }) => (d.deg === 0 ? 0.35 : 0.04)))
    .force('center', forceCenter())
    .stop();
  sim.tick(300);
  const pts = simNodes.map((n: any) => (dims === 3 ? [n.x ?? 0, n.y ?? 0, n.z ?? 0] : [n.x ?? 0, n.y ?? 0]));
  const c = pts[0].map((_, d) => pts.reduce((s, p) => s + p[d], 0) / Math.max(1, pts.length));
  const centred = pts.map((p) => p.map((v, d) => v - c[d]));
  const radii = centred.map((p) => Math.hypot(...p)).sort((a, b) => a - b);
  const p95 = radii[Math.min(radii.length - 1, Math.floor(radii.length * 0.95))] || 1;
  centred.forEach((p, i) => {
    const scaled = p.map((v) => Math.round(Math.max(-1.5, Math.min(1.5, v / p95)) * 1000) / 1000);
    if (dims === 3) nodes[i].p3 = scaled as [number, number, number];
    else nodes[i].p2 = scaled as [number, number];
  });
}

export function getGraph(): GraphData {
  if (!cache) cache = buildGraph();
  return cache;
}

/** Serialisable subset for /graph.json */
export function toPublicGraph(g: GraphData): Graph {
  return { v: 1, built: g.built, nodes: g.nodes, edges: g.edges, hubs: g.hubs, tags: g.tags };
}

export const graphNodeId = (collection: Collection, id: string) => `${collection}/${id}`;
