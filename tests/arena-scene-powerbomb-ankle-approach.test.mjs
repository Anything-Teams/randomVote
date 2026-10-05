import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Keep the production floor, live toe contacts and pickup gate. Only the
// starting layout is mirrored; the test never supplies a grip or a clock.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const initialize = 'const ambient = won ? [] : active.filter';
assert.ok(source.includes(draw) && source.includes(initialize));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'powerAnkleScenery(ctx, clock,')
  .replace(draw, `powerAnkleActors = actors; ${draw}`)
  .replace(initialize, `powerAnkleInitialize(sim, reset); ${initialize}`);
source += '\nlet powerAnkleActors; const powerAnkleScenery = () => {}; let powerAnkleInitialize = () => {}; export const setInitialize = fn => { powerAnkleInitialize = fn; }; export const capture = () => powerAnkleActors; export { render, createArenaCamera, arenaRounds };';
const result = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, capture, setInitialize } = module.exports;
const noop = () => {};
const context = () => new Proxy({ measureText: value => ({ width: String(value).length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
const midpoint = points => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

for (const mirrored of [false, true]) for (const delta of [16, 50]) test(`powerbomb: walk past the toes and face back toward the stunned opponent before lifting (${mirrored ? 'mirrored' : 'ordinary'}, ${delta}ms)`, () => {
  const order = ['2', '1'], duration = 44000, seed = 4, planned = arenaRounds(order, duration, 7, seed)[0];
  assert.equal(planned.wrestlingMove?.kind, 'powerbomb');
  const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  setInitialize((current, reset) => {
    if (current !== sim || !reset) return;
    Object.assign(sim.bodies.get(planned.aggressor), { x: 525, y: 416 });
    Object.assign(sim.bodies.get(planned.victim), { x: 300, y: 416 });
    for (const body of sim.bodies.values()) {
      if (mirrored) { body.x = 1000 - body.x; body.facing *= -1; }
      body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined;
    }
  });
  let floor, approachStart, previous, approachFrames = 0, pickupSeen = false, released = false;
  for (let elapsed = 0; elapsed < 20000; elapsed += delta) {
    render(ctx, props, elapsed, elapsed, sim, delta, false);
    const actors = capture(), caster = actors.get(planned.aggressor), victim = actors.get(planned.victim);
    const actual = sim.contacts.get(planned.id)?.round, window = actual?.wrestlingMove;
    assert.equal(window?.kind, 'powerbomb', 'the incoming run, received slam and toe pickup retain their actual selected technique');
    const rig = caster.animation.contactPoints, victimRig = victim.animation.contactPoints;
    const approaching = caster.ankleApproach !== undefined && caster.pivotTurn === undefined;
    if (approaching) {
      approachFrames++;
      floor ??= { feet: midpoint(victimRig.feet), head: { ...victimRig.head } };
      approachStart ??= { x: caster.x, y: caster.y };
      const outside = Math.sign(floor.feet.x - floor.head.x);
      assert.equal(caster.facing, -outside, 'the receiver faces inward from the toe side, never toward the toes from over the torso');
      assert.ok(distance(midpoint(victimRig.feet), floor.feet) < .01 && distance(victimRig.head, floor.head) < .01, 'the unconscious body stays planted while the caster walks to its toes');
      assert.ok((caster.x - approachStart.x) * outside >= -.01, 'the approach moves farther past the toes instead of back over the opponent');
      if (previous?.approaching) assert.ok(distance(caster, previous.root) < 2 + delta * .17, 'the approach reaches the outside position through continuous actual steps');
    }
    if (!pickupSeen && window.ankleGripAt != null) {
      assert.ok(floor && approachFrames >= (delta === 16 ? 8 : 3), 'the real outside approach is visible before the four-contact pickup');
      const outside = Math.sign(floor.feet.x - floor.head.x);
      assert.ok((caster.x - floor.feet.x) * outside > 10, 'the feet are held from a root beyond the toe endpoints, not from the torso side');
      assert.ok((caster.x - approachStart.x) * outside > 10, 'the caster takes a visible step farther along the toe side before lifting');
      assert.equal(caster.facing, -outside, 'the genuine two-toe hold faces back toward the floored opponent');
      assert.equal(caster.ankleGripReversed, true, 'approaching from the opposite end exchanges ankle ownership so the two supporting arms cannot cross');
      rig.hands.forEach((palm, arm) => assert.ok(distance(palm, victimRig.feet[caster.ankleGripReversed ? 1 - arm : arm]) < 8, 'both normal hands actually close on the two live toes'));
      pickupSeen = true;
    }
    previous = { approaching, root: { x: caster.x, y: caster.y } };
    const exit = sim.exits.get(planned.victim);
    if (exit) {
      assert.ok(pickupSeen && exit.spinFlight && Math.abs(caster.pivotTurn) >= Math.PI * 2, 'the toe-side grip still performs its complete revolution and immediate throw');
      const outward = Math.sign(exit.spinFlight.velocity.x), rim = 303 * Math.sqrt(Math.max(0, 1 - ((exit.landing.y - 416) / 112) ** 2));
      assert.ok((exit.landing.x - 500) * outward - rim >= 180, 'the correction retains the long, fully outside spin throw');
      assert.ok(!sim.exits.has(planned.aggressor), 'only the stunned opponent is eliminated');
      released = true; break;
    }
  }
  assert.ok(pickupSeen && released, 'the floor, outside toe-side approach, actual grip and complete release all occur');
});
