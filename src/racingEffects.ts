import { raceHorseAttachments, type RaceHorseMotion } from './racingArt';
import { racingGaitPhase } from './racingMotionClock';
import type { RacingIncident, RacingTrick, RacingBump } from './racingNarrative';
import type { RacingObstacle } from './racingObstacles';

export type RacingEffectPlacement = { id: string; x: number; y: number; scale: number; index?: number; hand?: { x: number; y: number }; helmet?: { x: number; y: number }; boot?: { x: number; y: number } };
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const pulse = (phase: number, start: number, end: number) => phase <= start || phase >= end ? 0 : Math.sin(Math.PI * smooth((phase - start) / (end - start)));
const phaseAt = (incident: RacingIncident, elapsed: number) => (elapsed - incident.start) / Math.max(1, incident.end - incident.start);

/** Independent actions meet at zero; an inactive channel never replaces a moving pose. */
export function combineRacingHorseMotion(...motions: RaceHorseMotion[]): RaceHorseMotion {
  const combined: RaceHorseMotion = {};
  for (const key of ['jump', 'crouch', 'check', 'slip', 'trip', 'fall', 'spill', 'kick', 'toss', 'stun', 'brace'] as const) {
    if (motions.some(motion => motion[key] !== undefined)) combined[key] = Math.max(0, ...motions.map(motion => motion[key] ?? 0));
  }
  if (motions.some(motion => motion.stumble !== undefined)) combined.stumble = Math.max(-1, Math.min(1, motions.reduce((sum, motion) => sum + (motion.stumble ?? 0), 0)));
  if (motions.some(motion => motion.bodyLean !== undefined)) combined.bodyLean = Math.max(-1, Math.min(1, motions.reduce((sum, motion) => sum + (motion.bodyLean ?? 0), 0)));
  if (combined.crouch) combined.crouch *= 1 - (combined.fall ?? 0);
  for (const motion of motions) {
    if ((motion.kick ?? 0) > 0) { combined.kickReach = motion.kickReach; combined.kickX = motion.kickX; combined.kickY = motion.kickY; }
    if ((motion.toss ?? 0) > 0) combined.tossRelease = motion.tossRelease;
  }
  return combined;
}

/** Incident time controls body actions independently of the supplied finish order. */
export function racingIncidentMotion(incident: RacingIncident | undefined, id: string, elapsed: number, reduced = false): RaceHorseMotion {
  if (!incident || reduced || elapsed < incident.start || elapsed > incident.end || id !== incident.actorId && id !== incident.rivalId) return {};
  const p = phaseAt(incident, elapsed), kind = incident.kind, actor = id === incident.actorId;
  if (kind === 'hay-jump' || kind === 'puddle') return actor ? { crouch: pulse(p, .28, .77) * .72 } : {};
  if (kind === 'gust') return { stumble: pulse(p, .16, .68) * (actor ? .3 : .55), crouch: pulse(p, .13, .76) * (actor ? .75 : .6) };
  if (kind === 'blocked') return actor
    ? { check: pulse(p, .14, .43) * .95, crouch: pulse(p, .38, .93) * .9 }
    : { check: pulse(p, .1, .43) * .4, crouch: pulse(p, .41, .91) * .7 };
  if (['draft', 'lead-change', 'inside', 'outside', 'rail', 'chase', 'last-kick', 'patience'].includes(kind)) return actor
    ? { check: pulse(p, .14, .43) * .9, crouch: pulse(p, .38, .93) * .9 }
    : { check: pulse(p, .38, .72) * .65, crouch: pulse(p, .57, .95) * .85 };
  if (!actor) return {};
  if (kind === 'balance') return { stumble: pulse(p, .08, .56) * Math.sin(clamp((p - .08) / .48) * Math.PI * 3) * .9, crouch: pulse(p, .08, .66) * .6 };
  if (kind === 'fatigue') return { stumble: pulse(p, .1, .76) * .28, crouch: pulse(p, .38, .84) * .25 };
  return { crouch: pulse(p, .27, .88) * (kind === 'inside' || kind === 'last-kick' || kind === 'lead-change' ? .8 : .45) };
}

/** Both opponents converge smoothly, guard the line, then separate as the pass completes. */
export function placeRacingDuel<T extends RacingEffectPlacement>(incident: RacingIncident | undefined, placements: T[], obstacles: RacingObstacle[], elapsed: number): T[] {
  if (!incident || incident.kind === 'hay-jump' || incident.kind === 'puddle' || elapsed < incident.start || elapsed > incident.end) return placements;
  if (obstacles.some(item => [incident.actorId, incident.rivalId].includes(item.actorId) && item.encounter - 1600 < incident.end && item.recovered > incident.start)) return placements;
  const actor = placements.find(item => item.id === incident.actorId), rival = placements.find(item => item.id === incident.rivalId);
  if (!actor || !rival) return placements;
  const p = phaseAt(incident, elapsed), sign = actor.y >= rival.y ? 1 : -1, scale = Math.min(actor.scale, rival.scale);
  const center = (actor.y + rival.y) / 2, separation = 12 * scale;
  const sidestep = smooth((p - .36) / .26), defence = smooth((p - .4) / .28);
  const join = smooth(p / .20) * (1 - smooth((p - .78) / .22));
  return placements.map(item => {
    const target = item.id === actor.id ? center + sign * (separation + sidestep * 25 * scale)
      : item.id === rival.id ? center - sign * separation + sign * defence * 8 * scale : item.y;
    // Guard only a nearby strip of the existing row; an approaching object cannot relocate either horse.
    const step = Math.max(-18 * scale, Math.min(18 * scale, target - item.y));
    return item.id === actor.id || item.id === rival.id ? { ...item, y: item.y + step * join } : item;
  });
}

function bumpBodyMotion(bump: RacingBump, id: string, elapsed: number): RaceHorseMotion {
  const actor = id === bump.actorId, age = elapsed - bump.impact;
  const pressure = smooth(age / 100) * (1 - smooth((age - 180) / 470));
  const windup = smooth((elapsed - bump.start) / (bump.impact - bump.start)) * (1 - smooth((elapsed - bump.impact - 220) / 500));
  return actor ? { bodyLean: windup * .22 + pressure * .62, brace: pressure * .25, check: pressure * .12 }
    : { bodyLean: -pressure * .65, brace: pressure * .7, check: pressure * .25 };
}

function bumpShoulder(bump: RacingBump, item: RacingEffectPlacement, elapsed: number, far: boolean) {
  const index = item.index ?? 0, pose = raceHorseAttachments(index, elapsed, 1, false, { phase: racingGaitPhase(index, elapsed), ...bumpBodyMotion(bump, item.id, elapsed) });
  const point = far ? pose.farShoulder : pose.nearShoulder;
  return { x: item.x + point.x * item.scale, y: item.y + point.y * item.scale };
}

/** The two painted barrel surfaces meet while their real longitudinal distances stay untouched. */
export function placeRacingBump<T extends RacingEffectPlacement>(bump: RacingBump | undefined, placements: T[], elapsed: number, coursePlacements: T[] = placements, reduced = false): T[] {
  if (!bump || reduced || elapsed < bump.start || elapsed >= bump.end) return placements;
  const actor = coursePlacements.find(item => item.id === bump.actorId), target = coursePlacements.find(item => item.id === bump.targetId);
  if (!actor || !target) return placements;
  const sign = actor.y > target.y ? 1 : -1, s = Math.min(actor.scale, target.scale), center = (actor.y + target.y) / 2;
  const a = bumpShoulder(bump, { ...actor, y: 0 }, elapsed, sign > 0), b = bumpShoulder(bump, { ...target, y: 0 }, elapsed, sign < 0);
  const separation = Math.abs(a.y - b.y);
  const join = smooth((elapsed - bump.start) / (bump.impact - bump.start)) * (1 - smooth((elapsed - bump.impact - 350) / (bump.end - bump.impact - 350)));
  const recoil = pulse((elapsed - bump.impact) / 1000, .15, 1) * 4 * s;
  return placements.map(item => {
    if (![actor.id, target.id].includes(item.id)) return item;
    const base = item.id === actor.id ? actor : target;
    const goal = center + (item.id === actor.id ? sign : -sign) * (separation / 2 + (item.id === target.id ? recoil : 0));
    const move = Math.max(-18 * s, Math.min(18 * s, goal - base.y));
    return { ...item, y: item.y + (base.y + move - item.y) * join };
  });
}

export function racingBumpContact(bump: RacingBump | undefined, placements: RacingEffectPlacement[], elapsed: number) {
  if (!bump || elapsed < bump.impact || elapsed >= bump.end) return undefined;
  const actor = placements.find(item => item.id === bump.actorId), target = placements.find(item => item.id === bump.targetId);
  if (!actor || !target) return undefined;
  const sign = actor.y > target.y ? 1 : -1, scale = Math.min(actor.scale, target.scale);
  const a = bumpShoulder(bump, actor, elapsed, sign > 0), b = bumpShoulder(bump, target, elapsed, sign < 0);
  const gap = Math.hypot(a.x - b.x, a.y - b.y), strength = 1 - smooth((gap / scale - 2) / 6);
  return { actor: a, target: b, gap, scale, strength };
}

export function racingBumpMotion(bump: RacingBump | undefined, id: string, elapsed: number, placements: RacingEffectPlacement[], reduced = false): RaceHorseMotion {
  if (!bump || reduced || elapsed < bump.start || elapsed >= bump.end || ![bump.actorId, bump.targetId].includes(id)) return {};
  const motion = bumpBodyMotion(bump, id, elapsed);
  if (id === bump.actorId) return motion;
  const strength = racingBumpContact(bump, placements, elapsed)?.strength ?? 0;
  return { bodyLean: (motion.bodyLean ?? 0) * strength, brace: (motion.brace ?? 0) * strength, check: (motion.check ?? 0) * strength };
}

/** Projected origins match drawRaceHorse: hooves at y, the nose at x + 57 * scale. */
export function drawRacingIncidentEffects(ctx: CanvasRenderingContext2D, incident: RacingIncident | undefined, placements: RacingEffectPlacement[], elapsed: number, reduced: boolean, layer: 'ground' | 'air'): void {
  if (!incident || reduced || elapsed < incident.start || elapsed > incident.end) return;
  const actor = placements.find(item => item.id === incident.actorId), rival = placements.find(item => item.id === incident.rivalId);
  if (!actor) return;
  const p = phaseAt(incident, elapsed), kind = incident.kind, s = Math.max(.05, actor.scale);
  const fade = 1 - smooth((p - .76) / .2);
  const dot = (x: number, y: number, size: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(x, y, Math.max(.6, size * s), Math.max(.6, size * s)); };
  const line = (x1: number, y1: number, x2: number, y2: number, width: number, color: string) => {
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(.5, width * s); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  ctx.save(); ctx.globalAlpha *= fade;
  if (layer === 'ground') {
    if (kind === 'balance' && p > .12 && p < .58) {
      const slide = pulse(p, .12, .58);
      line(actor.x + 16 * s - slide * 7 * s, actor.y, actor.x + 24 * s, actor.y, 1, '#bc9c6e85');
      line(actor.x + 18 * s - slide * 5 * s, actor.y + 2 * s, actor.x + 26 * s, actor.y + 2 * s, .7, '#725b4280');
    }
  } else {
    if (kind === 'gust' && p > .09 && p < .76) {
      ctx.globalAlpha *= pulse(p, .09, .76) * .7;
      for (const horse of rival ? [actor, rival] : [actor]) for (let gust = 0; gust < 3; gust++) {
        const hs = horse.scale, x = horse.x + (70 - ((p * 2 + gust * .21) % 1) * 125) * hs, y = horse.y - (69 + gust * 4) * hs;
        line(x, y, x - (18 + gust * 3) * hs, y + hs, .65, '#c4d7d2');
      }
    } else if (kind === 'balance' && p > .13 && p < .36) {
      for (let chip = 0; chip < 3; chip++) {
        const age = (p - .13) / .23; dot(actor.x + (23 - age * (4 + chip * 3)) * s, actor.y - Math.sin(age * Math.PI) * (2 + chip) * s, .7, '#c4ac81');
      }
    } else if (kind === 'fatigue' && p > .2 && p < .73) {
      ctx.globalAlpha *= pulse(p, .2, .73) * .6;
      for (let breath = 0; breath < 2; breath++) {
        const age = (p * 2 + breath * .5) % 1;
        dot(actor.x + (57 + age * 7) * s, actor.y - (36 + age * 2) * s, 1.2 + age, '#ddd6bd');
      }
    }
  }
  ctx.restore();
}


/** Adjacent rivals share one lane for a trick; course progress never changes here. */
export function placeRacingTrick<T extends RacingEffectPlacement>(trick: RacingTrick | undefined, placements: T[], elapsed: number): T[] {
  if (!trick || trick.kind === 'beanbag' || elapsed < trick.start || elapsed >= trick.recovered) return placements;
  const actor = placements.find(item => item.id === trick.actorId), target = placements.find(item => item.id === trick.targetId);
  if (!actor || !target) return placements;
  const join = smooth((elapsed - trick.start) / Math.max(1, trick.release - trick.start)) * (1 - smooth((elapsed - trick.lowest) / (trick.recovered - trick.lowest)));
  const center = (actor.y + target.y) / 2, gap = Math.min(actor.scale, target.scale) * (trick.kind === 'rear-kick' ? 3 : 9);
  const sign = actor.y < target.y ? -1 : 1;
  return placements.map(item => item.id === actor.id || item.id === target.id ? { ...item, y: item.y + (center + (item.id === actor.id ? sign : -sign) * gap - item.y) * join } : item);
}

export function racingTrickMotion(trick: RacingTrick | undefined, id: string, elapsed: number, placements: RacingEffectPlacement[], reduced = false): RaceHorseMotion {
  if (!trick || reduced || elapsed < trick.start || elapsed >= trick.recovered || id !== trick.actorId && id !== trick.targetId) return {};
  const scale = (trick.lowest - trick.impact) / 1350, actor = id === trick.actorId;
  if (actor && trick.kind === 'rear-kick') {
    const p = (elapsed - trick.release) / (trick.impact - trick.release);
    const kick = elapsed < trick.impact ? smooth(p) : 1 - smooth((elapsed - trick.impact) / (450 * scale));
    const source = placements.find(item => item.id === id), target = placements.find(item => item.id === trick.targetId);
    const kickReach = source && target ? clamp((source.x - target.x - 29 * target.scale) / (42 * source.scale)) : .65;
    const contact = target?.boot ?? (target ? { x: target.x + 5 * target.scale, y: target.y - 31 * target.scale } : undefined);
    const kickX = source && contact ? (contact.x - source.x) / source.scale : -24 - 42 * kickReach;
    const kickY = source && contact ? (contact.y - source.y) / source.scale : -31;
    return { kick, kickReach, kickX, kickY, check: kick * .25 };
  }
  if (actor) {
    const toss = smooth((elapsed - trick.start) / (400 * scale)) * (1 - smooth((elapsed - trick.release - 160 * scale) / (450 * scale)));
    return { toss, tossRelease: smooth((elapsed - trick.release + 200 * scale) / (400 * scale)) };
  }
  const stun = smooth((elapsed - trick.impact) / (300 * scale)) * (1 - smooth((elapsed - trick.lowest + 150 * scale) / (650 * scale)));
  const chase = smooth((elapsed - trick.lowest) / (350 * scale)) * (1 - smooth((elapsed - trick.recovered + 400 * scale) / (400 * scale)));
  return { stun, check: stun * .94, stumble: stun * .16, crouch: chase * .85 };
}

/** The same current hand and helmet coordinates drive release, flight and contact. */
export function racingTrickProjectile(trick: RacingTrick, placements: RacingEffectPlacement[], elapsed: number) {
  if (trick.kind !== 'beanbag' || elapsed < trick.release || elapsed > trick.impact) return undefined;
  const actor = placements.find(item => item.id === trick.actorId), target = placements.find(item => item.id === trick.targetId);
  if (!actor || !target) return undefined;
  const p = clamp((elapsed - trick.release) / (trick.impact - trick.release)), s = (actor.scale + target.scale) / 2;
  const from = actor.hand ?? { x: actor.x + 12 * actor.scale, y: actor.y - 73 * actor.scale };
  const to = target.helmet ?? { x: target.x + 14 * target.scale, y: target.y - 76 * target.scale };
  return { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p - Math.sin(p * Math.PI) * 30 * s, scale: s, phase: p, target: to };
}

export function drawRacingTrickEffects(ctx: CanvasRenderingContext2D, trick: RacingTrick | undefined, placements: RacingEffectPlacement[], elapsed: number, reduced: boolean) {
  if (!trick || reduced) return;
  const ball = racingTrickProjectile(trick, placements, elapsed);
  if (ball) {
    ctx.save(); ctx.translate(ball.x, ball.y); ctx.scale(ball.scale, ball.scale); ctx.rotate(ball.phase * Math.PI * 3);
    ctx.fillStyle = '#edb349'; ctx.strokeStyle = '#493520'; ctx.lineWidth = .8; ctx.beginPath(); ctx.roundRect(-4, -3.5, 8, 7, 1.6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff0a9'; ctx.fillRect(-2.5, -2, 3, 1.4); ctx.strokeStyle = '#7c5428'; ctx.beginPath(); ctx.moveTo(1, -2.5); ctx.lineTo(1, 2.5); ctx.stroke(); ctx.restore();
  }
}
