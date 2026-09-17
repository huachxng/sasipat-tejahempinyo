import { describe, it, expect } from 'vitest';
import { dbToGain, effectiveSound, sfx } from '../../src/scripts/sound.ts';

describe('dbToGain', () => {
  it('maps the design levels', () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(-30)).toBeCloseTo(0.0316, 4);
    expect(dbToGain(-36)).toBeCloseTo(0.0158, 4);
    expect(dbToGain(-6)).toBeCloseTo(0.5012, 4);
  });
});

describe('effectiveSound', () => {
  it('is on only when stored on and motion is allowed', () => {
    expect(effectiveSound({ stored: 'on', motionOff: false })).toBe(true);
    expect(effectiveSound({ stored: 'on', motionOff: true })).toBe(false);
    expect(effectiveSound({ stored: null, motionOff: false })).toBe(false);
    expect(effectiveSound({ stored: 'off', motionOff: false })).toBe(false);
  });
});

describe('module shape', () => {
  it('exposes the tap / release / drone API without touching the DOM at import time', () => {
    expect(typeof sfx.tap).toBe('function');
    expect(typeof sfx.release).toBe('function');
    expect(typeof sfx.drone).toBe('function');
  });
});
