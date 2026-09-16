import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';

const FIXTURE = resolve('tests/fixtures/vault');
process.env.VAULT_DIR = FIXTURE;
const { resetVaultCache } = await import('../../src/lib/vault.ts');
const { buildGraph, resetGraphCache, toPublicGraph, contextSentence } = await import('../../src/lib/graph.ts');
const { GRAPH } = await import('../../src/site.config.ts');
resetVaultCache();
resetGraphCache();
const g = buildGraph();
const idx = (id: string) => {
  const i = g.nodes.findIndex((n) => n.id === id);
  if (i < 0) throw new Error(`node ${id} missing; have ${g.nodes.map((n) => n.id).join(', ')}`);
  return i;
};
const edgesBetween = (a: string, b: string, k?: 'link' | 'tag') => {
  const [x, y] = [idx(a), idx(b)];
  return g.edges.filter((e) => ((e.s === x && e.t === y) || (e.s === y && e.t === x)) && (!k || e.k === k));
};

describe('nodes', () => {
  it('contains every published entry and no unpublished one', () => {
    const ids = g.nodes.map((n) => n.id);
    for (const id of ['notes/alpha', 'notes/beta', 'notes/delta', 'notes/dup-name', 'notes/café-note', 'achievements/dup-name-award', 'achievements/lead-two', 'achievements/ach-1', 'achievements/ach-7', 'blog/post-one']) expect(ids).toContain(id);
    expect(ids).not.toContain('notes/gamma');
    expect(ids).not.toContain('blog/draft-post');
    expect(g.nodes.some((n) => /Gamma Secret Draft|Draft Post Unfinished/.test(n.t))).toBe(false);
  });
  it('carries kind, url, category and year', () => {
    const a = g.nodes[idx('achievements/dup-name-award')];
    expect(a).toMatchObject({ k: 'ach', u: '/achievements/dup-name-award', c: 'leadership', y: 2024 });
    expect(g.nodes[idx('blog/post-one')].k).toBe('post');
    expect(g.nodes[idx('notes/alpha')]).toMatchObject({ k: 'note', u: '/notes/alpha', t: 'Alpha' });
  });
  it('lays nodes out inside the clamp in 3D and 2D', () => {
    for (const n of g.nodes) {
      expect(n.p3).toHaveLength(3);
      expect(n.p2).toHaveLength(2);
      for (const v of [...n.p3, ...n.p2]) expect(Math.abs(v)).toBeLessThanOrEqual(1.5);
    }
    expect(g.nodes.map((n) => n.i)).toEqual(g.nodes.map((_, i) => i));
  });
});

describe('link edges and backlinks', () => {
  it('dedupes repeated wikilinks between two notes into one undirected edge', () => {
    expect(edgesBetween('notes/alpha', 'notes/beta', 'link')).toHaveLength(1);
  });
  it('keeps direction for backlinks and attaches the sentence containing the link', () => {
    const toAlpha = g.backlinks.get('notes/alpha') ?? [];
    const fromBeta = toAlpha.find((b) => b.from === 'notes/beta');
    expect(fromBeta).toBeDefined();
    expect(fromBeta!.context).toBe('Beta points back at Alpha in this exact sentence, which becomes the backlink context.');
    expect(fromBeta!.href).toBe('/notes/beta');
    expect(fromBeta!.kind).toBe('note');
    expect(toAlpha.filter((b) => b.from === 'notes/beta')).toHaveLength(1);
    expect(toAlpha.find((b) => b.from === 'blog/post-one')!.context).toBe('An essay that cites Alpha as its main source.');
    expect(toAlpha.some((b) => b.from === 'notes/gamma')).toBe(false);
    expect(g.backlinks.get('notes/delta')).toBeUndefined();
  });
  it('lists outgoing links incl. folder-style targets and skips ambiguous ones', () => {
    const out = (g.outgoing.get('notes/beta') ?? []).map((o) => o.id);
    expect(out).toContain('notes/alpha');
    expect(out).toContain('achievements/dup-name-award');
    expect(out).not.toContain('notes/dup-name');
  });
  it('caps the context sentence at 140 characters', () => {
    const long = 'Start ' + 'word '.repeat(60) + '[[X]] tail.';
    const s = contextSentence(long, '[[X]]');
    expect(s.length).toBeLessThanOrEqual(140);
    expect(s.endsWith('…')).toBe(true);
  });
});

describe('tag edges', () => {
  it('connects 2–6 members pairwise with weight 1/(m−1)', () => {
    const trio = ['notes/alpha', 'notes/beta', 'notes/delta'];
    for (let a = 0; a < trio.length; a++)
      for (let b = a + 1; b < trio.length; b++) {
        const e = edgesBetween(trio[a], trio[b], 'tag');
        expect(e).toHaveLength(1);
        expect(e[0].w).toBeCloseTo(0.5);
      }
    expect(g.tags.shared).toBe(3);
    expect(g.nodes.some((n) => n.id === 'tag:shared')).toBe(false);
  });
  it('turns a tag with at least tagHubMin members into a hub node with 0.5 spokes', () => {
    expect(GRAPH.tagHubMin).toBe(7);
    const hub = g.nodes.find((n) => n.id === 'tag:hub');
    expect(hub).toMatchObject({ k: 'tag', t: '#hub', u: '/tags/hub' });
    const spokes = g.edges.filter((e) => (e.s === hub!.i || e.t === hub!.i) && e.k === 'tag');
    expect(spokes).toHaveLength(7);
    for (const s of spokes) expect(s.w).toBe(0.5);
    expect(hub!.deg).toBe(7);
    expect(edgesBetween('achievements/ach-1', 'achievements/ach-2', 'tag')).toHaveLength(0);
    expect(g.tags.hub).toBe(7);
  });
  it('gives achievements an implicit graph-only category tag', () => {
    const e = edgesBetween('achievements/dup-name-award', 'achievements/lead-two', 'tag');
    expect(e).toHaveLength(1);
    expect(e[0].w).toBe(1);
    expect(g.tagsOf.get('achievements/lead-two')).toEqual([]);
    expect(Object.keys(g.tags).some((t) => t.startsWith('category/'))).toBe(false);
    const catHub = g.nodes.find((n) => n.id === 'tag:category/athletics');
    expect(catHub).toMatchObject({ k: 'tag', t: '#athletics', u: '/achievements?cat=athletics' });
  });
  it('excludes tag nodes from hubs and orders hubs by degree', () => {
    expect(g.hubs.length).toBeLessThanOrEqual(GRAPH.hubCount);
    for (const i of g.hubs) expect(g.nodes[i].k).not.toBe('tag');
    const degs = g.hubs.map((i) => g.nodes[i].deg);
    expect([...degs].sort((a, b) => b - a)).toEqual(degs);
  });
  it('lists neighbours symmetrically', () => {
    expect(g.neighbors.get('notes/alpha')).toContain('notes/beta');
    expect(g.neighbors.get('notes/beta')).toContain('notes/alpha');
  });
});

describe('determinism', () => {
  it('serialises byte-identically across two builds', () => {
    const first = JSON.stringify(toPublicGraph(g));
    resetVaultCache();
    resetGraphCache();
    const second = JSON.stringify(toPublicGraph(buildGraph()));
    expect(second).toBe(first);
    expect(JSON.parse(first)).not.toHaveProperty('backlinks');
    expect(JSON.parse(first).v).toBe(1);
  });
});
