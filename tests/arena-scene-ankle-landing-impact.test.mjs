import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Run actual received/flying clothesline strikes through toe pickup, release,
// unchanged ballistic flight, visible outside impact, recovery and drawn ranks.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const rankRead = 'const ranks = props.preview ? {} : resolvedRanks(order, rounds, elapsed);';
const init = 'const ambient = won ? [] : active.filter';
const effects = 'effects.forEach(draw => draw());';
assert.ok(source.includes(draw) && source.includes(rankRead) && source.includes(init) && source.includes(effects));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'impactTestScenery(ctx, clock,')
  .replace(draw, `impactTestActors = actors; impactTestShake = collisionShake; ${draw}`)
  .replace(rankRead, `${rankRead} impactTestRanks = ranks;`)
  .replace(init, `impactTestInitialize(sim, reset); ${init}`)
  .replace(effects, 'ctx.beginEffects(); effects.forEach(draw => draw()); ctx.endEffects();')
  .replaceAll('paintArenaFighter(ctx, actor, clock);', 'ctx.bodyStart(actor); paintArenaFighter(ctx, actor, clock); ctx.bodyEnd(actor);');
source += '\nlet impactTestActors, impactTestRanks, impactTestShake; const impactTestScenery = () => {}; let impactTestInitialize = () => {}; export const setInitialize = fn => { impactTestInitialize = fn; }; export const capture = () => ({ actors: impactTestActors, ranks: impactTestRanks, shake: impactTestShake }); export { render, createArenaCamera, arenaRounds };';
const bundle = await build({
  stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' },
  plugins: [{ name: 'capture-ankle-impact-pixels', setup(builder) {
    builder.onLoad({ filter: /\/game\/ArenaFighter\.ts$/ }, async args => {
      const fighter = (await readFile(args.path, 'utf8'))
        .replace('function paintLeg(ctx: CanvasRenderingContext2D, hip: Point, joint: Point, ankle: Point, footAngle: number, palette: Palette, lowerOnly = false) {', 'function paintLeg(ctx: CanvasRenderingContext2D, hip: Point, joint: Point, ankle: Point, footAngle: number, palette: Palette, lowerOnly = false) { ctx.observeLeg?.({ hip, knee: joint, foot: ankle, lowerOnly });')
        .replace('function paintPolygon(ctx: CanvasRenderingContext2D, points: Point[], color: string) {', 'function paintPolygon(ctx: CanvasRenderingContext2D, points: Point[], color: string) { ctx.observePolygon?.(points);');
      return { contents: fighter, loader: 'ts' };
    });
  } }],
});
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, setInitialize, capture } = module.exports;
const noop = () => {};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const close = (a, b) => Math.abs(a - b) < 1e-6;
const identity = () => [1, 0, 0, 1, 0, 0];
const multiply = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const project = (matrix, point) => ({ x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] });
const painted = rig => [rig.head, ...rig.headSides, rig.back, rig.waist, ...rig.shoulders, ...rig.elbows, ...rig.hands, ...rig.feet];
function context() {
  let matrix = identity(), stack = [], pass, drawingEffects = false;
  const target = {
    globalAlpha: 1, bodies: [], effectRects: [], effectPaths: 0,
    measureText: value => ({ width: String(value).length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    save() { stack.push({ matrix: [...matrix], alpha: this.globalAlpha }); },
    restore() { const saved = stack.pop(); if (saved) { matrix = saved.matrix; this.globalAlpha = saved.alpha; } },
    transform(...next) { matrix = multiply(matrix, next); if (pass) pass.transforms.push(next); },
    translate(x, y) { matrix = multiply(matrix, [1, 0, 0, 1, x, y]); },
    scale(x, y) { matrix = multiply(matrix, [x, 0, 0, y, 0, 0]); },
    rotate(angle) { const c = Math.cos(angle), s = Math.sin(angle); matrix = multiply(matrix, [c, s, -s, c, 0, 0]); },
    setTransform(...next) { matrix = [...next]; },
    getTransform() { return { a: matrix[0], b: matrix[1], c: matrix[2], d: matrix[3], e: matrix[4], f: matrix[5] }; },
    fillRect(x, y, width, height) {
      const rect = { x, y, width, height, color: this.fillStyle, alpha: this.globalAlpha, matrix: [...matrix] };
      if (pass) pass.rects.push(rect);
      if (drawingEffects) this.effectRects.push(rect);
    },
    ellipse() { if (drawingEffects) this.effectPaths++; },
    stroke() { if (drawingEffects) this.effectPaths++; },
    fill() { if (drawingEffects) this.effectPaths++; },
    beginEffects() { drawingEffects = true; }, endEffects() { drawingEffects = false; },
    bodyStart(actor) { assert.equal(pass, undefined); pass = { id: actor.candidate.id, sceneMatrix: [...matrix], transforms: [], rects: [], legs: [], polygons: [] }; },
    bodyEnd(actor) { assert.equal(pass?.id, actor.candidate.id); this.bodies.push(pass); pass = undefined; },
    observeLeg(leg) { if (pass) pass.legs.push(structuredClone(leg)); },
    observePolygon(points) { if (pass) pass.polygons.push(structuredClone(points)); },
    reset() { this.bodies = []; this.effectRects = []; this.effectPaths = 0; },
  };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}

// Frozen actual Scene release measurements, taken before adding landing
// impact. The bounce must not shorten the whole revolution or redirect it.
const cases = [
  { kind: 'powerbomb', seed: 4, mirrored: false, delta: 16, release: 5968, duration: 1307.5237318684033, velocity: [320.62572084767805, -.09380762151051873], gravity: 108.0595193297106, origin: [578.9041270962929, 388.3123893158869], lift: 44.56000000000006, landing: [998.1298661520458, 436], resolve: 8868 },
  { kind: 'powerbomb', seed: 4, mirrored: true, delta: 50, release: 6100, duration: 1307.9503506787778, velocity: [-317.64831942320615, 21.796979355987226], gravity: 75.1182039838732, origin: [417.3383646300611, 387.90339505530545], lift: 44.6663991358912, landing: [1.8701338479542073, 436], resolve: 9000 },
  { kind: 'clothesline', seed: 19, mirrored: false, delta: 50, release: 5200, duration: 1442.7158017240158, velocity: [-317.64831942320615, 21.796979355930382], gravity: 59.807424476825716, origin: [460.14638367089134, 386.9771021811088], lift: 44.666399135891254, landing: [1.8701338479542073, 436], resolve: 8100 },
  { kind: 'clothesline', seed: 19, mirrored: true, delta: 16, release: 5088, duration: 1438.7216367605238, velocity: [320.62572084767805, -.09380762151051873], gravity: 90.75487394927558, origin: [536.8387042665516, 386.76730106808384], lift: 44.56000000000006, landing: [998.1298661520458, 436], resolve: 7988 },
];
for (const fixture of cases) test(`the actual ankle swing lands with a visible coherent impact and unchanged result (${fixture.kind}/${fixture.mirrored ? 'mirror' : 'normal'}/${fixture.delta}ms)`, () => {
  const { kind, seed, mirrored, delta } = fixture, order = ['2', '1'];
  const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration: 44000, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
  const planned = arenaRounds(order, 44000, 7, seed)[0]; assert.equal(planned.wrestlingMove?.kind, kind);
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  setInitialize((current, reset) => {
    if (current !== sim || !reset) return;
    Object.assign(sim.bodies.get(planned.aggressor), { x: kind === 'powerbomb' ? 525 : 320, y: 416 });
    Object.assign(sim.bodies.get(planned.victim), { x: kind === 'powerbomb' ? 300 : 520, y: 416 });
    if (mirrored) for (const body of sim.bodies.values()) { body.x = 1000 - body.x; body.facing *= -1; body.animation = undefined; }
  });
  let original, previous, landSeen = false, recoverySeen = false, finished = false, flightFrames = 0, landFrames = 0, maxBounce = 0, maxShake = 0, impactPaintSeen = false, firstLandAt;
  const detail = elapsed => `${kind}/${mirrored}/${delta}/${elapsed}`;
  for (let elapsed = 0; elapsed <= 20000; elapsed += delta) {
    ctx.reset(); render(ctx, props, elapsed, elapsed, sim, delta, false);
    const { actors, ranks, shake } = capture(), exit = sim.exits.get(planned.victim);
    assert.equal(sim.exits.has(planned.aggressor), false, 'the same drawn winner survives the collision effect');
    if (!exit?.spinFlight) continue;
    if (!original) {
      original = structuredClone({ origin: exit.origin, landing: exit.landing, side: exit.side, lift: exit.lift, angle: exit.angle, launchedAt: exit.launchedAt, spinFlight: exit.spinFlight, spinSnapshot: exit.spinSnapshot, resolve: exit.round.resolve, end: exit.round.end });
      assert.equal(exit.launchedAt, fixture.release, 'the live full-turn release keeps its original clock');
      assert.ok(close(exit.spinFlight.duration, fixture.duration) && close(exit.spinFlight.gravity, fixture.gravity));
      assert.ok(close(exit.spinFlight.velocity.x, fixture.velocity[0]) && close(exit.spinFlight.velocity.y, fixture.velocity[1]), 'impact cannot increase or redirect the released mass velocity');
      assert.ok(close(exit.origin.x, fixture.origin[0]) && close(exit.origin.y, fixture.origin[1]) && close(exit.lift, fixture.lift));
      assert.ok(close(exit.landing.x, fixture.landing[0]) && close(exit.landing.y, fixture.landing[1]));
      assert.equal(exit.round.resolve, fixture.resolve); assert.equal(exit.round.end, fixture.resolve);
    }
    assert.deepEqual({ origin: exit.origin, landing: exit.landing, side: exit.side, lift: exit.lift, angle: exit.angle, launchedAt: exit.launchedAt, spinFlight: exit.spinFlight, spinSnapshot: exit.spinSnapshot, resolve: exit.round.resolve, end: exit.round.end }, original, 'drawing the land/recovery cannot mutate the original ballistic exit or elimination clock');
    const age = elapsed - exit.launchedAt, landAge = age - exit.spinFlight.duration, victim = actors.get(planned.victim);
    if (landAge < -120) continue;
    const rig = victim.animation.contactPoints, pass = ctx.bodies.find(body => body.id === planned.victim);
    assert.ok(pass && ctx.bodies.filter(body => body.id === planned.victim).length === 1, 'each landing frame paints exactly one complete victim instead of blanking or duplicating it');
    assert.ok(painted(rig).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
    assert.equal(pass.transforms.length, 1, 'one body transform carries the entire head, trunk, arms and legs');
    const width = 18 + victim.index % 3;
    assert.equal(pass.rects.filter(rect => rect.x === -width / 2 && rect.y === -23 && rect.width === width && rect.height === 23).length, 1, 'the impact retains one complete torso pixel block');
    assert.equal(pass.legs.length, 2, 'both complete legs are painted once at impact');
    for (const leg of pass.legs) {
      assert.equal(leg.lowerOnly, false);
      // The subsequent ordinary walk projects its knees into depth. The
      // airborne body, rebound and recovery retain fully unfolded sections.
      const minimum = landAge >= 560 ? 5.5 : 10.8;
      for (const length of [distance(leg.hip, leg.knee), distance(leg.knee, leg.foot)]) assert.ok(length >= minimum && length <= 11.001, `the recoil retains complete anatomical thigh and shin sections: ${detail(elapsed)}/${victim.pose}/${length.toFixed(6)}`);
    }
    for (const panel of victim.animation.skeleton.shorts) assert.ok(pass.polygons.some(points => points.length === panel.length && points.every((point, index) => distance(point, panel[index]) < 1e-8)), 'each shorts pixel panel follows its own actual thigh rather than detaching at impact');
    for (let arm = 0; arm < 2; arm++) {
      const upper = distance(rig.shoulders[arm], rig.elbows[arm]), lower = distance(rig.elbows[arm], rig.hands[arm]);
      if (landAge < 560) {
        assert.ok(Math.abs(upper - 11 * victim.scale) < .02, `the impact upper arm remains complete: ${detail(elapsed)}/${victim.pose}/${arm}/${upper.toFixed(6)}`);
        assert.ok(Math.abs(lower - 10.5 * victim.scale) < .02, `the impact forearm remains complete: ${detail(elapsed)}/${victim.pose}/${arm}/${lower.toFixed(6)}`);
      } else {
        assert.ok(upper >= 11 * victim.scale * .5 && upper <= 11 * victim.scale + .02 && lower >= 10.5 * victim.scale * .5 && lower <= 10.5 * victim.scale + .02, 'the subsequent ordinary walk keeps connected projected arm sections');
      }
    }
    if (previous && landAge <= 300) painted(rig).forEach((point, index) => assert.ok(distance(point, previous[index]) < 8 + delta * .9, `the whole painted body cannot restart its rotation or snap a joint at floor contact: ${detail(elapsed)}/${index}/${distance(point, previous[index]).toFixed(3)}`));
    previous = structuredClone(painted(rig));
    if (landAge < 0) {
      flightFrames++; assert.equal(victim.pose, 'airborne'); assert.equal(shake, 0, 'impact shake cannot anticipate the actual ground collision');
      const time = age / 1000, released = exit.spinFlight;
      assert.ok(close(victim.x, exit.origin.x + released.velocity.x * time));
      assert.ok(close(victim.y, exit.origin.y - exit.lift + released.velocity.y * time + .5 * released.gravity * time * time), 'the incoming mass follows the exact original parabola up to contact');
      assert.equal(ctx.effectRects.length, 0, 'ground dust and sparks cannot appear while the mass is still flying');
    } else if (landAge < 180) {
      landSeen = true; landFrames++; firstLandAt ??= elapsed;
      assert.equal(victim.pose, 'land'); assert.equal(victim.eyesClosed, true);
      assert.ok(close(victim.phase, landAge / 180), 'the actual floor-contact phase runs from zero through the landing reaction');
      assert.ok(close(victim.x, exit.landing.x) && close(victim.depthY, exit.landing.y), 'the recoil stays at the original left/right outside contact');
      const bounce = victim.depthY - victim.y;
      assert.ok(bounce >= -1e-8 && bounce <= 7.001); maxBounce = Math.max(maxBounce, bounce); maxShake = Math.max(maxShake, Math.abs(shake));
      impactPaintSeen ||= ctx.effectRects.some(rect => rect.alpha > .05) && ctx.effectPaths > 0;
      const screen = painted(rig).map(point => project(pass.sceneMatrix, point));
      assert.ok(screen.every(point => point.x > 8 && point.x < 992 && point.y > 8 && point.y < 612), `the actual impact keeps the whole head, hands and soles within the camera instead of hiding the floor hit at the viewport edge: ${detail(elapsed)}`);
      assert.equal(ranks[planned.victim], undefined, 'the bounce does not move the drawn elimination earlier');
    } else if (landAge < 560) {
      recoverySeen = true; assert.equal(victim.pose, 'recover'); assert.ok(close(victim.x, exit.landing.x) && close(victim.y, exit.landing.y));
      if (landAge > 350) assert.equal(shake, 0, 'the short collision reaction ends before the next ordinary action');
    }
    if (Object.keys(ranks).length === order.length) { assert.deepEqual(ranks, { '1': 2, '2': 1 }); finished = true; break; }
  }
  assert.ok(flightFrames >= (delta === 16 ? 5 : 2) && landFrames >= (delta === 16 ? 10 : 3), 'the actual incoming flight and continuous landing reaction are both exercised');
  assert.ok(landSeen && recoverySeen && finished && firstLandAt !== undefined && maxBounce > 5.5 && maxShake > .5 && impactPaintSeen, JSON.stringify({ landSeen, recoverySeen, finished, firstLandAt, maxBounce, maxShake, impactPaintSeen, ...fixture }));
});
