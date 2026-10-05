type FighterPoint = { x: number; y: number; angle?: number };
export type ArenaCamera = { x: number; y: number; zoom: number; elapsed: number | null; rimMargin?: number };
type CameraFrame = { elapsed: number; final: boolean; fighters: readonly FighterPoint[]; width: number; height: number; delta: number; immediate?: boolean; rimImpact?: { x: number; y: number } };

export function createArenaCamera(): ArenaCamera { return { x: 500, y: 310, zoom: 1, elapsed: null }; }
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** Follow both finalists, including a thrown body, without cutting away from their contact. */
export function sampleArenaCamera(camera: ArenaCamera, frame: CameraFrame) {
  const { width, height, fighters, elapsed } = frame;
  const rimImpact = frame.rimImpact && Number.isFinite(frame.rimImpact.x) && Number.isFinite(frame.rimImpact.y) ? frame.rimImpact : undefined;
  let x = width / 2, y = height / 2, zoom = 1;
  if (frame.final && fighters.length >= 2) {
    const bounds = fighters.map(fighter => {
      const rotating = Math.abs(Math.sin(fighter.angle ?? 0));
      return { left: fighter.x - 72 - rotating * 60, right: fighter.x + 72 + rotating * 60, top: fighter.y - 144, bottom: fighter.y + 25 + rotating * 55 };
    });
    // Reserve the landing corridor while the body is still in flight; a
    // short flight otherwise reaches the edge before this smooth pan does.
    const left = Math.min(...bounds.map(box => box.left), rimImpact ? rimImpact.x - 96 : Infinity);
    const right = Math.max(...bounds.map(box => box.right), rimImpact ? rimImpact.x + 96 : -Infinity);
    const top = Math.min(...bounds.map(box => box.top)), bottom = Math.max(...bounds.map(box => box.bottom));
    zoom = clamp(Math.min(1.4, (width - 112) / Math.max(1, right - left), (height - 112) / Math.max(1, bottom - top)), 1, 1.4);
    x = (left + right) / 2; y = (top + bottom) / 2;
  }
  else if (rimImpact) x += clamp(rimImpact.x - width / 2, -96, 96);
  const immediate = frame.immediate || camera.elapsed === null || elapsed < camera.elapsed - 150 || elapsed - camera.elapsed > 500;
  const blend = immediate ? 1 : 1 - Math.exp(-Math.max(0, frame.delta) / (frame.final ? 420 : 650));
  camera.zoom += (zoom - camera.zoom) * blend;
  camera.x += (x - camera.x) * blend; camera.y += (y - camera.y) * blend;
  // The side corridor gives a thrown body room to strike the floor. Ease
  // this allowance back with the camera so the clamp cannot snap it inward.
  camera.rimMargin = (camera.rimMargin ?? 0) + ((rimImpact ? 96 : 0) - (camera.rimMargin ?? 0)) * blend;
  const halfWidth = width / (2 * camera.zoom), halfHeight = height / (2 * camera.zoom);
  camera.x = clamp(camera.x, halfWidth - camera.rimMargin, width - halfWidth + camera.rimMargin);
  camera.y = clamp(camera.y, halfHeight, height - halfHeight);
  camera.elapsed = elapsed;
  return { x: camera.x, y: camera.y, zoom: camera.zoom };
}
