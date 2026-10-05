import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Test the live sole-contact gate and the following painted fall. The only
// fixture adjustment is reflection of the starting layout for the other side.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
assert.ok(source.includes(draw));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'slideFlowScenery(ctx, clock,')
  .replace(draw, `slideFlowActors = actors; ${draw}`);
source += '\nlet slideFlowActors; const slideFlowScenery = () => {}; export const capture = () => slideFlowActors; export { render, createArenaCamera, arenaRounds };';
const result = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, capture } = module.exports;
const noop = () => {};
const context = () => new Proxy({ measureText: value => ({ width: String(value).length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

for (const mirrored of [false, true]) for (const delta of [16, 50]) test(`a live slide contact flows immediately into one fall without freezing the carried ground momentum (${mirrored ? 'mirrored' : 'ordinary'}, ${delta}ms)`, () => {
  const order = ['1', '3', '2', '4', '5'], duration = 44000, seed = 46, planned = arenaRounds(order, duration, 7, seed).find(round => round.slideTrip);
  assert.ok(planned?.slideTrip && !planned.slideTrip.evade);
  const props = { candidates: order.map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  let hit, previousAngle = 0, previousCaster, followFrames = 0, fallSeen = false, kicked = false;
  for (let elapsed = 0; elapsed < planned.resolve + 2000; elapsed += delta) {
    render(ctx, props, elapsed, elapsed, sim, delta, false);
    if (mirrored && elapsed === 0) {
      for (const body of sim.bodies.values()) { body.x = 1000 - body.x; body.facing *= -1; body.vx = 0; body.motorX = 0; body.animation = undefined; }
      for (const contact of sim.contacts.values()) {
        contact.center.x = 1000 - contact.center.x; contact.side *= -1;
        if (contact.round.contactSide) contact.round = { ...contact.round, contactSide: -contact.round.contactSide };
        if (contact.chargerOrigin) contact.chargerOrigin.x = 1000 - contact.chargerOrigin.x;
        if (contact.slideTripOrigins) for (const point of Object.values(contact.slideTripOrigins)) point.x = 1000 - point.x;
      }
    }
    const contact = sim.contacts.get(planned.id), window = contact?.round.slideTrip;
    if (!window || !contact.slideTripOrigins) continue;
    const actors = capture(), caster = actors.get(planned.aggressor), victim = actors.get(planned.victim);
    if (window.hookAt === elapsed) {
      assert.ok(caster.animation.contactPoints.feet.some(foot => distance(foot, contact.slideTripOrigins.standingAnkle) < 8), 'the first hit still needs an actual painted sole on the ankle');
      assert.equal(Math.abs(victim.angle), 0, 'the genuine contact frame is visible before the falling body');
      hit = { at: elapsed, caster: { x: caster.x, y: caster.y } };
    }
    if (hit && elapsed > hit.at && !sim.exits.has(planned.victim)) {
      const age = elapsed - hit.at;
      if (age <= 80) {
        assert.ok(Math.abs(victim.angle) > .01, 'the first follow-up frame loses balance instead of waiting upright after the tackle');
        assert.ok((caster.x - hit.caster.x) * caster.facing > .1, 'the remaining slide travels through contact rather than freezing its root');
        followFrames++;
      }
      assert.ok(Math.abs(victim.angle) >= previousAngle - 1e-8, 'the tackle makes one continuous fall with no upright restart');
      assert.ok(distance(sim.bodies.get(planned.victim), contact.slideTripOrigins.hookVictim) < .001, 'the victim keeps the real struck footprint until the kick');
      assert.ok(Math.hypot((caster.x - 500) / 303, (caster.y - 416) / 112) < 1, 'the residual slide settles inside the sand instead of carrying the attacker out');
      if (previousCaster) assert.ok(distance(caster, previousCaster) <= 240 * delta / 1000 + .01, 'the contact, settle and rise cannot teleport the attacker');
      previousAngle = Math.abs(victim.angle); previousCaster = { x: caster.x, y: caster.y };
      fallSeen ||= victim.pose === 'stunned';
    }
    if (window.kickAt === elapsed) {
      assert.ok(fallSeen && followFrames >= 1, 'the immediate contact, complete fall and grounded rise precede the follow-up kick');
      assert.ok(caster.animation.contactPoints.feet.some(foot => distance(foot, contact.slideTripOrigins.kickTarget) < 8), 'only a real sole contact starts the exit');
      assert.equal(sim.exits.get(planned.victim)?.launchedAt, elapsed);
      assert.ok(!sim.exits.has(planned.aggressor));
      kicked = true; break;
    }
  }
  assert.ok(hit && kicked && fallSeen && followFrames >= 1, 'the real slide, immediate fall and kick all complete');
});
