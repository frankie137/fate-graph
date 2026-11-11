import { describe, expect, it } from 'vitest';
import { dampOffset, easingShare } from './motion.ts';

const FRAME_SECONDS = 1 / 60;
const SMOOTH_TIME = 0.3;

/** Runs the spring from rest and returns the offset after every frame. */
function simulate(startOffset: number, seconds: number): number[] {
  const offsets: number[] = [];
  let offset = startOffset;
  let velocity = 0;
  for (let time = 0; time < seconds; time += FRAME_SECONDS) {
    [offset, velocity] = dampOffset(offset, velocity, SMOOTH_TIME, FRAME_SECONDS);
    offsets.push(offset);
  }
  return offsets;
}

describe('dampOffset', () => {
  it('starts gently, so the first frame covers less ground than a later one', () => {
    const offsets = simulate(1, 0.5);
    const firstStep = 1 - offsets[0];
    const laterStep = offsets[5] - offsets[6];
    expect(firstStep).toBeGreaterThan(0);
    expect(firstStep).toBeLessThan(laterStep);
  });

  it('reaches the target within about a second without overshooting', () => {
    const offsets = simulate(1, 1.2);
    expect(Math.min(...offsets)).toBeGreaterThanOrEqual(0);
    expect(offsets[offsets.length - 1]).toBeLessThan(0.01);
  });

  it('keeps its velocity when the target changes mid-flight', () => {
    let offset = 1;
    let velocity = 0;
    for (let frame = 0; frame < 10; frame += 1) {
      [offset, velocity] = dampOffset(offset, velocity, SMOOTH_TIME, FRAME_SECONDS);
    }
    const speedBefore = Math.abs(velocity);
    // A new target doubles the remaining distance. The speed must not jump.
    const [, velocityAfter] = dampOffset(offset * 2, velocity, SMOOTH_TIME, FRAME_SECONDS);
    expect(Math.abs(Math.abs(velocityAfter) - speedBefore)).toBeLessThan(speedBefore * 0.25);
  });
});

describe('easingShare', () => {
  it('covers the same distance in one long frame as in two short ones', () => {
    const oneFrame = easingShare(2 * FRAME_SECONDS, 0.14);
    const half = easingShare(FRAME_SECONDS, 0.14);
    expect(oneFrame).toBeCloseTo(1 - (1 - half) ** 2, 10);
  });
});
