import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
assert.ok(source.includes(draw));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'lowerBodyScenery(ctx, clock,').replace(draw, `lowerBodyActors = actors; ${draw}`);
source += '\nlet lowerBodyActors; const lowerBodyScenery = () => {}; export const capturedActors = () => lowerBodyActors; export { render, createArenaCamera, arenaRounds, arenaPairRushTargets };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaPairRushTargets, capturedActors } = module.exports;
const noop = () => {};
const context = () => new Proxy({ measureText: value => ({ width: String(value).length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('both joint carriers retain visible complete knees and trouser cuffs throughout the real loaded lift and release', () => {
  for (const reversed of [false, true]) for (const delta of [16, 50]) {
    const order = ['1', '2', '3', '4', '5'], duration = 44000;
    const planned = arenaRounds(order, duration, 7, 1).find(round => round.rushOutcome === 'counter-throw');
    assert.ok(planned, 'the natural fixture selects the actual shared throw');
    const props = { candidates: order.map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: 1, paused: false, preview: false };
    const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
    let loadedFrames = 0, releasedFrames = 0, swapped = false;
    for (let elapsed = 0; elapsed < duration; elapsed += delta) {
      render(ctx, props, elapsed, elapsed, sim, delta, false);
      if (reversed && !swapped && elapsed >= planned.start - 2400) {
        const first = sim.bodies.get(planned.aggressor), second = sim.bodies.get(planned.helper), old = { x: first.x, y: first.y };
        Object.assign(first, { x: second.x, y: second.y }); Object.assign(second, old);
        for (const body of [first, second]) { body.vx = body.vy = body.motorX = body.motorY = 0; body.animation = body.roam = undefined; body.restUntil = planned.start; }
        sim.minis.clear(); for (const id of sim.contacts.keys()) if (id.startsWith('mini-')) sim.contacts.delete(id);
        swapped = true;
      }
      const contact = sim.contacts.get(planned.id);
      if (!contact || elapsed < planned.start) continue;
      const frame = arenaPairRushTargets(contact.round, elapsed, contact.center, contact.chargerOrigin, contact.pairCarryOrigins);
      for (const id of [planned.aggressor, planned.helper]) {
        const actor = capturedActors().get(id);
        if (!actor || !(actor.pose === 'pairlift' && frame.pairLoad > .5 || actor.carrierRelease?.stance)) continue;
        const skeleton = actor.animation.skeleton, detail = `${reversed}/${delta}ms/${elapsed}/${frame.stage}/${id}`;
        for (let leg = 0; leg < 2; leg++) {
          const origin = skeleton.hips[leg], knee = skeleton.knees[leg], foot = skeleton.feet[leg];
          const thigh = distance(origin, knee), calf = distance(knee, foot);
          assert.ok(thigh > 9.5 && calf > 9.5 && thigh <= 11.001 && calf <= 11.001, `a supported crouch retains complete visible thigh and calf bones: ${detail}/${leg}/${thigh}/${calf}`);
          const direction = { x: (knee.x - origin.x) / thigh, y: (knee.y - origin.y) / thigh };
          const cuff = Math.max(...skeleton.shorts[leg].map(point => (point.x - origin.x) * direction.x + (point.y - origin.y) * direction.y));
          assert.ok(cuff <= thigh - 1.19, `the actual painted trouser cuff cannot cover or pass through the knee: ${detail}/${leg}`);
        }
        if (actor.carrierRelease) releasedFrames++; else loadedFrames++;
      }
      if (frame.stage === 'release' && elapsed >= contact.round.impact + 600) break;
    }
    assert.ok(loadedFrames > 8 && releasedFrames > 8, `the fixture exercises load, lift, heave and real follow-through: ${reversed}/${delta}/${loadedFrames}/${releasedFrames}`);
  }
});
