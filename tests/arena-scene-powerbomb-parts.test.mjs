import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Exercise the actual receiving catch and complete ankle finish. Capture
// paint passes only; neither the moving roots nor the contact clocks change.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const initialize = 'const ambient = won ? [] : active.filter';
assert.ok(source.includes(draw) && source.includes(initialize));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'powerPartsScenery(ctx, clock,')
  .replace(draw, `powerPartsActors = actors; ${draw}`)
  .replace(initialize, `powerPartsInitialize(sim, reset); ${initialize}`)
  .replace('if (actor.powerbombRearActor) drawArenaPowerbombRearLeg(ctx, actor.powerbombRearActor, clock);', 'if (actor.powerbombRearActor) { ctx.rearStart(actor.powerbombRearActor); drawArenaPowerbombRearLeg(ctx, actor.powerbombRearActor, clock); ctx.rearEnd(actor.powerbombRearActor); }')
  .replaceAll('paintArenaFighter(ctx, actor, clock);', 'ctx.bodyStart(actor); paintArenaFighter(ctx, actor, clock); ctx.bodyEnd(actor);')
  .replace('if (actor.scoopSupportActor) drawArenaCradleSupport(ctx, actor.scoopSupportActor);', 'if (actor.scoopSupportActor) { ctx.supportStart(actor.scoopSupportActor); drawArenaCradleSupport(ctx, actor.scoopSupportActor); ctx.supportEnd(actor.scoopSupportActor); }');
source += '\nlet powerPartsActors; const powerPartsScenery = () => {}; let powerPartsInitialize = () => {}; export const setInitialize = fn => { powerPartsInitialize = fn; }; export const capture = () => powerPartsActors; export { render, createArenaCamera, arenaRounds };';
const result = await build({
  stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' },
  plugins: [{ name: 'capture-powerbomb-paint-parts', setup(builder) {
    builder.onLoad({ filter: /\/game\/ArenaFighter\.ts$/ }, async args => {
      let fighter = await readFile(args.path, 'utf8');
      fighter = fighter
        .replace('const source = animation.powerbombRearLeg;', 'const source = animation.powerbombRearLeg; ctx.observeRearPrediction?.(source);')
        .replace('function paintLeg(ctx: CanvasRenderingContext2D, hip: Point, joint: Point, ankle: Point, footAngle: number, palette: Palette, lowerOnly = false) {', 'function paintLeg(ctx: CanvasRenderingContext2D, hip: Point, joint: Point, ankle: Point, footAngle: number, palette: Palette, lowerOnly = false) { ctx.observeLeg?.({ hip, knee: joint, foot: ankle, footAngle, lowerOnly });')
        .replace('function paintPolygon(ctx: CanvasRenderingContext2D, points: Point[], color: string) {', 'function paintPolygon(ctx: CanvasRenderingContext2D, points: Point[], color: string) { ctx.observePolygon?.(points);')
        .replace('function segment(ctx: CanvasRenderingContext2D, a: Point, b: Point, width: number, palette: Palette) {', 'function segment(ctx: CanvasRenderingContext2D, a: Point, b: Point, width: number, palette: Palette) { ctx.observeSegment?.({ a, b, width });');
      return { contents: fighter, loader: 'ts' };
    });
  } }],
});
const module = { exports: {} };
new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, capture, setInitialize } = module.exports;
const noop = () => {};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const samePoint = (a, b) => distance(a, b) < 1e-8;
const world = (matrix, point) => ({ x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] });
const armWorld = (source, point) => {
  const c = Math.cos(source.lean), s = Math.sin(source.lean);
  return world(source.matrix, { x: source.hip.x + c * point.x - s * point.y, y: source.hip.y + s * point.x + c * point.y });
};

function context() {
  let pass;
  const target = {
    events: [], rears: [], bodies: [], supports: [],
    measureText: value => ({ width: String(value).length * 8 }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    begin(kind, actor) {
      assert.equal(pass, undefined, 'paint passes cannot recursively advance the live body');
      pass = { kind, id: actor.candidate.id, transforms: [], legs: [], polygons: [], segments: [], before: structuredClone(actor.animation) };
      this.events.push(`${kind}:${actor.candidate.id}`);
    },
    end(kind, actor) {
      assert.equal(pass?.kind, kind);
      if (kind !== 'body') assert.deepEqual(actor.animation, pass.before, 'a rear or foreground pass must leave the entire live animation unchanged');
      this[kind === 'rear' ? 'rears' : kind === 'body' ? 'bodies' : 'supports'].push(pass);
      pass = undefined;
    },
    bodyStart(actor) { this.begin('body', actor); }, bodyEnd(actor) { this.end('body', actor); },
    rearStart(actor) { this.begin('rear', actor); }, rearEnd(actor) { this.end('rear', actor); },
    supportStart(actor) { this.begin('support', actor); }, supportEnd(actor) { this.end('support', actor); },
    transform(...matrix) { if (pass) pass.transforms.push(matrix); },
    observeRearPrediction(value) { if (pass) pass.prediction = structuredClone(value); },
    observeLeg(value) { if (pass) pass.legs.push(structuredClone(value)); },
    observePolygon(points) { if (pass) pass.polygons.push(structuredClone(points)); },
    observeSegment(value) { if (pass) pass.segments.push(structuredClone(value)); },
    reset() { this.events = []; this.rears = []; this.bodies = []; this.supports = []; },
  };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}

for (const controlled of [false, true]) for (const mirrored of [false, true]) for (const delta of [16, 50]) test(`powerbomb: the continuous held body straddles its receiver with a connected near arm (${controlled ? 'controlled' : 'natural'}, ${mirrored ? 'mirrored' : 'ordinary'}, ${delta}ms)`, () => {
  const order = ['2', '1'], duration = 44000, seed = 4, planned = arenaRounds(order, duration, 7, seed)[0];
  assert.equal(planned.wrestlingMove?.kind, 'powerbomb');
  const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  setInitialize((current, reset) => {
    if (current !== sim || !reset) return;
    if (controlled) { Object.assign(sim.bodies.get(planned.aggressor), { x: 525, y: 416 }); Object.assign(sim.bodies.get(planned.victim), { x: 300, y: 416 }); }
    if (mirrored) for (const body of sim.bodies.values()) { body.x = 1000 - body.x; body.facing *= -1; body.animation = undefined; }
  });
  let heldFrames = 0, groundFrames = 0, spinFrames = 0, flightFrames = 0, releaseAt;
  const stages = new Set();
  for (let elapsed = 0; elapsed < 20000; elapsed += delta) {
    ctx.reset(); render(ctx, props, elapsed, elapsed, sim, delta, false);
    const caster = capture().get(planned.aggressor), victim = capture().get(planned.victim), window = sim.contacts.get(planned.id)?.round.wrestlingMove;
    assert.equal(window?.kind, 'powerbomb', 'the actual incoming catch remains the selected front slam');
    const holding = window.contactAt != null && caster.pose === 'powerbomb' && caster.gripMode === 'waist' && caster.gripStrength > .001;
    if (holding) {
      const detail = `${controlled}/${mirrored}/${delta}/${elapsed}`;
      assert.equal(ctx.rears.length, 1, `one complete far leg must be behind the receiver: ${detail}`);
      assert.equal(ctx.supports.length, 1, `one connected near arm must wrap in front: ${detail}`);
      const rear = ctx.rears[0], support = ctx.supports[0], casterBody = ctx.bodies.find(part => part.id === planned.aggressor), victimBody = ctx.bodies.find(part => part.id === planned.victim);
      assert.deepEqual(ctx.events.filter(event => event.endsWith(`:${planned.aggressor}`) || event.endsWith(`:${planned.victim}`)), [`rear:${planned.victim}`, `body:${planned.aggressor}`, `body:${planned.victim}`, `support:${planned.aggressor}`], `far thigh and cuff, receiving body, carried trunk and near leg, then complete near arm keep their anatomical depth: ${detail}`);
      assert.equal(victim.powerbombSplit, true);
      const back = victim.animation.powerbombRearLeg, body = victim.animation.contactPoints, skeleton = victim.animation.skeleton;
      assert.deepEqual(rear.prediction, back, `the clone-only rear prediction is exactly the subsequent live body rig: ${detail}`);
      assert.deepEqual(rear.transforms, [back.matrix], 'the rear pixels use the actual carried body transform');
      assert.deepEqual(victimBody.transforms, [back.matrix], 'the carried trunk and both anatomical legs share one transform');
      assert.deepEqual(rear.legs, [{ hip: back.hip, knee: back.knee, foot: back.foot, footAngle: back.footAngle, lowerOnly: false }], 'the rear pass paints one entire connected thigh, shin and sole');
      assert.deepEqual(rear.polygons[0], back.shorts, 'the far shorts cuff stays with the far thigh behind the receiving body');
      assert.equal(rear.polygons.length, 2, 'the rear pass adds only its cuff and cuff shading');
      assert.deepEqual(back.hip, skeleton.hips[0]); assert.deepEqual(back.knee, skeleton.knees[0]); assert.deepEqual(back.foot, skeleton.feet[0]);
      assert.deepEqual(back.shorts, skeleton.shorts[0]); assert.equal(back.footAngle, skeleton.footAngles[0]);
      assert.ok(samePoint(world(back.matrix, back.foot), body.feet[0]), 'the rear sole is the same actual painted toe, rather than a stale previous frame');
      assert.ok(victimBody.legs.some(leg => !leg.lowerOnly && samePoint(leg.hip, skeleton.hips[1]) && samePoint(leg.foot, skeleton.feet[1])), 'the near leg remains part of the carried body foreground');
      assert.ok(victimBody.legs.every(leg => !samePoint(leg.foot, skeleton.feet[0])), 'the far leg cannot be repainted through the receiving torso');
      assert.ok(victimBody.polygons.some(points => JSON.stringify(points) === JSON.stringify(skeleton.shorts[1])), 'the near shorts cuff remains on its own thigh');
      assert.ok(victimBody.polygons.every(points => JSON.stringify(points) !== JSON.stringify(skeleton.shorts[0])), 'the far shorts cuff cannot reappear through the receiving chest');
      const forearm = caster.animation.cradleForearm, rig = caster.animation.contactPoints;
      assert.ok(forearm.shoulder, 'the foreground support includes the shoulder and upper arm, not an isolated forearm');
      assert.deepEqual(support.transforms, [forearm.matrix]); assert.deepEqual(casterBody.transforms, [forearm.matrix]);
      assert.deepEqual(support.segments, [{ a: forearm.shoulder, b: forearm.elbow, width: 5.5 }, { a: forearm.elbow, b: forearm.hand, width: 4.9 }], 'the full foreground support paints the same shoulder, upper arm, elbow, forearm and palm');
      for (const [part, target] of [['shoulder', rig.shoulders[1]], ['elbow', rig.elbows[1]], ['hand', rig.hands[1]]]) assert.ok(samePoint(armWorld(forearm, forearm[part]), target), `the foreground ${part} stays attached to the live receiving rig: ${detail}`);
      if (caster.powerbombLoad > .2 && caster.powerbombLift < .01) stages.add('load');
      if (caster.powerbombLift > .2) stages.add('lift');
      if (caster.powerbombLift > .99 && caster.powerbombDown < .001) stages.add('apex');
      if (caster.powerbombDown > .2) stages.add('down');
      heldFrames++;
    } else {
      assert.equal(ctx.rears.length, 0, 'receiving preparation, ground recovery, ankle grip, rotation and release have no floating far leg');
      assert.equal(ctx.supports.length, 0, 'the foreground receiving arm ends with the physical waist support');
      assert.equal(victim.powerbombSplit, undefined, 'a released body resumes its complete normal silhouette');
      assert.equal(victim.animation.powerbombRearLeg, undefined, 'rear geometry cannot remain cached after the support ends');
      if (window.contactAt != null && victim.pose === 'stunned') groundFrames++;
      if (victim.spinSuspension) spinFrames++;
    }
    const exit = sim.exits.get(planned.victim);
    if (exit?.spinFlight) { releaseAt ??= exit.launchedAt; flightFrames++; }
    if (releaseAt != null && elapsed - releaseAt > 800) break;
  }
  assert.equal(stages.size, 4, 'the actual catch, load, lift, apex and downward stroke all run through the split painter');
  assert.ok(heldFrames >= (delta === 16 ? 100 : 30) && groundFrames > 5 && spinFrames > 5 && flightFrames > 5, 'the whole continuous motion includes meaningful held, floor, revolving and airborne boundary frames');
});
