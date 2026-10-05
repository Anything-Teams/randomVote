/** The ankle-held body crosses both halves of a horizontal swing, with readable depth. */
export function arenaAnkleSwingProjection(orbit: number) {
  const radial = { x: Math.cos(orbit), y: -.50 * Math.sin(orbit) };
  const radialDerivative = { x: -Math.sin(orbit), y: -.50 * Math.cos(orbit) };
  const length = Math.hypot(radial.x, radial.y), width = .42 + Math.abs(Math.sin(orbit)) * .58;
  return {
    radial, radialDerivative, length, width,
    angle: Math.atan2(-radial.x, radial.y),
    angleDerivative: (radial.x * radialDerivative.y - radial.y * radialDerivative.x) / (length * length),
    widthDerivative: Math.sign(Math.sin(orbit)) * Math.cos(orbit) * .58,
    lengthDerivative: (radial.x * radialDerivative.x + radial.y * radialDerivative.y) / length,
  };
}

/** Unmirrored ground axes: face the outward body and turn the shoulders across it. */
export function arenaAnkleSwingCasterProjection(orbit: number) {
  const c = Math.cos(orbit), s = Math.sin(orbit);
  return {
    front: { x: -c, y: .50 * s },
    across: { x: s, y: .50 * c },
    faceDirection: s,
  };
}

/** Canvas basis shared by the held rig and its actual release derivative. */
export function arenaAnkleSwingBasis(orbit: number, scale: number, facing: number) {
  const { angle, width, length } = arenaAnkleSwingProjection(orbit), c = Math.cos(angle), s = Math.sin(angle);
  return [c * scale * facing * width, s * scale * facing * width, -s * scale * length, c * scale * length] as const;
}
