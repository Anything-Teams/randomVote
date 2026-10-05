import type { ArenaSpinSnapshot } from './game/ArenaFighter';
import { arenaAnkleRimFlightSnapshot } from './arenaAnkleRimFlight';

/** Leave the ground swing's foreshortening behind without moving the released waist. */
export function arenaAnkleFlightSnapshot(snapshot: ArenaSpinSnapshot, ageMs: number, scale: number): ArenaSpinSnapshot {
  if (!snapshot.planar || !(ageMs > 0) || !Number.isFinite(ageMs) || !(scale > 0) || !Number.isFinite(scale)) return snapshot;
  const source = snapshot.matrix, width = Math.hypot(source[0], source[1]), length = Math.hypot(source[2], source[3]);
  if (width < 1e-8 || length < 1e-8) return snapshot;
  const phase = Math.min(1, ageMs / 300), weight = phase * phase * (3 - 2 * phase);
  const across = 1 + (scale / width - 1) * weight, along = 1 + (scale / length - 1) * weight;
  const lean = snapshot.motion.lean * Math.PI / 180;
  // This is the actual torsoPoint({ x: 0, y: -4 }) used for the mass pivot,
  // including the saved lean. Expanding around the root would make the
  // airborne body slide away from its measured release trajectory.
  const waist = { x: snapshot.hip.x + Math.sin(lean) * 4, y: snapshot.hip.y - Math.cos(lean) * 4 };
  const a = source[0] * across, b = source[1] * across, c = source[2] * along, d = source[3] * along;
  return {
    ...arenaAnkleRimFlightSnapshot(snapshot, ageMs),
    matrix: [a, b, c, d,
      source[4] + (source[0] - a) * waist.x + (source[2] - c) * waist.y,
      source[5] + (source[1] - b) * waist.x + (source[3] - d) * waist.y],
  };
}
