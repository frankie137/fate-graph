import { describe, expect, it } from 'vitest';
import { HEXAGRAMS, oppositeHexagram } from './hexagrams.ts';
import { computeSphereLayout } from './layout.ts';

describe('sphere layout', () => {
  const positions = computeSphereLayout();

  it('places every hexagram on the unit sphere', () => {
    expect(positions).toHaveLength(64);
    for (const point of positions) {
      expect(Math.hypot(point.x, point.y, point.z)).toBeCloseTo(1, 9);
    }
  });

  it('orders height by the number of yang lines', () => {
    for (const hexagram of HEXAGRAMS) {
      const expectedHeight = Math.cos((Math.PI * (6 - hexagram.yangCount)) / 6);
      expect(positions[hexagram.code].y).toBeCloseTo(expectedHeight, 9);
    }
  });

  it('places each hexagram opposite its complement', () => {
    for (const hexagram of HEXAGRAMS) {
      const point = positions[hexagram.code];
      const opposite = positions[oppositeHexagram(hexagram).code];
      expect(opposite.x).toBeCloseTo(-point.x, 9);
      expect(opposite.y).toBeCloseTo(-point.y, 9);
      expect(opposite.z).toBeCloseTo(-point.z, 9);
    }
  });

  it('keeps hexagrams apart', () => {
    let closest = Infinity;
    for (let a = 0; a < positions.length; a += 1) {
      for (let b = a + 1; b < positions.length; b += 1) {
        const distance = Math.hypot(
          positions[a].x - positions[b].x,
          positions[a].y - positions[b].y,
          positions[a].z - positions[b].z,
        );
        closest = Math.min(closest, distance);
      }
    }
    expect(closest).toBeGreaterThan(0.25);
  });

  it('is deterministic', () => {
    expect(computeSphereLayout()).toEqual(positions);
  });
});
