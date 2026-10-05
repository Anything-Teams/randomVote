type Point = { x: number; y: number };
type Matrix = [number, number, number, number, number, number];

/** Fit each held ankle without stretching the body or either complete leg. */
export function arenaAnkleFootHold(matrix: Matrix, hips: readonly Point[], grips: readonly [Point, Point], reach = 21.98) {
  const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
  if (Math.abs(determinant) < 1e-8) return undefined;
  const targets = grips.map(point => {
    const x = point.x - matrix[4], y = point.y - matrix[5];
    return { x: (matrix[3] * x - matrix[2] * y) / determinant, y: (-matrix[1] * x + matrix[0] * y) / determinant };
  });
  let minimum = -Infinity, maximum = Infinity;
  for (let leg = 0; leg < 2; leg++) {
    const x = targets[leg].x - hips[leg].x, y = targets[leg].y - hips[leg].y;
    if (Math.abs(x) > reach) return undefined;
    const verticalReach = Math.sqrt(reach * reach - x * x);
    minimum = Math.max(minimum, y - verticalReach);
    maximum = Math.min(maximum, y + verticalReach);
  }
  if (minimum > maximum) return undefined;
  // Move the torso only as far as both normal legs require. The feet retain
  // their own supporting palms while the knees absorb the pickup motion.
  const shift = Math.max(minimum, Math.min(maximum, 0));
  const fitted: Matrix = [...matrix];
  fitted[4] += matrix[2] * shift;
  fitted[5] += matrix[3] * shift;
  const feet = targets.map(point => ({ x: point.x, y: point.y - shift })) as [Point, Point];
  return { matrix: fitted, feet };
}
