import { HEXAGRAM_COUNT, LINE_COUNT, singleLineEdges } from './hexagrams.ts';

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

const LINE_MASK = (1 << LINE_COUNT) - 1;
const MIDDLE_RING = LINE_COUNT / 2;
const ANNEALING_STEPS = 60000;
const START_TEMPERATURE = 0.6;
const END_TEMPERATURE = 0.002;
const LAYOUT_SEED = 2;

function countYangLines(code: number): number {
  let count = 0;
  for (let line = 0; line < LINE_COUNT; line += 1) {
    count += (code >> line) & 1;
  }
  return count;
}

/** Small deterministic generator so the layout is identical on every load. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/**
 * The free variables of the layout. Rings 1 and 2 are ordered freely. The
 * middle ring holds ten complementary pairs, where `middlePairs[j]` sits at
 * slot j and its complement at the opposite slot. Rings 4 and 5 and the south
 * pole follow from the rule that complements are antipodal.
 */
interface LayoutState {
  rings: number[][];
  middlePairs: number[];
  phases: number[];
}

function placeOnRing(yangCount: number, slot: number, slotCount: number, phase: number): Point3 {
  const polar = (Math.PI * (LINE_COUNT - yangCount)) / LINE_COUNT;
  const azimuth = phase + (2 * Math.PI * slot) / slotCount;
  return {
    x: Math.sin(polar) * Math.cos(azimuth),
    y: Math.cos(polar),
    z: Math.sin(polar) * Math.sin(azimuth),
  };
}

function positionsOf(state: LayoutState): Point3[] {
  const positions = new Array<Point3>(HEXAGRAM_COUNT);
  const place = (code: number, point: Point3) => {
    positions[code] = point;
    positions[~code & LINE_MASK] = { x: -point.x, y: -point.y, z: -point.z };
  };

  place(LINE_MASK, { x: 0, y: 1, z: 0 });
  for (let yangCount = MIDDLE_RING + 1; yangCount < LINE_COUNT; yangCount += 1) {
    const ring = state.rings[yangCount];
    ring.forEach((code, slot) => {
      place(code, placeOnRing(yangCount, slot, ring.length, state.phases[yangCount]));
    });
  }
  const middleSlots = state.middlePairs.length * 2;
  state.middlePairs.forEach((code, slot) => {
    place(code, placeOnRing(MIDDLE_RING, slot, middleSlots, state.phases[MIDDLE_RING]));
  });
  return positions;
}

function totalEdgeLength(positions: Point3[], edges: [number, number][]): number {
  let total = 0;
  for (const [from, to] of edges) {
    const a = positions[from];
    const b = positions[to];
    total += (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
  }
  return total;
}

function cloneState(state: LayoutState): LayoutState {
  return {
    rings: state.rings.map((ring) => [...ring]),
    middlePairs: [...state.middlePairs],
    phases: [...state.phases],
  };
}

function mutate(state: LayoutState, random: () => number): void {
  const choice = random();
  if (choice < 0.15) {
    const ring = MIDDLE_RING + Math.floor(random() * MIDDLE_RING);
    state.phases[ring] += (random() - 0.5) * 0.3;
    return;
  }
  if (choice < 0.5) {
    const pairs = state.middlePairs;
    const slot = Math.floor(random() * pairs.length);
    if (random() < 0.3) {
      pairs[slot] = ~pairs[slot] & LINE_MASK;
    } else {
      const other = Math.floor(random() * pairs.length);
      [pairs[slot], pairs[other]] = [pairs[other], pairs[slot]];
    }
    return;
  }
  const ring = state.rings[MIDDLE_RING + 1 + Math.floor(random() * (MIDDLE_RING - 1))];
  const slot = Math.floor(random() * ring.length);
  const other = Math.floor(random() * ring.length);
  [ring[slot], ring[other]] = [ring[other], ring[slot]];
}

/**
 * Places the 64 hexagrams on a unit sphere and returns the positions indexed
 * by hexagram code.
 *
 * The layout follows three rules:
 * - Height is the number of yang lines, so 乾 is the north pole, 坤 the south
 *   pole, and the other hexagrams lie on five rings between them.
 * - Every hexagram sits diametrically opposite its 错卦.
 * - The order within each ring is chosen by simulated annealing to keep the
 *   single-line-change edges short.
 */
export function computeSphereLayout(): Point3[] {
  const random = createRandom(LAYOUT_SEED);
  const edges = singleLineEdges();

  const codesByYangCount: number[][] = Array.from({ length: LINE_COUNT + 1 }, () => []);
  for (let code = 0; code < HEXAGRAM_COUNT; code += 1) {
    codesByYangCount[countYangLines(code)].push(code);
  }
  // One representative per complementary pair of the middle ring.
  const middleRepresentatives = codesByYangCount[MIDDLE_RING].filter(
    (code) => code < (~code & LINE_MASK),
  );

  let current: LayoutState = {
    rings: codesByYangCount.map((ring) => shuffle(ring, random)),
    middlePairs: shuffle(middleRepresentatives, random),
    phases: new Array(LINE_COUNT + 1).fill(0),
  };
  let currentCost = totalEdgeLength(positionsOf(current), edges);
  let best = cloneState(current);
  let bestCost = currentCost;

  for (let step = 0; step < ANNEALING_STEPS; step += 1) {
    const progress = step / ANNEALING_STEPS;
    const temperature = START_TEMPERATURE * (END_TEMPERATURE / START_TEMPERATURE) ** progress;
    const candidate = cloneState(current);
    mutate(candidate, random);
    const candidateCost = totalEdgeLength(positionsOf(candidate), edges);
    const accepted =
      candidateCost <= currentCost ||
      random() < Math.exp((currentCost - candidateCost) / temperature);
    if (accepted) {
      current = candidate;
      currentCost = candidateCost;
      if (currentCost < bestCost) {
        best = cloneState(current);
        bestCost = currentCost;
      }
    }
  }
  return positionsOf(best);
}
