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
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'powerDepthScenery(ctx, clock,')
  .replace(draw, `powerDepthActors = actors; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.captureStart(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); });`)
  .replace(initialize, `powerDepthInitialize(sim, reset); ${initialize}`);
source = source.replace('if (actor.scoopSupportActor) drawArenaCradleSupport(ctx, actor.scoopSupportActor);', 'if (actor.scoopSupportActor) { ctx.supportStart(actor.scoopSupportActor); drawArenaCradleSupport(ctx, actor.scoopSupportActor); ctx.supportEnd(actor.scoopSupportActor); }');
source += '\nlet powerDepthActors; const powerDepthScenery = () => {}; let powerDepthInitialize = () => {}; export const setInitialize = fn => { powerDepthInitialize = fn; }; export const capture = () => powerDepthActors; export { render, createArenaCamera, arenaRounds };';
const result = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, capture, setInitialize } = module.exports;
const noop = () => {};
function context() {
  let support; const target = {
    paints: [], supports: [], measureText: value => ({ width: String(value).length * 8 }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    captureStart(actor) { this.paints.push(actor.candidate.id); },
    supportStart(actor) { support = { id: actor.candidate.id, after: this.paints.at(-1), rects: 0, before: structuredClone(actor.animation) }; },
    fillRect() { if (support) support.rects++; },
    supportEnd(actor) { assert.deepEqual(actor.animation, support.before, 'painting the foreground forearm cannot reevaluate or advance the live motion'); this.supports.push(support); support = undefined; },
  };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}

const midpoint = points => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const contactSide = contact => contact.round.contactSide;


for (const controlled of [false, true]) for (const mirrored of [false, true]) for (const delta of [16, 50]) test(`powerbomb: continuous waist support wraps the near forearm above the raised body without exchanging the whole pair's layers (${controlled ? 'controlled' : 'natural'}, ${mirrored ? 'mirrored' : 'ordinary'}, ${delta}ms)`, () => {
  const order = ['2', '1'], duration = 44000, seed = 4, planned = arenaRounds(order, duration, 7, seed)[0];
  assert.equal(planned.wrestlingMove?.kind, 'powerbomb');
  const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  setInitialize((current, reset) => {
    if (current !== sim || !reset) return;
    if (controlled) { Object.assign(sim.bodies.get(planned.aggressor), { x: 525, y: 416 }); Object.assign(sim.bodies.get(planned.victim), { x: 300, y: 416 }); }
    if (mirrored) for (const body of sim.bodies.values()) { body.x = 1000 - body.x; body.facing *= -1; body.animation = undefined; }
  });
  let frames = 0, releaseSeen = false; const stages = new Set();
  for (let elapsed = 0; elapsed < 20000; elapsed += delta) {
    ctx.paints = []; ctx.supports = [];
    render(ctx, props, elapsed, elapsed, sim, delta, false);
    const caster = capture().get(planned.aggressor), victim = capture().get(planned.victim), window = sim.contacts.get(planned.id)?.round.wrestlingMove;
    assert.equal(window?.kind, 'powerbomb', 'the meaningful received body and actual ankle finish keep their selected technique');
    if (window.contactAt != null && caster.pose === 'powerbomb' && caster.gripMode === 'waist' && caster.gripStrength > .001) {
      const detail = `${controlled}/${mirrored}/${delta}/${elapsed}`;
      assert.ok(ctx.paints.indexOf(planned.aggressor) < ctx.paints.indexOf(planned.victim), `the far support and caster stay behind their own carried opponent through the full load/lift/apex/descent: ${detail}`);
      assert.equal(caster.paintDepth, victim.paintDepth, 'the received pair shares only a paint plane');
      assert.equal(victim.paintDepth, victim.depthY, 'the compositing plane belongs to the actual carried opponent');
      assert.equal(caster.depthY, sim.bodies.get(planned.aggressor).y, 'compositing cannot change the caster floor, body root or shadow depth');
      assert.equal(victim.depthY, sim.bodies.get(planned.victim).y, 'the airborne body retains its actual ground depth');
      assert.equal(ctx.supports.length, 1, `only the wrapping forearm is repainted, once: ${detail}`);
      assert.equal(ctx.supports[0].id, planned.aggressor); assert.equal(ctx.supports[0].after, planned.victim);
      assert.ok(ctx.supports[0].rects >= 8, 'the actual foreground pass paints its connected elbow, forearm and palm');
      const rig = caster.animation.contactPoints, forearm = caster.animation.cradleForearm;
      const project = point => {
        const c = Math.cos(forearm.lean), s = Math.sin(forearm.lean), x = forearm.hip.x + c * point.x - s * point.y, y = forearm.hip.y + s * point.x + c * point.y, m = forearm.matrix;
        return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
      };
      assert.ok(distance(project(forearm.elbow), rig.elbows[1]) < .001 && distance(project(forearm.hand), rig.hands[1]) < .001, 'the foreground pixels use the same moving elbow and palm as the body, without stale support or a detached forearm');
      for (let arm = 0; arm < 2; arm++) {
        assert.ok(Math.abs(distance(rig.shoulders[arm], rig.elbows[arm]) - caster.scale * 11) < .001);
        assert.ok(Math.abs(distance(rig.elbows[arm], rig.hands[arm]) - caster.scale * 10.5) < .001);
      }
      if (caster.gripStrength > .995 && elapsed > window.contactAt) {
        const body = victim.animation.contactPoints;
        const targets = [body.waist, { x: body.waist.x + contactSide(sim.contacts.get(planned.id)) * 6, y: body.waist.y + 3 }];
        rig.hands.forEach((hand, arm) => assert.ok(distance(hand, targets[arm]) < 8, `the two live waist palms keep their real contact while painting their correct side: ${detail}/${arm}`));
      }
      if (caster.powerbombLoad > .2 && caster.powerbombLift < .01) stages.add('load'); if (caster.powerbombLift > .2) stages.add('lift'); if (caster.powerbombLift > .99 && caster.powerbombDown < .001) stages.add('apex'); if (caster.powerbombDown > .2) stages.add('down');
      frames++;
    } else assert.equal(ctx.supports.length, 0, 'unheld/released/other actions never paint a floating waist support hand');
    if (sim.exits.has(planned.victim)) { releaseSeen = true; break; }
  }
  assert.ok(releaseSeen && frames >= (delta === 16 ? 100 : 30) && stages.size === 4, 'the continuous real incoming catch, load, lift, apex, descent and full revolution finish are exercised');
});
