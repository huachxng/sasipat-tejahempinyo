import { describe, it, expect } from 'vitest';
import { EDGE_ALPHA, edgeClass, hexToRgb01, type GNode, type GraphJson } from '../../src/scripts/graph-render.ts';
import { FS_EDGE, FS_GLOW, FS_SPHERE, GL_ATTRS, INSTANCE_STRIDE, VS_EDGE, VS_GLOW, VS_SPHERE, buildEdgeStatic, packInstance } from '../../src/scripts/graph-gl.ts';

const node = (i: number, k: GNode['k']): GNode => ({ i, id: `n${i}`, t: `N${i}`, k, u: `/x/${i}`, deg: 2, p3: [0, 0, 0], p2: [0, 0] });
const g: GraphJson = {
  v: 1, built: '', hubs: [], tags: {},
  nodes: [node(0, 'note'), node(1, 'tag'), node(2, 'ach'), node(3, 'post')],
  edges: [{ s: 0, t: 2, k: 'link', w: 1 }, { s: 0, t: 1, k: 'tag', w: 1 }, { s: 2, t: 3, k: 'tag', w: 1 }],
};

describe('buildEdgeStatic', () => {
  it('has 2E alphas equal to EDGE_ALPHA[class] at both vertices', () => {
    const { alpha, cls } = buildEdgeStatic(g);
    expect(alpha).toHaveLength(2 * g.edges.length);
    expect(cls).toHaveLength(g.edges.length);
    g.edges.forEach((e, j) => {
      expect(cls[j]).toBe(edgeClass(e, g.nodes));
      expect(alpha[2 * j]).toBeCloseTo(EDGE_ALPHA[cls[j]], 6);
      expect(alpha[2 * j + 1]).toBeCloseTo(EDGE_ALPHA[cls[j]], 6);
    });
    expect([...cls]).toEqual([1, 0, 2]);
  });
});

describe('packInstance', () => {
  it('writes INSTANCE_STRIDE floats and round-trips a record', () => {
    const out = new Float32Array(INSTANCE_STRIDE * 2).fill(-1);
    packInstance(out, INSTANCE_STRIDE, 10, 20, -0.5, 4.25, 0.75, [0.1, 0.2, 0.3], [0.9, 0.8, 0.7], 0.5, 0.9, 1);
    expect([...out.slice(0, INSTANCE_STRIDE)].every((v) => v === -1)).toBe(true);
    const rec = [...out.slice(INSTANCE_STRIDE)].map((v) => Math.round(v * 1e4) / 1e4);
    expect(rec).toEqual([10, 20, -0.5, 4.25, 0.75, 0.1, 0.2, 0.3, 0.9, 0.8, 0.7, 0.5, 0.9, 1]);
    expect(rec).toHaveLength(INSTANCE_STRIDE);
  });
});

describe('hexToRgb01', () => {
  it('converts the gold token', () => {
    const [r, g2, b] = hexToRgb01('#e8b84a');
    expect(r).toBeCloseTo(0.9098, 3);
    expect(g2).toBeCloseTo(0.7216, 3);
    expect(b).toBeCloseTo(0.2902, 3);
  });
  it('falls back to gold for anything that is not #rrggbb', () => {
    expect(hexToRgb01('rgb(1,2,3)')).toEqual(hexToRgb01('#e8b84a'));
  });
});

describe('shader sources', () => {
  const all = { VS_SPHERE, FS_SPHERE, VS_GLOW, FS_GLOW, VS_EDGE, FS_EDGE };
  it('start with #version 300 es and declare a precision', () => {
    for (const [name, src] of Object.entries(all)) {
      expect(src.split('\n')[0], name).toBe('#version 300 es');
      expect(src, name).toMatch(/precision (highp|mediump) float;/);
    }
  });
  it('every varying a fragment shader reads is written by its vertex shader', () => {
    const pairs: [string, string][] = [[VS_SPHERE, FS_SPHERE], [VS_GLOW, FS_GLOW], [VS_EDGE, FS_EDGE]];
    for (const [vs, fs] of pairs) {
      const outs = new Set([...vs.matchAll(/^out \w+ (\w+);/gm)].map((m) => m[1]));
      const ins = [...fs.matchAll(/^in \w+ (\w+);/gm)].map((m) => m[1]);
      expect(ins.length).toBeGreaterThan(0);
      for (const v of ins) expect(outs.has(v), `${v} is declared in the fragment shader but not written by the vertex shader`).toBe(true);
      for (const v of outs) expect(vs.includes(`${v}=`), `${v} is never assigned`).toBe(true);
    }
  });
  it('the sphere fragment shader uses every attribute-derived varying it declares', () => {
    const decl = [...FS_SPHERE.matchAll(/^in \w+ (\w+);/gm)].map((m) => m[1]).filter((v) => v !== 'v_glow');
    const body = FS_SPHERE.slice(FS_SPHERE.indexOf('void main'));
    for (const v of decl) expect(body.includes(v), `${v} unused`).toBe(true);
  });
  it('the vertex shader declares one attribute per instance field plus the quad corner', () => {
    const locs = [...VS_SPHERE.matchAll(/layout\(location=(\d+)\) in (\w+) (\w+);/g)];
    const floats = locs.reduce((s, m) => s + (m[2] === 'vec3' ? 3 : m[2] === 'vec2' ? 2 : 1), 0);
    expect(floats - 2).toBe(INSTANCE_STRIDE);
  });
  it('asks for a real GPU and a premultiplied, antialiased, low-power context', () => {
    expect(GL_ATTRS).toMatchObject({ alpha: true, antialias: true, premultipliedAlpha: true, failIfMajorPerformanceCaveat: true, powerPreference: 'low-power' });
  });
});
