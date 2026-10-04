import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Run the real Scene and fighter renderer. Only initial field placement and
// static stadium painting are replaced; no contact, clock or exit is supplied.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const initialize = 'const ambient = won ? [] : active.filter';
assert.ok(source.includes(draw) && source.includes(initialize));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'pairPushTestScenery(ctx, clock,')
  .replace(initialize, 'pairPushTestInitialize(sim, props, elapsed, reset); ' + initialize)
  .replace(draw, 'pairPushTestActors = actors; ' + draw);
source += '\nlet pairPushTestActors; const pairPushTestScenery = () => {}; let pairPushTestInitialize = () => {}; export const setInitialize = fn => { pairPushTestInitialize = fn; }; export const capturedActors = () => pairPushTestActors; export { render, createArenaCamera, arenaRounds, arenaPairRushTargets, resolvedRanks };';
const bundled = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundled.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaPairRushTargets, resolvedRanks, capturedActors, setInitialize } = module.exports;
const noop = () => {};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ground = actor => ({ x: actor.x, y: actor.depthY ?? actor.y });
const ellipse = point => Math.hypot((point.x - 500) / 303, (point.y - 416) / 112);
const along = (a, b, direction) => (a.x - b.x) * direction.x + (a.y - b.y) * direction.y;
const across = (a, b, direction) => (a.x - b.x) * direction.y - (a.y - b.y) * direction.x;
const painted = rig => [rig.origin, rig.head, rig.waist, ...rig.shoulders, ...rig.elbows, ...rig.hands, ...rig.feet];
const context = () => new Proxy({ globalAlpha: 1, measureText: value => ({ width: value.length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
const order = ['2', '1', '3'], duration = 44000, rushRoll = 0, seed = 1;
const planned = arenaRounds(order, duration, rushRoll, seed)[0];
assert.equal(planned.rushOutcome, 'double-out');
assert.equal(planned.start, 0, 'the natural three-person draw starts with the collision instead of bypassing earlier rounds');

function game(offset, side, delta) {
  const props = { candidates: ['1', '2', '3'].map(id => ({ id, name: `선수${id}`, color: '#ffad72' })), order, duration, arenaRushRoll: rushRoll, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() };
  const ctx = context();
  let placements = 0;
  setInitialize((current, _props, elapsed, reset) => {
    if (current !== sim || !reset) return;
    assert.equal(elapsed, 0, 'all controlled geometry is supplied before the first actual frame');
    assert.equal(placements++, 0, 'no collision or post-contact body can be overridden');
    const positions = { [planned.aggressor]: { x: 500 + offset.x, y: 416 + offset.y }, [planned.victim]: { x: 500 + side * 22, y: 430 }, [planned.helper]: { x: 500 - side * 22, y: 402 } };
    for (const [id, point] of Object.entries(positions)) {
      assert.ok(ellipse(point) < 1);
      Object.assign(sim.bodies.get(id), point, { vx: 0, vy: 0, motorX: 0, motorY: 0, facing: id === planned.victim ? -side : side, animation: undefined, roam: undefined });
    }
  });
  return { sim, step(elapsed) { render(ctx, props, elapsed, elapsed, sim, delta, false); return capturedActors(); } };
}

const directions = [
  ['left', { x: -190, y: 0 }], ['right', { x: 190, y: 0 }],
  ['above', { x: 0, y: -82 }], ['below', { x: 0, y: 82 }],
  ['upper-left', { x: -150, y: -65 }], ['upper-right', { x: 150, y: -65 }],
  ['lower-left', { x: -150, y: 65 }], ['lower-right', { x: 150, y: 65 }],
];
for (const [name, offset] of directions) for (const side of [-1, 1]) test(`the live pair push and exit follow the actual ${name} entry (${side < 0 ? 'reversed' : 'ordinary'} pair)`, () => {
  for (const delta of [16, 50]) {
    const scene = game(offset, side, delta), ids = [planned.victim, planned.helper], stages = new Set();
    let contacted = false, released = false, landed = false, resolved = false, previous, collisionRoots, incoming, lastPainted;
    const exitStarts = new Map(), exitPrevious = new Map();
    for (let elapsed = 0; elapsed <= 16000; elapsed += delta) {
      const actors = scene.step(elapsed), contact = scene.sim.contacts.get(planned.id);
      if (!contact?.chargerOrigin || contact.round.rushLaunchAt == null) continue;
      const actual = contact.round, frame = arenaPairRushTargets(actual, elapsed, contact.center, contact.chargerOrigin, contact.pairCarryOrigins);
      stages.add(frame.stage);
      const detail = `${name}/${side}/${delta}ms/${elapsed}/${frame.stage}`;
      assert.equal(scene.sim.exits.has(planned.aggressor), false, `the pushing survivor never eliminates himself: ${detail}`);
      const charger = actors.get(planned.aggressor);
      assert.ok(charger?.animation?.contactPoints, `the actual final three-person charger remains painted: ${detail}`);
      assert.ok(ellipse(ground(charger)) < 1, `the charger stays on the sand: ${detail}`);
      for (const actor of actors.values()) assert.ok(painted(actor.animation.contactPoints).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), `the full rendered skeleton remains finite: ${detail}`);
      if (elapsed < frame.contactAt) {
        assert.equal(scene.sim.exits.size, 0, `an approaching shoulder cannot decide the pair before collision: ${detail}`);
        continue;
      }
      incoming ??= { ...frame.chargeDirection };
      assert.deepEqual(frame.chargeDirection, incoming, `the recorded incoming line cannot switch with the static pair side: ${detail}`);
      if (!contacted) {
        collisionRoots = new Map([planned.aggressor, ...ids].map(id => [id, ground(actors.get(id))]));
        contacted = true;
      }
      const now = new Map([planned.aggressor, ...ids].map(id => [id, ground(actors.get(id))]));
      if (!scene.sim.exits.has(planned.victim)) {
        for (const id of [planned.aggressor, ...ids]) {
          assert.ok(along(now.get(id), collisionRoots.get(id), incoming) >= -.01, `the planted drive never reverses behind its collision root: ${detail}/${id}/${JSON.stringify({ current: now.get(id), atContact: collisionRoots.get(id), incoming, model: id === actual.aggressor ? frame.aggressor : id === actual.victim ? frame.victim : frame.helper, center: contact.center })}`);
          if (previous) {
            assert.ok(along(now.get(id), previous.get(id), incoming) >= -.01, `each actual ground step retains forward momentum: ${detail}/${id}`);
            assert.ok(distance(now.get(id), previous.get(id)) <= 200 * delta / 1000 + .1, `the push cannot teleport a root between contact and release: ${detail}/${id}`);
          }
          assert.ok(Math.abs(across(now.get(id), collisionRoots.get(id), incoming)) < .1, `no planted body cuts toward the unrelated layout rim: ${detail}/${id}/${JSON.stringify({ current: now.get(id), atContact: collisionRoots.get(id), incoming, model: id === actual.aggressor ? frame.aggressor : id === actual.victim ? frame.victim : frame.helper, center: contact.center })}`);
          assert.ok(Math.abs((actors.get(id).depthY ?? actors.get(id).y) - actors.get(id).y) < .001, `the shoulder push does not turn into a phantom shared lift: ${detail}/${id}`);
        }
        assert.ok(ids.every(id => along(now.get(id), now.get(planned.aggressor), incoming) >= -2), `the charger follows behind the pair instead of passing through them: ${detail}`);
        lastPainted = new Map(ids.map(id => [id, structuredClone(actors.get(id).animation.contactPoints)]));
      } else {
        released = true;
        for (const id of ids) {
          const exit = scene.sim.exits.get(id), actor = actors.get(id);
          assert.equal(exit?.round.id, actual.id, `both pushed wrestlers receive the actual round's exit: ${detail}/${id}`);
          assert.ok(ellipse(exit.landing) > 1, `the own-rim exit target is genuinely outside: ${detail}/${id}`);
          assert.ok(along(exit.landing, exit.origin, incoming) > 65, `the flight continues beyond the edge in the incoming direction: ${detail}/${id}`);
          assert.ok(Math.abs(across(exit.landing, exit.origin, incoming)) < .1, `the exit cannot bend toward a different static side: ${detail}/${id}`);
          const age = Math.max(0, elapsed - (exit.launchedAt ?? exit.round.impact) - (id === exit.round.helper ? 70 * actual.timeScale : 0));
          if (!exitStarts.has(id)) {
            exitStarts.set(id, { ...exit.origin });
            const previousRig = lastPainted?.get(id), rig = actor.animation.contactPoints;
            assert.ok(previousRig && distance(previousRig.origin, rig.origin) < 18 * delta / 16, `the first actual flight frame inherits the pushed body continuously: ${detail}/${id}`);
          }
          if (age < 880 * actual.timeScale) {
            assert.ok(along(now.get(id), exitStarts.get(id), incoming) >= -.01);
            assert.ok(Math.abs(across(now.get(id), exitStarts.get(id), incoming)) < .1, `every airborne ground sample stays on its incoming ray: ${detail}/${id}/${JSON.stringify({ ground: now.get(id), origin: exit.origin, landing: exit.landing, incoming, age })}`);
            if (exitPrevious.has(id)) assert.ok(along(now.get(id), exitPrevious.get(id), incoming) >= -.01, `the free flight cannot reverse: ${detail}/${id}`);
            exitPrevious.set(id, now.get(id));
          } else if (age < 1100 * actual.timeScale) {
            assert.ok(distance(now.get(id), exit.landing) < .001, `the outside landing ends on the recorded ray: ${detail}/${id}/${JSON.stringify({ ground: now.get(id), origin: exit.origin, landing: exit.landing, incoming, age })}`); landed = true;
          }
        }
      }
      previous = now;
      if (elapsed >= actual.resolve) {
        assert.deepEqual(resolvedRanks(order, [actual], elapsed), { '1': 2, '2': 1, '3': 3 }, 'the incoming direction changes no drawn elimination place');
        resolved = true; break;
      }
    }
    assert.ok(contacted && released && landed && resolved, `the real charge, planted push, outside flight and ranking complete: ${name}/${side}/${delta}ms/${[...stages]}`);
    assert.ok(stages.has('charge') && stages.has('push') && stages.has('release'));
  }
});
