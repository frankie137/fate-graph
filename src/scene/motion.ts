/** The share of the remaining distance to cover this frame for a given time constant. */
export function easingShare(deltaSeconds: number, timeConstant: number): number {
  return 1 - Math.exp(-deltaSeconds / timeConstant);
}

/**
 * One step of a critically damped spring that pulls `offset` toward zero. The
 * velocity carries over between steps, so motion starts and ends gently, and a
 * new target that arrives mid-flight causes no jerk. Returns the new offset
 * and the new velocity.
 */
export function dampOffset(
  offset: number,
  velocity: number,
  smoothTime: number,
  deltaSeconds: number,
): [number, number] {
  const omega = 2 / smoothTime;
  const x = omega * deltaSeconds;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const temp = (velocity + omega * offset) * deltaSeconds;
  return [(offset + temp) * decay, (velocity - omega * temp) * decay];
}
