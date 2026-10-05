import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Exercise the actual Scene and painted rig; only the static scenery is skipped.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
assert.ok(source.includes(draw));
const rankRead = 'const ranks = props.preview ? {} : resolvedRanks(order, rounds, elapsed);';
assert.ok(source.includes(rankRead));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'surpriseTestScenery(ctx, clock,')
  .replace(rankRead, `${rankRead} surpriseTestRanks = ranks;`)
  .replace(draw, 'surpriseTestActors = actors; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.surpriseStart(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); ctx.surpriseEnd(); });');
source += '\nlet surpriseTestActors, surpriseTestRanks; const surpriseTestScenery = () => {}; export const capturedActors = () => surpriseTestActors; export const capturedRanks = () => surpriseTestRanks; export { render, createArenaCamera, arenaRounds, arenaEliminatedIds, arenaTechniqueTargets, arenaPairDodgeTargets, arenaPassingTripTargets }; export { ARENA_CHARGE_SPEED } from "./arenaCharge";';
const initAnchor = 'const ambient = won ? [] : active.filter';
assert.ok(source.includes(initAnchor));
source = source.replace(initAnchor, 'surpriseTestInitialize(sim, props, elapsed, reset); ' + initAnchor);
source += '\nlet surpriseTestInitialize = () => {}; export const setInitialize = fn => { surpriseTestInitialize = fn; };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaEliminatedIds, arenaTechniqueTargets, arenaPairDodgeTargets, arenaPassingTripTargets, ARENA_CHARGE_SPEED, capturedActors, capturedRanks, setInitialize } = module.exports;
const noop = () => {};
const identity = () => [1, 0, 0, 1, 0, 0];
const multiply = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const project = (matrix, point) => ({ x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const order = ['1', '2', '3', '4', '5'];
const soloOrder = ['1', '3', '2', '4', '5'];
const duration = 44000, rushRoll = 7;

function context() {
  let matrix = identity(), stack = [], currentId;
  const records = new Map();
  const target = {
    globalAlpha: 1, measureText: value => ({ width: value.length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    save() { stack.push({ matrix: [...matrix], alpha: target.globalAlpha }); },
    restore() { const saved = stack.pop(); if (saved) { matrix = saved.matrix; target.globalAlpha = saved.alpha; } },
    transform(...next) { matrix = multiply(matrix, next); },
    translate(x, y) { matrix = multiply(matrix, [1, 0, 0, 1, x, y]); },
    scale(x, y) { matrix = multiply(matrix, [x, 0, 0, y, 0, 0]); },
    rotate(angle) { const c = Math.cos(angle), s = Math.sin(angle); matrix = multiply(matrix, [c, s, -s, c, 0, 0]); },
    setTransform(...next) { matrix = [...next]; },
    fillRect(x, y, width, height) {
      if (!currentId || target.globalAlpha <= 0) return;
      records.get(currentId).rectangles.push([{ x, y }, { x: x + width, y }, { x, y: y + height }, { x: x + width, y: y + height }].map(point => project(matrix, point)));
    },
    surpriseStart(actor) { currentId = actor.candidate.id; records.set(currentId, { sceneMatrix: [...matrix], rectangles: [] }); },
    surpriseEnd() { currentId = undefined; }, records,
  };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}
function game(seed, reversed = false, mirrored = false, initialRoots, drawnOrder = order) {
  const props = { candidates: (reversed ? [...order].reverse() : order).map(id => ({ id, name: id, color: '#ffad72' })), order: drawnOrder, duration, arenaRushRoll: rushRoll, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  setInitialize((sim, props, elapsed, reset) => {
    if (initialRoots && reset && elapsed === 0) for (const [id, point] of Object.entries(initialRoots)) Object.assign(sim.bodies.get(id), point, { motorX: 0, motorY: 0, roam: undefined });
  });
  return { sim, ctx, step(elapsed, paused = false) {
    ctx.records.clear();
    render(ctx, { ...props, paused }, elapsed, elapsed, sim, paused ? 0 : 16, false);
    // A reset also paints the seek preview. Set the live starting layout after
    // that one frame so its unrecorded preview passer cannot replace the setup.
    if (initialRoots && elapsed === 0) for (const [id, point] of Object.entries(initialRoots)) Object.assign(sim.bodies.get(id), point, { motorX: 0, motorY: 0, roam: undefined });
    // The rare passer has one deterministic ordinary layout. Reflect its real
    // initialized bodies once to exercise the other physical heading as well.
    if (mirrored && elapsed === 0) {
      for (const body of sim.bodies.values()) {
        body.x = 1000 - body.x; body.facing *= -1; body.vx = 0; body.motorX = 0; body.animation = undefined;
      }
      for (const contact of sim.contacts.values()) {
        contact.center.x = 1000 - contact.center.x; contact.side *= -1;
        if (contact.round.contactSide) contact.round = { ...contact.round, contactSide: -contact.round.contactSide };
        if (contact.chargerOrigin) contact.chargerOrigin.x = 1000 - contact.chargerOrigin.x;
      }
    }
    return capturedActors();
  } };
}
function snapshot(actor, body) {
  return { x: actor.x, y: actor.y, depthY: actor.depthY, height: actor.depthY - actor.y, heldHeight: body.y - actor.animation.contactPoints.origin.y, angle: actor.angle, facing: actor.facing, pose: actor.pose, contacts: structuredClone(actor.animation.contactPoints) };
}
const points = contacts => [contacts.origin, contacts.head, contacts.waist, ...contacts.hands, ...contacts.feet];
const intersectsViewport = values => Math.max(...values.map(point => point.x)) > 0 && Math.min(...values.map(point => point.x)) < 1000 && Math.max(...values.map(point => point.y)) > 0 && Math.min(...values.map(point => point.y)) < 620;

for (const seed of [0, 3]) for (const reversed of [false, true]) test(`the live pair dodge clears both fighters and ${seed === 0 ? 'returns to a duel' : 'eliminates only the rim charger'} (${seed === 0 ? reversed ? 'reversed layout' : 'normal layout' : reversed ? 'ordinary rim heading' : 'mirrored rim heading'})`, () => {
  const planned = arenaRounds(order, duration, rushRoll, seed).find(round => round.pairDodge);
  assert.ok(planned, 'the fixture must select the production surprise');
  // Reversed input positions give the allowed rim escape a real outward
  // runway. Reflect that same initialized layout to verify the other heading.
  const scene = seed === 3 ? game(seed, true, !reversed) : game(seed, reversed), pairIds = [planned.aggressor, planned.pairDodge.partnerId];
  const previous = new Map(), projections = new Map(), crossed = new Set(), peaks = [0, 0], landed = new Set();
  let launched = false, escaped = false, fell = false, resolved = false, actual;
  for (let elapsed = 0; elapsed <= planned.resolve + 1500; elapsed += 16) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(planned.id);
    if (!contact?.pairDodgeOrigins) continue;
    actual = contact.round;
    const frame = arenaPairDodgeTargets(actual.pairDodge, elapsed, contact.center, contact.pairDodgeOrigins, actual.timeScale);
    const charger = actors.get(actual.victim), chargerBody = scene.sim.bodies.get(actual.victim);
    const detail = `${seed}/${reversed}/${elapsed}/${frame.stage}`;
    if (!launched) {
      assert.equal(elapsed, actual.pairDodge.launchAt, `the Scene waits for the real pair grip before launch: ${detail}`);
      assert.ok(frame.jumpHeight.every(height => height === 0), `neither fighter starts suspended in midair: ${detail}`);
      assert.ok(distance(chargerBody, contact.pairDodgeOrigins.charger) < .001, 'the run starts at the actual captured body');
      launched = true;
    }
    for (const [index, id] of pairIds.entries()) {
      const actor = actors.get(id), body = scene.sim.bodies.get(id);
      assert.ok(actor, `both dodgers remain alive and painted: ${detail}/${id}`);
      assert.ok(points(actor.animation.contactPoints).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), `the painted jump rig is finite: ${detail}/${id}`);
      if (elapsed < actual.pairDodge.end) {
        assert.ok(!scene.sim.exits.has(id), `the jump cannot eliminate either member of the pair: ${detail}/${id}`);
        peaks[index] = Math.max(peaks[index], actor.depthY - actor.y);
        const last = previous.get(id);
        if (last) assert.ok(distance(actor, last) < 23, `the 550ms jump cannot teleport its painted root: ${detail}/${id}`);
        const projection = (chargerBody.x - body.x) * frame.chargeDirection.x + (chargerBody.y - body.y) * frame.chargeDirection.y;
        if (projections.get(id) < 0 && projection >= 0) {
          assert.equal(actor.pose, 'airborne', `the runner passes this fighter while the fighter is jumping: ${detail}/${id}`);
          assert.ok(actor.depthY - actor.y > 90, `the pair has readable clearance when its runner passes: ${detail}/${id}`);
          crossed.add(id);
        }
        projections.set(id, projection);
        if (frame.jumpHeight[index] > 1) assert.ok(scene.ctx.records.get(id)?.rectangles.some(intersectsViewport), 'the actual painted jump is visible');
        if (peaks[index] > 100 && frame.jumpHeight[index] === 0) {
          assert.ok(Math.hypot((body.x - 500) / 290, (body.y - 416) / 98) <= 1.000001, 'the sideways landing stays on the sand');
          assert.ok(Math.abs(actor.depthY - actor.y) < .001, 'the jump lands on the floor once');
          landed.add(id);
        }
      }
      previous.set(id, { x: actor.x, y: actor.y });
    }
    if (elapsed < actual.pairDodge.end && elapsed < (frame.outAt ?? Infinity)) {
      const last = previous.get(actual.victim);
      if (last) assert.ok(distance(chargerBody, last) <= ARENA_CHARGE_SPEED * .016 + .001, `the actual runner keeps its bounded natural speed: ${detail}`);
      previous.set(actual.victim, { x: chargerBody.x, y: chargerBody.y });
    }
    if (actual.pairDodge.outcome === 'out' && elapsed >= frame.outAt) {
      const exit = scene.sim.exits.get(actual.victim);
      assert.equal(exit?.round.id, actual.id, 'only this charger gets the dodge fall');
      assert.ok(Math.hypot((frame.charger.x - 500) / 303, (frame.charger.y - 416) / 112) >= .999999, 'the actual heading reaches the real rim before elimination');
      assert.ok(distance({ x: charger.x, y: charger.depthY }, frame.charger) < .001, 'the exit continues the same ground trajectory');
      assert.ok(Math.abs(charger.depthY - charger.y - frame.chargerHeight) < .001, 'the painted fall retains the integrated height');
      fell = true;
    }
    if (actual.pairDodge.outcome === 'escape' && elapsed >= actual.pairDodge.end && elapsed < actual.impact) {
      assert.ok(contact.pairDodgeFinished, 'the escaped runner proceeds to the ordinary duel');
      assert.equal(actual.tactic, 'brace'); assert.equal(actual.rushOutcome, undefined, 'the second duel cannot repeat the three-person rush');
      assert.ok(!scene.sim.exits.has(actual.victim), 'a central dodge cannot invent an immediate elimination');
      escaped = true;
    }
    const ranks = capturedRanks();
    if (elapsed < actual.resolve) assert.equal(ranks[actual.victim], undefined, 'a delayed physical scene cannot reveal its rank early');
    else {
      assert.equal(ranks[actual.victim], order.indexOf(actual.victim) + 1, 'the physical outcome preserves the drawn rank');
      resolved = true;
    }
    if (resolved && elapsed > actual.resolve + 64) break;
  }
  assert.ok(launched && resolved && crossed.size === 2 && landed.size === 2, 'both full jumps and the actual resolution are exercised');
  assert.ok(peaks.every(peak => peak > 179 && peak <= 186.01), `both 550ms jumps have one bounded readable apex: ${peaks}`);
  assert.equal(actual.pairDodge.outcome, seed === 0 ? 'escape' : 'out');
  assert.ok(seed === 0 ? escaped && !fell : fell && !escaped);
});

for (const mirrored of [false, true]) test(`the live rare passer hooks the ankle, keeps both toe grips and releases one continuous flight (${mirrored ? 'rightward' : 'leftward'})`, () => {
  const seed = 97, planned = arenaRounds(soloOrder, duration, rushRoll, seed).find(round => round.passingTrip);
  assert.ok(planned);
  const scene = game(seed, false, mirrored, undefined, soloOrder), stages = new Set();
  let hooked = false, held = false, released = false, landed = false, resolved = false, previous, actual, peak = 0;
  for (let elapsed = 0; elapsed <= planned.resolve + 800; elapsed += 16) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(planned.id);
    if (!contact?.passingTripOrigins || !contact.round.passingTrip) continue;
    actual = contact.round;
    const frame = arenaPassingTripTargets(actual.passingTrip, elapsed, contact.center, contact.passingTripOrigins, actual.contactSide, actual.timeScale);
    const victim = actors.get(actual.victim), opponent = actors.get(actual.aggressor), passer = actors.get(actual.passingTrip.passerId);
    const now = snapshot(victim, scene.sim.bodies.get(actual.victim)), exit = scene.sim.exits.get(actual.victim);
    const detail = `${mirrored}/${elapsed}/${frame.stage}/${frame.overheadRaise}`;
    stages.add(frame.stage);
    assert.ok(points(now.contacts).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), 'the complete actual victim rig stays finite');
    if (elapsed === actual.passingTrip.hookAt) {
      assert.equal(passer.pose, 'trip');
      assert.ok(Math.min(...passer.animation.contactPoints.feet.map(foot => distance(foot, contact.passingTripOrigins.standingAnkle))) < 8, `the real passer touches the standing ankle before the fall: ${detail}`);
      hooked = true;
    }
    if (frame.grip && frame.lift > 1) {
      const feet = now.contacts.feet, hands = opponent.animation.contactPoints.hands;
      feet.forEach((foot, index) => assert.ok(distance(foot, hands[1 - index]) < 4, `both real painted toe grips remain attached throughout the lift: ${detail}/${index}`));
      assert.equal(victim.pose, 'carried');
      held = true;
    }
    if (exit?.round.id === actual.id) {
      if (!released) {
        assert.ok(previous?.pose === 'carried' && previous.height > 149, 'the release follows a real full ankle lift');
        assert.ok(exit.lift >= previous.height && exit.lift - previous.height < .4, 'the flight carries the actual raised height');
        const delta = { x: now.contacts.origin.x - previous.contacts.origin.x, y: now.contacts.origin.y - previous.contacts.origin.y };
        assert.ok(Math.hypot(delta.x, delta.y) < 8, 'the first actual flight frame cannot teleport');
        points(now.contacts).forEach((point, index) => assert.ok(distance(point, { x: points(previous.contacts)[index].x + delta.x, y: points(previous.contacts)[index].y + delta.y }) < .001, 'head, hands and feet preserve the exact held rig at release'));
        released = true;
      }
      const age = elapsed - exit.launchedAt;
      if (age < 880 * actual.timeScale) {
        peak = Math.max(peak, now.height);
        assert.equal(now.pose, 'carried');
        assert.ok(scene.ctx.records.get(actual.victim)?.rectangles.some(intersectsViewport), 'the thrown fighter is painted in the real viewport');
      } else if (age < 1100 * actual.timeScale) {
        assert.equal(now.height, 0, 'the single flight lands without another bounce');
        assert.ok(Math.hypot((exit.landing.x - 500) / 303, (exit.landing.y - 416) / 112) > 1, 'the thrown loser actually lands outside');
        landed = true;
      }
    }
    if (elapsed < actual.resolve) {
      assert.equal(capturedRanks()[actual.victim], undefined, 'the physical throw completes before its rank appears');
      assert.ok(!scene.sim.exits.has(actual.aggressor) && !scene.sim.exits.has(actual.passingTrip.passerId), 'the driver and passing helper survive the throw');
    } else {
      assert.equal(capturedRanks()[actual.victim], 5, 'the ankle throw preserves the drawn last place');
      resolved = true;
    }
    previous = now;
    if (resolved && elapsed > actual.resolve + 64) break;
  }
  assert.deepEqual([...stages], ['approach', 'hook', 'fall', 'ankle-approach', 'grip', 'lift', 'toss', 'release']);
  assert.ok(hooked && held && released && landed && resolved, 'the actual rare surprise exercises every physical phase');
  assert.ok(peak > 180 && peak < 185, `there is one supported bounded flight apex: ${peak}`);
  assert.equal(actual.contactSide, mirrored ? 1 : -1);
});

test('a live rare-passer story without a reachable passer continues the ordinary drawn duel', () => {
  const seed = 97, planned = arenaRounds(soloOrder, duration, rushRoll, seed).find(round => round.passingTrip);
  assert.ok(planned);
  const scene = game(seed, false, false, {
    '4': { x: 350, y: 416 }, '5': { x: 400, y: 416 },
    '1': { x: 700, y: 416 }, '2': { x: 730, y: 416 }, '3': { x: 760, y: 416 },
  }, soloOrder);
  let declined = false, resolved = false;
  for (let elapsed = 0; elapsed <= planned.resolve + 8000; elapsed += 16) {
    scene.step(elapsed);
    const contact = scene.sim.contacts.get(planned.id);
    if (!contact) continue;
    if (contact.passingTripDeclined) {
      assert.equal(contact.round.passingTrip, undefined, 'no invisible passer can cause the fall');
      assert.equal(contact.passingTripOrigins, undefined);
      declined = true;
    }
    if (elapsed >= contact.round.resolve) {
      assert.equal(capturedRanks()[planned.victim], soloOrder.indexOf(planned.victim) + 1, 'fallback preserves the drawn rank');
      resolved = true; break;
    }
  }
  assert.ok(declined && resolved, JSON.stringify({ declined, resolved, planned, contact: scene.sim.contacts.get(planned.id), ranks: capturedRanks(), exits: [...scene.sim.exits.keys()] }));
});

for (const mirrored of [false, true]) test(`the live rare trip counter withstands the push, hooks, kicks and rolls only its opponent out (${mirrored ? 'rightward' : 'leftward'})`, () => {
  const seed = 74, planned = arenaRounds(soloOrder, duration, rushRoll, seed).find(round => round.tripCounter);
  assert.ok(planned, 'the production seed must select the rare counter');
  const scene = game(seed, false, mirrored, undefined, soloOrder);
  let probed = false, hooked = false, kicked = false, rolled = false, landed = false, resolved = false;
  for (let elapsed = 0; elapsed <= planned.resolve + 64; elapsed += 16) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(planned.id);
    if (!contact) continue;
    const actual = contact.round, frame = arenaTechniqueTargets(actual, elapsed, contact.center);
    const driver = actors.get(actual.aggressor), victim = actors.get(actual.victim), exit = scene.sim.exits.get(actual.victim);
    if (frame.stage === 'probe') {
      assert.equal(driver.pose, 'brace', 'the drawn winner braces against the first push');
      assert.equal(victim.pose, 'push', 'the future loser performs the initial push');
      probed = true;
    }
    if (frame.stage === 'hook' && frame.contact > .8) {
      const gap = Math.min(...driver.animation.contactPoints.feet.flatMap(foot => victim.animation.contactPoints.feet.map(ankle => distance(foot, ankle))));
      if (gap < 4) hooked = true;
    }
    if (frame.stage === 'kick' && frame.contact > .6) {
      const gap = Math.min(...driver.animation.contactPoints.feet.map(foot => distance(foot, victim.animation.contactPoints.waist)));
      if (gap < 4) kicked = true;
    }
    if (exit?.round.id === actual.id) {
      assert.ok(kicked, 'the actual painted forward kick precedes the roll');
      if (elapsed < exit.launchedAt + 880 * actual.timeScale) {
        assert.equal(victim.pose, 'roll', 'the same body physically rolls outward');
        rolled = true;
      } else if (elapsed < exit.launchedAt + 1100 * actual.timeScale) {
        assert.ok(Math.hypot((exit.landing.x - 500) / 303, (exit.landing.y - 416) / 112) > 1, 'the actual roll crosses the sand boundary');
        landed = true;
      }
      assert.ok(!scene.sim.exits.has(actual.aggressor), 'the winning counter cannot eliminate its own driver');
      const ground = scene.sim.bodies.get(actual.aggressor);
      assert.ok(Math.hypot((ground.x - 500) / 303, (ground.y - 416) / 112) < 1, 'the standing driver remains inside');
    }
    if (elapsed < actual.resolve) assert.equal(capturedRanks()[actual.victim], undefined);
    else {
      assert.equal(capturedRanks()[actual.victim], soloOrder.indexOf(actual.victim) + 1, 'the rare counter preserves the drawn loser');
      resolved = true;
    }
  }
  assert.ok(probed && hooked && kicked && rolled && landed && resolved, 'the rare counter includes the complete readable causal sequence');
});

test('production surprise schedules remain rare and preserve every drawn elimination', () => {
  const counts = { dodge: 0, allowOut: 0, passer: 0, counter: 0, solo: 0, passerEligible: 0 };
  const expectedEliminations = [...order].reverse().slice(0, -1);
  for (let seed = 0; seed < 10000; seed++) {
    const rounds = arenaRounds(order, duration, rushRoll, seed);
    assert.deepEqual(rounds.flatMap(arenaEliminatedIds), expectedEliminations, `cosmetic surprises cannot change drawn elimination order: ${seed}`);
    assert.equal(rounds.at(-1).aggressor, order[0], 'the drawn winner survives each surprise schedule');
    for (const round of rounds) {
      if (round.pairDodge) { counts.dodge++; if (round.pairDodge.allowOut) counts.allowOut++; }
      if (round.passingTrip) counts.passer++;
      if (round.tripCounter) counts.counter++;
      if (!round.helper && !round.rushOutcome && !round.pairDodge && !round.linkedRush && !round.supermanPunch) {
        if (!round.final) counts.passerEligible++;
        if (!round.passingTrip && !round.slideTrip) counts.solo++;
      }
    }
  }
  assert.ok(Math.abs(counts.dodge / 10000 - .15) < .015, `pair dodges occur near 15% of eligible rushes: ${JSON.stringify(counts)}`);
  assert.ok(Math.abs(counts.allowOut / counts.dodge - 1 / 3) < .04, 'only about a third may attempt a real rim exit');
  assert.ok(Math.abs(counts.counter / counts.solo - .01) < .003, 'solo trip counters remain near one percent');
  assert.ok(Math.abs(counts.passer / counts.passerEligible - .001) < .0008, 'passing assistance remains a very rare one-in-a-thousand story');
});
