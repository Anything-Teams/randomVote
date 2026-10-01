import type { RaceHorseMotion } from './racingArt';
import type { RacingIncident } from './racingNarrative';

export type RacingEffectPlacement = { id: string; x: number; y: number; scale: number };
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const pulse = (phase: number, start: number, end: number) => phase <= start || phase >= end ? 0 : Math.sin(Math.PI * smooth((phase - start) / (end - start)));
const phaseAt = (incident: RacingIncident, elapsed: number) => (elapsed - incident.start) / Math.max(1, incident.end - incident.start);

/** Incident time controls body actions independently of the supplied finish order. */
export function racingIncidentMotion(incident: RacingIncident | undefined, id: string, elapsed: number, reduced = false): RaceHorseMotion {
  if (!incident || reduced || elapsed < incident.start || elapsed > incident.end || id !== incident.actorId && id !== incident.rivalId) return {};
  const p = phaseAt(incident, elapsed), kind: string = incident.kind, actor = id === incident.actorId;
  if (kind === 'hay-jump' || kind === 'puddle') return actor ? { jump: pulse(p, .32, .62), crouch: pulse(p, .24, .66) * .72 } : {};
  if (kind === 'kick-dust') return actor
    ? { kick: pulse(p, .24, .52), crouch: pulse(p, .16, .56) * .35 }
    : { stumble: pulse(p, .36, .74) * .7, crouch: pulse(p, .34, .76) * .95 };
  if (kind === 'gust') return { stumble: pulse(p, .16, .68) * (actor ? .3 : .55), crouch: pulse(p, .13, .76) * (actor ? .75 : .6) };
  if (!actor) return {};
  if (kind === 'balance') return { stumble: pulse(p, .08, .56) * Math.sin(clamp((p - .08) / .48) * Math.PI * 3) * .9, crouch: pulse(p, .08, .66) * .6 };
  if (kind === 'fatigue') return { stumble: pulse(p, .1, .76) * .28, crouch: pulse(p, .38, .84) * .25 };
  if (kind === 'blocked') return { crouch: pulse(p, .05, .4) * .6, stumble: pulse(p, .13, .37) * .22 };
  return { crouch: pulse(p, .27, .88) * (kind === 'inside' || kind === 'last-kick' || kind === 'lead-change' ? .8 : .45) };
}

/** Projected origins match drawRaceHorse: hooves at y, the nose at x + 57 * scale. */
export function drawRacingIncidentEffects(ctx: CanvasRenderingContext2D, incident: RacingIncident | undefined, placements: RacingEffectPlacement[], elapsed: number, reduced: boolean, layer: 'ground' | 'air'): void {
  if (!incident || reduced || elapsed < incident.start || elapsed > incident.end) return;
  const actor = placements.find(item => item.id === incident.actorId), rival = placements.find(item => item.id === incident.rivalId);
  if (!actor) return;
  const p = phaseAt(incident, elapsed), kind: string = incident.kind, s = Math.max(.05, actor.scale);
  const fade = 1 - smooth((p - .76) / .2);
  const dot = (x: number, y: number, size: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(x, y, Math.max(.6, size * s), Math.max(.6, size * s)); };
  const line = (x1: number, y1: number, x2: number, y2: number, width: number, color: string) => {
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(.5, width * s); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  ctx.save(); ctx.globalAlpha *= fade;
  if (layer === 'ground') {
    if (kind === 'hay-jump' || kind === 'puddle') {
      // A track object approaches, passes under the airborne horse, then recedes.
      const travel = smooth((p - .12) / .68), x = actor.x + mix(103, -57, travel) * s, y = actor.y;
      if (kind === 'hay-jump') {
        ctx.save(); ctx.translate(x, y - 6 * s); ctx.rotate(-travel * Math.PI * 1.65);
        ctx.fillStyle = '#685033'; ctx.beginPath(); ctx.ellipse(0, s, 12 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#bf9753'; ctx.beginPath(); ctx.ellipse(0, 0, 11 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
        for (let straw = 0; straw < 6; straw++) line((-8 + straw * 3) * s, -3 * s, (-6 + straw * 3) * s, 3 * s, .8, straw % 2 ? '#e1c985' : '#94713d');
        line(-4 * s, -5 * s, -3 * s, 5 * s, 1.3, '#74604c'); line(4 * s, -5 * s, 3 * s, 5 * s, 1.3, '#74604c');
        ctx.restore();
      } else {
        ctx.fillStyle = '#244c606e'; ctx.beginPath(); ctx.ellipse(x, y + s, 29 * s, 4.2 * s, -.02, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6babb88a'; ctx.beginPath(); ctx.ellipse(x + 3 * s, y + .5 * s, 24 * s, 2.6 * s, -.02, 0, Math.PI * 2); ctx.fill();
        line(x - 15 * s, y, x - 2 * s, y - .4 * s, .6, '#bbd8d1'); line(x + 7 * s, y + s, x + 18 * s, y + .4 * s, .5, '#94c6ce');
      }
    } else if (kind === 'kick-dust' && p > .1 && p < .58) {
      for (let clod = 0; clod < 5; clod++) dot(actor.x + (22 + clod * 1.6) * s, actor.y - (clod % 2) * s, 1.1, '#be9f6e');
    } else if (kind === 'balance' && p > .12 && p < .58) {
      const slide = pulse(p, .12, .58);
      line(actor.x + 16 * s - slide * 7 * s, actor.y, actor.x + 24 * s, actor.y, 1, '#bc9c6e85');
      line(actor.x + 18 * s - slide * 5 * s, actor.y + 2 * s, actor.x + 26 * s, actor.y + 2 * s, .7, '#725b4280');
    }
  } else {
    if (kind === 'kick-dust' && rival && p > .24 && p < .78) {
      const target = { x: rival.x + 35 * rival.scale, y: rival.y - 37 * rival.scale };
      const source = { x: actor.x + 24 * s, y: actor.y - 2 * s };
      ctx.globalAlpha *= 1 - smooth((p - .63) / .15);
      for (let particle = 0; particle < 12; particle++) {
        const t = clamp((p - .26 - particle * .006) / .34), spread = Math.sin(particle * 2.4) * (3 + t * 5) * s;
        const x = mix(source.x, target.x, t) + spread * .45, y = mix(source.y, target.y, t) - Math.sin(t * Math.PI) * (14 + particle % 3 * 3) * s + spread;
        const size = (1.3 + particle % 3 * .55) * (1 - t * .3);
        dot(x, y, size, particle % 3 ? '#c5ad7faa' : '#e1c797bb');
      }
    } else if (kind === 'puddle' && p > .59 && p < .83) {
      const age = (p - .59) / .24; ctx.globalAlpha *= 1 - smooth(age);
      for (let splash = 0; splash < 8; splash++) {
        const direction = splash % 2 ? 1 : -1;
        dot(actor.x + (24 + direction * age * (8 + splash)) * s, actor.y - Math.sin(age * Math.PI) * (3 + splash % 4 * 2) * s, .9, '#a5d5dc');
      }
    } else if (kind === 'hay-jump' && p > .31 && p < .74) {
      const age = (p - .31) / .43; ctx.globalAlpha *= Math.sin(age * Math.PI);
      for (let straw = 0; straw < 5; straw++) {
        const x = actor.x - (8 + age * (12 + straw * 2)) * s, y = actor.y - Math.sin(age * Math.PI) * (3 + straw) * s;
        line(x, y, x + 2 * s, y - s, .55, '#d5bb79');
      }
    } else if (kind === 'gust' && p > .09 && p < .76) {
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
