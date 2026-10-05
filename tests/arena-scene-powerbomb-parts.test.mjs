import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Exercise the actual incoming catch, existing overhead slam and complete
// ankle finish. Capture paint passes without changing roots or contact clocks.
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
source += '\nlet powerPartsActors; const powerPartsScenery = () => {}; let powerPartsInitialize = () => {}; export const setInitialize = fn => { powerPartsInitialize = fn; }; export const capture = () => powerPartsActors; export { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets };';
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
const { render, createArenaCamera, arenaRounds, arenaWrestlingMoveTargets, capture, setInitialize } = module.exports;
const noop = () => {};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const samePoint = (a, b) => distance(a, b) < 1e-8;
const world = (matrix, point) => ({ x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] });


function context() {
  let pass;
  const target = {
    events: [], rears: [], bodies: [], supports: [],
    measureText: value => ({ width: String(value).length * 8 }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    begin(kind, actor) {
      assert.equal(pass, undefined, 'paint passes cannot recursively advance the live body');
      pass = { kind, id: actor.candidate.id, transforms: [], legs: [], polygons: [], segments: [], rects: [], before: structuredClone(actor.animation) };
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
    fillRect(x, y, width, height) { if (pass) pass.rects.push({ x, y, width, height, color: this.fillStyle }); },
    observeRearPrediction(value) { if (pass) pass.prediction = structuredClone(value); },
    observeLeg(value) { if (pass) pass.legs.push(structuredClone(value)); },
    observePolygon(points) { if (pass) pass.polygons.push(structuredClone(points)); },
    observeSegment(value) { if (pass) pass.segments.push(structuredClone(value)); },
    reset() { this.events = []; this.rears = []; this.bodies = []; this.supports = []; },
  };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}

for (const controlled of [false, true]) for (const mirrored of [false, true]) for (const delta of [16, 50]) test(`powerbomb: the existing overhead slam paints one complete body before the live ankle finish (${controlled ? 'controlled' : 'natural'}, ${mirrored ? 'mirrored' : 'ordinary'}, ${delta}ms)`, () => {
  const order = ['2', '1'], duration = 44000, seed = 4, planned = arenaRounds(order, duration, 7, seed)[0];
  assert.equal(planned.wrestlingMove?.kind, 'powerbomb');
  const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  setInitialize((current, reset) => {
    if (current !== sim || !reset) return;
    if (controlled) { Object.assign(sim.bodies.get(planned.aggressor), { x: 525, y: 416 }); Object.assign(sim.bodies.get(planned.victim), { x: 300, y: 416 }); }
    if (mirrored) for (const body of sim.bodies.values()) { body.x = 1000 - body.x; body.facing *= -1; body.animation = undefined; }
  });
  let overheadFrames = 0, groundFrames = 0, spinFrames = 0, flightFrames = 0, releaseAt, impactSeen = false, maxHeight = 0;
  const stages = new Set();
  for (let elapsed = 0; elapsed < 20000; elapsed += delta) {
    ctx.reset(); render(ctx, props, elapsed, elapsed, sim, delta, false);
    const caster = capture().get(planned.aggressor), victim = capture().get(planned.victim), contact = sim.contacts.get(planned.id), window = contact?.round.wrestlingMove;
    assert.equal(window?.kind, 'powerbomb', 'the real incoming catch remains the selected front slam');
    if (!contact.wrestlingMoveOrigins) continue;
    const frame = arenaWrestlingMoveTargets(window, elapsed, contact.center, contact.wrestlingMoveOrigins, contact.round.contactSide);
    if (window.contactAt != null && !sim.exits.has(planned.victim)) {
      const detail = `${controlled}/${mirrored}/${delta}/${elapsed}`;
      assert.equal(ctx.rears.length, 0, `the overhead slam has no separate seated far leg: ${detail}`);
      assert.equal(ctx.supports.length, 0, `the ordinary overhead arms remain in their one live body pass: ${detail}`);
      assert.equal(victim.powerbombSplit, undefined); assert.equal(victim.powerbombVictim, undefined);
      assert.equal(victim.animation.powerbombRearLeg, undefined);
      for (const actor of [caster, victim]) {
        const passes = ctx.bodies.filter(part => part.id === actor.candidate.id);
        assert.equal(passes.length, 1, `each complete fighter is evaluated and painted once: ${detail}/${actor.candidate.id}`);
        const pass = passes[0], width = 18 + actor.index % 3;
        assert.equal(pass.transforms.length, 1, 'one transform carries the torso, both thighs and both feet');
        assert.equal(pass.rects.filter(rect => rect.x === -width / 2 && rect.y === -23 && rect.width === width && rect.height === 23).length, 1, 'there is one complete torso rather than duplicate depth fragments');
        const skeleton = actor.animation.skeleton, rig = actor.animation.contactPoints;
        for (let leg = 0; leg < 2; leg++) {
          const painted = pass.legs.filter(part => !part.lowerOnly && samePoint(part.hip, skeleton.hips[leg]) && samePoint(part.knee, skeleton.knees[leg]) && samePoint(part.foot, skeleton.feet[leg]));
          assert.equal(painted.length, 1, `both complete thigh/shin/sole chains stay in the same body: ${detail}/${leg}`);
          assert.ok(samePoint(world(pass.transforms[0], painted[0].foot), rig.feet[leg]), 'the painted sole is the live anatomical contact, never a cached rear foot');
          assert.ok(pass.polygons.some(points => JSON.stringify(points) === JSON.stringify(skeleton.shorts[leg])), 'each shorts cuff remains connected to its own actual thigh');
        }
      }
      if (caster.pose === 'overhead' && frame.victimPhase >= .34) {
        assert.equal(victim.pose, 'airborne', 'the normal suplex airborne skeleton replaces the seated carried body');
        assert.equal(victim.carryStretch, undefined); assert.equal(victim.carrySupport, undefined);
        assert.deepEqual(victim.slamProgress, frame.victimSlam, 'the raised and falling body uses the same tuck/slump motion as the existing slam');
        maxHeight = Math.max(maxHeight, victim.depthY - victim.y); overheadFrames++;
      }
      if (elapsed < frame.floorAt) {
        assert.equal(victim.eyesClosed, false, 'the caught and lifted runner stays conscious until actual sand impact');
        stages.add(frame.stage);
      } else if (!victim.spinSuspension) {
        assert.equal(victim.eyesClosed, true, 'the first ground impact closes the eyes rather than waiting for the recovery');
        const eyes = ctx.bodies.find(part => part.id === planned.victim).rects.filter(rect => rect.color === '#172b37' && rect.width === 1.8 && rect.y === -1);
        assert.equal(eyes.length, 2); assert.ok(eyes.every(eye => eye.height === .7), 'the real impact pixels paint both unconscious eyes');
        impactSeen = true;
        if (victim.pose === 'stunned') groundFrames++;
      }
      if (victim.spinSuspension) spinFrames++;
    }
    const exit = sim.exits.get(planned.victim);
    if (exit?.spinFlight) { releaseAt ??= exit.launchedAt; flightFrames++; }
    if (releaseAt != null && elapsed - releaseAt > 800) break;
  }
  assert.ok(stages.has('contact') && stages.has('lift') && stages.has('turn') && stages.has('fall'), 'the live contact, full overhead lift, raised hold and accelerating slam all occur');
  assert.ok(maxHeight >= 99.9 && maxHeight <= 100.001, 'the actual body rises the existing 100px above its sand depth');
  assert.ok(overheadFrames >= (delta === 16 ? 70 : 20) && groundFrames > 5 && spinFrames > 5 && flightFrames > 5 && impactSeen, 'the complete motion includes meaningful lift, impact, floor, full revolution and free flight frames');
});
