import type { ArenaSpinSnapshot } from './game/ArenaFighter';

type Point = { x: number; y: number };
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const angle = (a: Point, b: Point) => Math.atan2(b.y - a.y, b.x - a.x);
const wrapped = (value: number) => Math.atan2(Math.sin(value), Math.cos(value));
const bone = (root: Point, direction: number, length: number): Point => ({ x: root.x + Math.cos(direction) * length, y: root.y + Math.sin(direction) * length });
const limitedTurn = (from: number, to: number, limit: number) => Math.max(-limit, Math.min(limit, wrapped(to - from)));

/** Relax a low ankle throw's free limbs without moving its torso or changing its silhouette basis. */
export function arenaAnkleRimFlightSnapshot(snapshot: ArenaSpinSnapshot, ageMs: number): ArenaSpinSnapshot {
  if (!(ageMs > 0) || !Number.isFinite(ageMs)) return snapshot;
  const { hips, knees, shoulders, elbows, footAngles } = snapshot;
  if (!hips || !knees || !shoulders || !elbows || !footAngles || [hips, knees, shoulders, elbows, snapshot.feet, snapshot.hands, footAngles].some(points => points.length !== 2)) return snapshot;
  const matrix = snapshot.matrix, determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
  if (Math.abs(determinant) < 1e-8) return snapshot;
  // Gravity in the saved body's own coordinates keeps mirrored flights alike.
  const gravity = Math.atan2(matrix[0] / determinant, -matrix[2] / determinant);
  const entry = Math.min(1, ageMs / 300), smooth = entry * entry * (3 - 2 * entry);
  const settle = Math.max(0, ageMs - 300) / 850;
  const lag = smooth * (.72 + .28 * Math.exp(-settle * settle));
  const bends = knees.map((joint, leg) => wrapped(angle(joint, snapshot.feet[leg]) - angle(hips[leg], joint)));
  const bend = Math.sign(bends[0] + bends[1]) || -Math.sign(Math.cos(gravity)) || 1;
  const relaxedKnees = knees.map((joint, leg) => bone(hips[leg], angle(hips[leg], joint) - bend * .05 * lag, distance(hips[leg], joint)));
  const feet = snapshot.feet.map((foot, leg) => bone(relaxedKnees[leg], angle(knees[leg], foot) + bend * .13 * lag, distance(knees[leg], foot))) as [Point, Point];
  const relaxedElbows = elbows.map((joint, arm) => {
    const direction = angle(shoulders[arm], joint);
    return bone(shoulders[arm], direction + limitedTurn(direction, gravity, .14) * lag, distance(shoulders[arm], joint));
  });
  const hands = snapshot.hands.map((hand, arm) => {
    const direction = angle(elbows[arm], hand);
    return bone(relaxedElbows[arm], direction + limitedTurn(direction, gravity, .22) * lag, distance(elbows[arm], hand));
  });
  return {
    ...snapshot, knees: relaxedKnees, feet, elbows: relaxedElbows, hands,
    footAngles: footAngles.map(value => value + bend * .03 * lag),
  };
}
