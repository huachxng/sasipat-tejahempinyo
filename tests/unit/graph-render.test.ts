import { describe, it, expect } from 'vitest';
import { CAM0, VB, EDGE_ALPHA, EM_IN, EM_OUT, edgeAlpha, edgeClass, fog, nodeRadius, project, projectScene, stepEmphasis, type GNode, type GEdge, type GraphJson } from '../../src/scripts/graph-render.ts';

const node = (i: number, p3: [number, number, number], k: GNode['k'] = 'note', deg = 1): GNode => ({ i, id: `n${i}`, t: `N${i}`, k, u: `/notes/n${i}`, deg, p3, p2: [p3[0], p3[1]] });

describe('project', () => {
  it('keeps the origin at the centre with unit scale', () => {
    expect(project([0, 0, 0], CAM0.yaw, CAM0.pitch)).toEqual([0, 0, 0, 1]);
  });
  it('scales by d / (d + z): a point one unit towards the camera grows by 2.8 / 1.8', () => {
    expect(project([0, 0, -1], 0, 0)[3]).toBeCloseTo(2.8 / 1.8, 10);
  });
  it('yaw π/2 maps +x onto −z (towards the camera)', () => {
    const [x, , z] = project([1, 0, 0], Math.PI / 2, 0);
    expect(x).toBeCloseTo(0, 10);
    expect(z).toBeCloseTo(-1, 10);
  });
  it('a negative pitch tilts +y away from the camera', () => {
    const [, y, z] = project([0, 1, 0], 0, -0.3);
    expect(z).toBeCloseTo(Math.sin(-0.3), 10);
    expect(y).toBeGreaterThan(0);
  });
  it('perspective scale decreases with depth', () => {
    expect(project([0, 0, -0.5], 0, 0)[3]).toBeGreaterThan(project([0, 0, 0.5], 0, 0)[3]);
  });
});

describe('fog / radius / edge class', () => {
  it('fog is 1 at the near clamp, .35 at the far clamp, clamped beyond and monotonic', () => {
    expect(fog(-1.15)).toBe(1);
    expect(fog(1.15)).toBeCloseTo(0.35, 10);
    expect(fog(-5)).toBe(1);
    expect(fog(5)).toBeCloseTo(0.35, 10);
    let prev = fog(-2);
    for (let z = -2; z <= 2; z += 0.1) { expect(fog(z)).toBeLessThanOrEqual(prev + 1e-12); prev = fog(z); }
  });
  it('nodeRadius(0) = 2 and grows with log2(1 + deg)', () => {
    expect(nodeRadius(0)).toBe(2);
    expect(nodeRadius(1)).toBeCloseTo(3.1, 10);
    expect(nodeRadius(3)).toBeCloseTo(4.2, 10);
  });
  it('edgeClass: 1 for a wikilink, 0 for a tag spoke, 2 for a clique tag edge', () => {
    const nodes = [node(0, [0, 0, 0], 'note'), node(1, [0, 0, 0], 'tag'), node(2, [0, 0, 0], 'ach')];
    const link: GEdge = { s: 0, t: 2, k: 'link', w: 1 }, spoke: GEdge = { s: 0, t: 1, k: 'tag', w: 1 }, clique: GEdge = { s: 0, t: 2, k: 'tag', w: 1 };
    expect(edgeClass(link, nodes)).toBe(1);
    expect(edgeClass(spoke, nodes)).toBe(0);
    expect(edgeClass(clique, nodes)).toBe(2);
    expect(EDGE_ALPHA).toEqual([0.4, 0.8, 0.5]);
  });
});

describe('stepEmphasis', () => {
  it(`reaches 1 in ${EM_IN * 1000} ms, 0 in ${EM_OUT * 1000} ms, and reports rest`, () => {
    const em = new Float32Array(3);
    expect(stepEmphasis(em, 1, EM_IN / 2)).toBe(true);
    expect(em[1]).toBeCloseTo(0.5, 5);
    expect(stepEmphasis(em, 1, EM_IN / 2)).toBe(true);
    expect(em[1]).toBe(1);
    expect(stepEmphasis(em, 1, 0.016)).toBe(false);
    expect(stepEmphasis(em, -1, EM_OUT)).toBe(true);
    expect(em[1]).toBe(0);
    expect(stepEmphasis(em, -1, 0.016)).toBe(false);
    expect([...em]).toEqual([0, 0, 0]);
  });
  it('clamps to [0, 1] with large steps', () => {
    const em = new Float32Array([0.9, 0.1]);
    stepEmphasis(em, 0, 1);
    expect([...em]).toEqual([1, 0]);
  });
});

describe('edgeAlpha', () => {
  it('is class alpha × mean fog × edgeMul at rest', () => {
    expect(edgeAlpha(1, 1, 0.5, 1, 0, false, true)).toBeCloseTo(0.8 * 0.75, 10);
    expect(edgeAlpha(0, 1, 1, 0.6, 0, false, true)).toBeCloseTo(0.4 * 0.6, 10);
  });
  it('dims non-incident edges by 1 − .65·dim and leaves incident ones alone', () => {
    expect(edgeAlpha(1, 1, 1, 1, 1, false, true)).toBeCloseTo(0.8 * 0.35, 10);
    expect(edgeAlpha(1, 1, 1, 1, 0.5, false, true)).toBeCloseTo(0.8 * (1 - 0.325), 10);
    expect(edgeAlpha(1, 1, 1, 1, 1, true, true)).toBeCloseTo(0.8, 10);
  });
  it('multiplies by .35 when a search does not match both ends', () => {
    expect(edgeAlpha(2, 1, 1, 1, 0, false, false)).toBeCloseTo(0.5 * 0.35, 10);
  });
});

describe('projectScene', () => {
  const g: GraphJson = { v: 1, built: '', nodes: [node(0, [0, 0, 0], 'note', 0), node(1, [0, 0, -1], 'ach', 3), node(2, [1, 0, 0], 'tag', 1)], edges: [], hubs: [], tags: {} };
  const N = 3, X = new Float32Array(N), Y = new Float32Array(N), Z = new Float32Array(N), F = new Float32Array(N), R = new Float32Array(N);
  it('reproduces the hand-computed positions for a 1600×1000 box at unit 1 and the identity camera', () => {
    projectScene(g, { yaw: 0, pitch: 0, scale: 1, px: 0, edgeMul: 1 }, 1600, 1000, 1, X, Y, Z, F, R);
    expect([X[0], Y[0], Z[0], R[0]]).toEqual([800, 500, 0, nodeRadius(0)]);
    expect(F[0]).toBeCloseTo(fog(0), 6);
    const s1 = 2.8 / 1.8;
    expect(X[1]).toBeCloseTo(800, 4);
    expect(Z[1]).toBe(-1);
    expect(F[1]).toBeCloseTo(fog(-1), 6);
    expect(R[1]).toBeCloseTo(nodeRadius(3) * s1, 4);
    expect(X[2]).toBeCloseTo(800 + VB.r, 4);
    expect(Y[2]).toBeCloseTo(500, 4);
  });
  it('applies unit, camera scale and the parallax offset', () => {
    projectScene(g, { yaw: 0, pitch: 0, scale: 0.5, px: 20, edgeMul: 1 }, 800, 500, 2, X, Y, Z, F, R);
    expect(X[0]).toBeCloseTo(420, 6);
    expect(X[2]).toBeCloseTo(420 + VB.r * 2 * 0.5, 4);
    expect(R[0]).toBeCloseTo(nodeRadius(0) * 2 * 0.5, 6);
  });
  it('matches the poster projection for the starting camera', () => {
    projectScene(g, { yaw: CAM0.yaw, pitch: CAM0.pitch, scale: 1, px: 0, edgeMul: 1 }, 1600, 1000, 1, X, Y, Z, F, R);
    const [x, y, z, s] = project(g.nodes[2].p3, CAM0.yaw, CAM0.pitch);
    expect(X[2]).toBeCloseTo(800 + x * VB.r, 4);
    expect(Y[2]).toBeCloseTo(500 + y * VB.r, 4);
    expect(Z[2]).toBeCloseTo(z, 6);
    expect(R[2]).toBeCloseTo(nodeRadius(1) * s, 4);
  });
});
