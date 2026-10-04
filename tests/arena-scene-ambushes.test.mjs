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
source += '\nlet surpriseTestActors, surpriseTestRanks; const surpriseTestScenery = () => {}; export const capturedActors = () => surpriseTestActors; export const capturedRanks = () => surpriseTestRanks; export { render, createArenaCamera, arenaRounds, arenaEliminatedIds, arenaTechniqueTargets, arenaPairDodgeTargets, arenaPassingTripTargets, arenaSlideTripTargets, arenaLinkedRushTargets, arenaPairRushTargets };';
const initAnchor = 'const ambient = won ? [] : active.filter';
assert.ok(source.includes(initAnchor));
source = source.replace(initAnchor, 'ambushTestInitialize(sim, props, elapsed, reset); ' + initAnchor);
source += '\nlet ambushTestInitialize = () => {}; export const setInitialize = fn => { ambushTestInitialize = fn; };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaEliminatedIds, arenaTechniqueTargets, arenaPairDodgeTargets, arenaPassingTripTargets, arenaSlideTripTargets, arenaLinkedRushTargets, arenaPairRushTargets, capturedActors, capturedRanks, setInitialize } = module.exports;
const noop = () => {};
const identity = () => [1, 0, 0, 1, 0, 0];
const multiply = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const project = (matrix, point) => ({ x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const order = ['1', '2', '3', '4', '5'];
const rareOrder = ['1', '3', '2', '4', '5'];
const duration = 44000, rushRoll = 7;

function context() {
  let matrix = identity(), stack = [], currentId;
  const records = new Map();
  const target = {
    globalAlpha: 1, texts: [], fillText(value) { target.texts.push(value); }, measureText: value => ({ width: value.length * 8 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
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
function game(seed, reversed = false, mirrored = false, candidateOrder, initialRoots, suppliedOrder = order, frameDelta = 16) {
  const props = { candidates: (candidateOrder ?? (reversed ? [...order].reverse() : order)).map(id => ({ id, name: id, color: '#ffad72' })), order: suppliedOrder, duration, arenaRushRoll: rushRoll, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  setInitialize((sim, props, elapsed, reset) => {
    if (initialRoots && reset && elapsed === 0) for (const [id, point] of Object.entries(initialRoots)) Object.assign(sim.bodies.get(id), point, { motorX: 0, motorY: 0, roam: undefined });
  });
  return { sim, ctx, step(elapsed, paused = false) {
    ctx.records.clear();
    ctx.texts.length = 0;
    render(ctx, { ...props, paused }, elapsed, elapsed, sim, paused ? 0 : frameDelta, false);
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
        if (contact.slideTripOrigins) {
          for (const point of Object.values(contact.slideTripOrigins)) point.x = 1000 - point.x;
        }
        if (contact.linkedRushOrigins) contact.linkedRushOrigins = undefined;
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

for (const mirrored of [false, true]) for (const delta of [16, 50]) test(`a live feet-first slide hooks the real ankle, stands, and kicks one opponent out (${mirrored ? 'mirrored' : 'ordinary'}, ${delta}ms)`, () => {
  const seed = 46, planned = arenaRounds(rareOrder, duration, rushRoll, seed).find(round => round.slideTrip);
  assert.ok(planned, 'the production independent roll selects the sliding attack');
  const scene = game(seed, false, mirrored, undefined, undefined, rareOrder, delta), stages = new Set();
  let hooked = false, kicked = false, rolled = false, resolved = false, loweredWithRoom = false, previousDriver;
  for (let elapsed = 0; elapsed <= planned.resolve + 1500; elapsed += delta) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(planned.id);
    if (!contact?.slideTripOrigins || !contact.round.slideTrip) continue;
    const actual = contact.round, window = actual.slideTrip;
    const frame = arenaSlideTripTargets(window, elapsed, contact.center, contact.slideTripOrigins, actual.contactSide);
    const driver = actors.get(actual.aggressor), victim = actors.get(actual.victim), body = scene.sim.bodies.get(actual.aggressor);
    const detail = `${mirrored}/${delta}/${elapsed}/${frame.stage}`;
    stages.add(frame.stage);
    assert.ok(points(driver.animation.contactPoints).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), `the actual sliding/rising rig stays finite: ${detail}`);
    if (!scene.sim.exits.has(actual.victim) && previousDriver) assert.ok(distance(body, previousDriver) <= 240 * delta / 1000 + .01, `the slide cannot teleport the actual body: ${detail}`);
    previousDriver = { x: body.x, y: body.y };
    if (frame.stage === 'approach') assert.ok(scene.ctx.texts.includes('돌진!'), `the actual running attack paints its headword: ${detail}`);
    if (!hooked) {
      assert.equal(Math.abs(victim.angle), 0, 'the rival stays standing throughout the uncontacted ground journey');
      assert.ok(!scene.sim.exits.has(actual.victim), 'sliding entry cannot eliminate the rival before toe contact');
    }
    if (!loweredWithRoom && frame.stage === 'slide' && driver.slideProgress >= .8) {
      assert.ok(driver.animation.motion.crouch > 13, 'the actual painted pelvis has lowered into the sliding pose');
      assert.ok(distance(body, contact.slideTripOrigins.standingAnkle) > 80, `the low pose begins while the ankle is still beyond reach: ${detail}`);
      loweredWithRoom = true;
    }
    if (window.hookAt === elapsed) {
      assert.equal(driver.pose, 'slide');
      assert.ok(driver.animation.contactPoints.feet.some(foot => distance(foot, contact.slideTripOrigins.standingAnkle) < 8), `a real leading sole contacts the ankle before the fall: ${detail}`);
      assert.equal(Math.abs(victim.angle), 0, 'the defender is still upright at the first ankle contact');
      assert.ok(loweredWithRoom, 'the actual low slide is visible before hooking the rival');
      assert.ok(distance(body, contact.slideTripOrigins.slideOrigin) > 60, `the seated body actually crosses the sand before ankle contact: ${detail}`);
      assert.ok(elapsed - window.launchAt > 300, 'toe contact follows ground travel instead of the entry pose');
      hooked = true;
    }
    if (hooked && !scene.sim.exits.has(actual.victim)) assert.ok(distance(scene.sim.bodies.get(actual.victim), contact.slideTripOrigins.hookVictim) < .001, 'the victim falls on the same footprint until the kick');
    if (window.kickAt === elapsed) {
      assert.equal(driver.pose, 'trip'); assert.ok((driver.frontKick ?? 0) >= .615, 'a complete forward strike follows the rise');
      assert.ok(driver.animation.contactPoints.feet.some(foot => distance(foot, contact.slideTripOrigins.kickTarget) < 8), 'the real sole reaches the fallen opponent before release');
      assert.ok(elapsed - window.hookAt >= 800, 'the driver has time for one fall and one grounded rise before kicking');
      assert.equal(scene.sim.exits.get(actual.victim)?.launchedAt, elapsed, 'only the actual kick starts the exit');
      kicked = true;
    }
    if (scene.sim.exits.get(actual.victim)?.round.id === actual.id && victim.pose === 'roll') rolled = true;
    assert.ok(!scene.sim.exits.has(actual.aggressor), 'the sliding attacker remains inside');
    if (elapsed >= actual.resolve) {
      assert.equal(capturedRanks()[actual.victim], order.indexOf(actual.victim) + 1, 'the new scene preserves the selected rank');
      resolved = true; break;
    }
  }
  assert.ok(hooked && kicked && rolled && resolved, `the whole contact-triggered sliding scene completes: ${[...stages]}`);
  assert.ok(stages.has('approach') && stages.has('slide') && stages.has('fall') && stages.has('rise') && stages.has('kick'));
});

test('a close opponent uses the ordinary trip instead of backing up to invent a running slide', () => {
  const seed = 46, planned = arenaRounds(rareOrder, duration, rushRoll, seed).find(round => round.slideTrip);
  const scene = game(seed, false, false, undefined, { '4': { x: 480, y: 416 }, '5': { x: 520, y: 416 } }, rareOrder);
  let declined = false, resolved = false;
  for (let elapsed = 0; elapsed <= planned.resolve + 8000; elapsed += 16) {
    scene.step(elapsed);
    const contact = scene.sim.contacts.get(planned.id);
    if (contact && elapsed >= planned.start && !contact.round.slideTrip) {
      assert.equal(contact.slideTripOrigins, undefined, 'no slide roots or manufactured runway are introduced');
      assert.equal(contact.round.tactic, 'trip'); declined = true;
      if (elapsed >= contact.round.resolve) {
        assert.equal(capturedRanks()[planned.victim], order.indexOf(planned.victim) + 1); resolved = true; break;
      }
    }
  }
  assert.ok(declined && resolved, `the nearby ordinary exchange still completes the chosen elimination: ${JSON.stringify({ declined, resolved, planned, actual: scene.sim.contacts.get(planned.id)?.round, ranks: capturedRanks(), exits: [...scene.sim.exits.keys()] })}`);
});

test('a paused initial seek applies the same minimum slide distance as live play', () => {
  const seed = 46, planned = arenaRounds(rareOrder, duration, rushRoll, seed).find(round => round.slideTrip);
  const scene = game(seed, false, false, ['4', '1', '2', '3', '5'], undefined, rareOrder), actors = scene.step(planned.start, true), contact = scene.sim.contacts.get(planned.id);
  assert.ok(distance(scene.sim.bodies.get(planned.aggressor), scene.sim.bodies.get(planned.victim)) < 130);
  assert.equal(contact.round.slideTrip, undefined, 'reset and paused seeks cannot allow a close slide');
  assert.equal(contact.slideTripOrigins, undefined);
  assert.equal(actors.get(planned.aggressor).slideProgress, undefined, 'no sliding rig is painted before the ordinary close exchange');
});

for (const mirrored of [false, true]) test(`a rare live two-foot hop avoids the slide, lands inside and resumes the same deciding bout (${mirrored ? 'mirrored' : 'ordinary'})`, () => {
  const seed = 1566, planned = arenaRounds(rareOrder, duration, rushRoll, seed).find(round => round.slideTrip?.evade);
  assert.ok(planned, 'the production independent rare branch selects a two-foot dodge');
  const scene = game(seed, false, mirrored, undefined, undefined, rareOrder), stages = new Set();
  let jumped = false, passed = false, recovered = false, resolved = false, fallback;
  for (let elapsed = 0; elapsed <= planned.resolve + 4000; elapsed += 16) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(planned.id);
    if (!contact?.slideTripOrigins) continue;
    const actual = contact.round, driver = actors.get(actual.aggressor), victim = actors.get(actual.victim);
    assert.ok(driver && victim, 'both participants stay painted throughout the dodge and deciding bout');
    if (actual.slideTrip) {
      const window = actual.slideTrip, frame = arenaSlideTripTargets(window, elapsed, contact.center, contact.slideTripOrigins, actual.contactSide);
      stages.add(frame.stage);
      assert.ok(frame.canPerform && frame.startingGap >= 130, 'the rare hop starts from an eligible real runway');
      assert.equal(window.hookAt, null); assert.equal(window.kickAt, null);
      assert.equal(Math.abs(victim.angle), 0, 'a successful two-foot dodge never includes a fallen defender');
      assert.ok(!scene.sim.exits.has(actual.victim) && !scene.sim.exits.has(actual.aggressor), 'the missed slide cannot eliminate either participant');
      assert.equal(capturedRanks()[actual.victim], undefined);
      assert.ok(points(victim.animation.contactPoints).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
      if (window.jumpAt === elapsed) jumped = true;
      if (window.passAt === elapsed) {
        const ankle = contact.slideTripOrigins.standingAnkle, feet = victim.animation.contactPoints.feet;
        assert.ok(driver.animation.contactPoints.feet.some(foot => distance(foot, ankle) < 8), 'the sliding sole reaches the former ankle line');
        assert.ok(feet.every(foot => foot.y < ankle.y - 16), 'both actual feet clear the incoming sliding sole');
        assert.ok(feet.every(foot => driver.animation.contactPoints.feet.every(sliding => distance(foot, sliding) > 16)), 'no actual hook contact occurs in the air');
        passed = true;
      }
    } else {
      if (!recovered) {
        assert.ok(jumped && passed, 'the physical hop and cleared feet are recorded before resuming');
        assert.equal(victim.depthY - victim.y, 0); assert.equal(victim.pose, 'guard'); assert.equal(driver.pose, 'guard');
        const point = scene.sim.bodies.get(actual.victim);
        assert.ok(Math.hypot((point.x - 500) / 303, (point.y - 416) / 112) < 1, 'the dodging defender lands inside the sand');
        assert.ok(distance(point, contact.slideTripOrigins.victim) < .001, 'the hop lands on its original footprint');
        assert.ok(!scene.sim.exits.has(actual.victim));
        fallback = actual; recovered = true;
      }
      assert.equal(actual.aggressor, planned.aggressor); assert.equal(actual.victim, planned.victim);
      if (elapsed >= actual.resolve) {
        assert.ok(fallback && scene.sim.exits.has(actual.victim), 'only the following ordinary bout releases the selected loser');
        assert.equal(capturedRanks()[actual.victim], order.indexOf(actual.victim) + 1); resolved = true; break;
      }
    }
  }
  assert.ok(jumped && passed && recovered && resolved, `the full missed slide and unchanged deciding result complete: ${[...stages]}`);
  assert.ok(stages.has('jump') && stages.has('pass') && stages.has('land') && stages.has('recover'));
});

for (const mirrored of [false, true]) test(`two live allies independently clothesline the neck and chest before the exact shared throw (${mirrored ? 'mirrored' : 'ordinary'})`, () => {
  const seed = 865, planned = arenaRounds(rareOrder, duration, rushRoll, seed).find(round => round.linkedRush);
  assert.ok(planned, 'the production extremely rare roll selects the linked attack');
  const scene = game(seed, false, mirrored, undefined, undefined, rareOrder), previous = new Map();
  let extended = false, hit = false, held = false, thrown = false, resolved = false, previousVictim;
  for (let elapsed = 0; elapsed <= planned.resolve + 1500; elapsed += 16) {
    const actors = scene.step(elapsed), contact = scene.sim.contacts.get(planned.id);
    if (!contact?.linkedRushOrigins || !contact.round.linkedRush) continue;
    const actual = contact.round, window = actual.linkedRush, pairIds = [actual.aggressor, actual.helper];
    const victim = actors.get(actual.victim), exit = scene.sim.exits.get(actual.victim);
    const detail = `${mirrored}/${elapsed}`;
    for (const id of pairIds) {
      const actor = actors.get(id), body = scene.sim.bodies.get(id);
      assert.ok(actor && points(actor.animation.contactPoints).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), `both actual allies remain painted: ${detail}/${id}`);
      const last = previous.get(id);
      if (last && elapsed < actual.impact) assert.ok(distance(body, last) <= 165 * .016 + .01, `the linked charge and shared pickup use bounded real steps: ${detail}/${id}`);
      previous.set(id, { x: body.x, y: body.y });
      assert.ok(!scene.sim.exits.has(id), 'neither attacking ally is eliminated');
    }
    if (window.launchAt === elapsed) {
      const pair = pairIds.map(id => actors.get(id));
      const palms = pair.map(actor => actor.animation.contactPoints.hands[actor.clotheslineArm]);
      assert.ok(distance(palms[0], palms[1]) > 12, 'each attacker extends a separate arm rather than holding the other hand');
      assert.ok(pair.every(actor => actor.linkedArm === undefined && actor.linkedHandTarget === undefined), 'the former hand-link rig is unused');
      extended = true;
    }
    if (window.contactAt === elapsed) {
      assert.ok(contact.pairCarryOrigins, 'the hit captures the existing bodies instead of restaging a joint throw');
      assert.ok(distance(contact.pairCarryOrigins.victim, scene.sim.bodies.get(actual.victim)) < .001, 'the shared fall starts at the victim already struck by both separate forearms');
      const pair = pairIds.map(id => actors.get(id)), palms = pair.map(actor => actor.animation.contactPoints.hands[actor.clotheslineArm]);
      const head = victim.animation.contactPoints.head, neck = { x: head.x, y: head.y + victim.scale * 20 };
      assert.ok(distance(palms[0], palms[1]) > 12, 'the separate strikes remain visible on the impact frame');
      const strikes = contact.linkedRushOrigins.strikeTargets.map(point => ({ x: neck.x + point.x - contact.linkedRushOrigins.neck.x, y: neck.y + point.y - contact.linkedRushOrigins.neck.y }));
      pair.forEach((actor, index) => {
        const arm = actor.clotheslineArm, rig = actor.animation.contactPoints, elbow = rig.elbows[arm], hand = rig.hands[arm], point = strikes[index];
        const dx = hand.x - elbow.x, dy = hand.y - elbow.y, length = dx * dx + dy * dy;
        const along = Math.max(0, Math.min(1, ((point.x - elbow.x) * dx + (point.y - elbow.y) * dy) / length));
        assert.ok(distance(point, { x: elbow.x + dx * along, y: elbow.y + dy * along }) < 8, 'each actual forearm independently reaches its neck or upper-chest point');
        assert.ok(Math.abs(distance(rig.shoulders[arm], elbow) - 11 * actor.scale) < .001);
        assert.ok(Math.abs(distance(elbow, hand) - 10.5 * actor.scale) < .001, 'the impact cannot stretch the striking arm');
      });
      assert.ok(actual.impact > window.contactAt && actual.pairPickupAt == null, 'the shared throw reserves its finish until actual four-hand pickup');
      hit = true;
    }
    if (contact.pairCarryOrigins && !exit) {
      const frame = arenaPairRushTargets(actual, elapsed, contact.center, contact.chargerOrigin, contact.pairCarryOrigins);
      if (frame.lift > 1) {
        const contacts = victim.animation.contactPoints;
        assert.equal(victim.carrySupport, 'shoulder');
        for (const [id, endpoints] of [[frame.armsHolderId, contacts.shoulders], [frame.legsHolderId, contacts.feet]]) {
          assert.equal(actors.get(id).gripMode, id === frame.armsHolderId ? 'shoulder' : 'ankle');
          const hands = actors.get(id).animation.contactPoints.hands;
          endpoints.forEach(endpoint => assert.ok(hands.some(hand => distance(hand, endpoint) < 4), `all four actual joint holds stay attached: ${detail}/${id}`));
        }
        held = true;
      }
    }
    if (exit?.round.id === actual.id && !thrown) {
      assert.equal(previousVictim?.pose, 'carried', 'the free flight inherits the last supported body');
      assert.equal(victim.carrySupport, 'shoulder', 'the linked throw keeps the same supported body shape after release');
      assert.ok(exit.lift > 80 && exit.lift <= 84, 'the throw starts at the supported heave height');
      assert.ok(distance(previousVictim.contacts.origin, { x: exit.origin.x, y: exit.origin.y - exit.lift }) < .01, 'releasing the shared body cannot teleport it');
      const now = victim.animation.contactPoints, delta = { x: now.origin.x - previousVictim.contacts.origin.x, y: now.origin.y - previousVictim.contacts.origin.y };
      for (const limb of ['shoulders', 'elbows', 'hands', 'feet']) now[limb].forEach((point, index) => assert.ok(distance(point, { x: previousVictim.contacts[limb][index].x + delta.x, y: previousVictim.contacts[limb][index].y + delta.y }) < .01, 'releasing the shoulder-supported body preserves every limb'));
      thrown = true;
    }
    if (elapsed >= actual.resolve) {
      assert.equal(capturedRanks()[actual.victim], order.indexOf(actual.victim) + 1);
      resolved = true; break;
    }
    previousVictim = snapshot(victim, scene.sim.bodies.get(actual.victim));
  }
  assert.ok(extended && hit && held && thrown && resolved, 'the actual double clothesline, groggy fall, four-point lift and single throw all complete');
});

test('a fresh paused shared-throw release reconstructs supported arms and continues the same smooth release', () => {
  const seed = 1, planned = arenaRounds(order, duration, rushRoll, seed).find(round => round.rushOutcome === 'counter-throw');
  assert.ok(planned, 'the ordinary production rush selects a shared counter throw');
  const elapsed = planned.impact + 150, scene = game(seed), actors = scene.step(elapsed, true);
  const contact = scene.sim.contacts.get(planned.id);
  assert.equal(contact.pairArmRelease.size, 2, 'a fresh seek captures both shoulder/ankle carriers without needing earlier painted frames');
  const released = new Map();
  for (const [id, source] of contact.pairArmRelease) {
    const actor = actors.get(id), rig = actor.animation.contactPoints;
    assert.ok(actor.carrierRelease && source.hands.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
    assert.ok(['shoulder', 'ankle'].includes(actor.gripMode), 'the supported arm proportions survive a paused seek');
    released.set(id, structuredClone(rig));
  }
  const frozen = scene.step(elapsed, true);
  for (const [id, source] of released) {
    for (const limb of ['shoulders', 'elbows', 'hands']) source[limb].forEach((point, arm) => assert.ok(distance(point, frozen.get(id).animation.contactPoints[limb][arm]) < .001, 'paused release geometry remains completely still'));
  }
  const next = scene.step(elapsed + 1, true);
  for (const [id, source] of released) {
    for (const limb of ['elbows', 'hands']) source[limb].forEach((point, arm) => assert.ok(distance(point, next.get(id).animation.contactPoints[limb][arm]) < 2, 'a tiny forward seek follows the supported release arc instead of snapping to default overhead arms'));
  }
});
