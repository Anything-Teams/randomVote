import type { ArenaPoint } from './arenaLogic';

/** Painted toe coordinates are relative to the ground body, not its rotated drawing origin. */
export function arenaAnklePickup(body: ArenaPoint, feet: readonly ArenaPoint[], side: number) {
  const toes = { x: (feet[0].x + feet[1].x) / 2, y: (feet[0].y + feet[1].y) / 2 };
  const holder = { x: toes.x + side * 32, y: toes.y + 24 };
  return {
    holder,
    offset: { x: holder.x - body.x, y: holder.y - body.y },
    feet: feet.map(foot => ({ x: foot.x - body.x, y: foot.y - body.y })),
  };
}
