import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaPairDodgeOutcome, arenaPairDodgeCanExit, arenaPairDodgeTargets, ARENA_PAIR_DODGE_SPEED, ARENA_PAIR_DODGE_JUMP_DURATION } = await source('src/arenaPairDodge.ts');
const { sampleArenaFighterContacts } = await source('src/game/ArenaFighter.ts');
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sandRadius = point => Math.hypot((point.x - 500) / 303, (point.y - 416) / 112);
const center = { x: 500, y: 416 };
const origins = charger => ({ charger, pair: [{ x: 478, y: 422 }, { x: 522, y: 410 }] });
const window = { start: 1000, end: 1000, outcome: 'escape', launchAt: 1300 };
const plan = (actual = window, initial = origins({ x: 300, y: 416 }), unit = 1) => {
  const opening = arenaPairDodgeTargets(actual, actual.start, center, initial, unit);
  const recorded = { ...actual, contactAt: opening.contactAt, end: opening.requiredEndAt };
  return { opening, recorded, frame: elapsed => arenaPairDodgeTargets(recorded, elapsed, center, initial, unit) };
};

test('a thousand-way cosmetic roll gives exactly 15% pair dodges and one-third rim exits', () => {
  const ordinary = Array.from({ length: 1000 }, (_, roll) => arenaPairDodgeOutcome(roll));
  const edge = Array.from({ length: 1000 }, (_, roll) => arenaPairDodgeOutcome(roll, true));
  assert.equal(ordinary.filter(value => value === 'escape').length, 150);
  assert.equal(ordinary.filter(value => value === 'out').length, 0);
  assert.equal(edge.filter(value => value === 'out').length, 50);
  assert.equal(edge.filter(value => value === 'escape').length, 100);
  assert.equal(edge.filter(value => value === undefined).length, 850);
  for (const value of [-1, 1000, .5, NaN]) assert.throws(() => arenaPairDodgeOutcome(value), RangeError);
});

test('rim eligibility follows the incoming heading instead of the nearest left/right edge', () => {
  assert.equal(arenaPairDodgeCanExit({ x: 750, y: 416 }, { x: 570, y: 416 }), true);
  assert.equal(arenaPairDodgeCanExit({ x: 750, y: 416 }, { x: 790, y: 416 }), false);
  assert.equal(arenaPairDodgeCanExit({ x: 500, y: 480 }, { x: 500, y: 380 }), true);
  assert.equal(arenaPairDodgeCanExit({ x: 500, y: 480 }, { x: 500, y: 510 }), false);
  assert.equal(arenaPairDodgeCanExit(center, { x: 300, y: 416 }), false);
  assert.equal(arenaPairDodgeCanExit({ x: 810, y: 416 }, { x: 600, y: 416 }), false);
});

test('waiting for the real two-way grip preserves every actual origin', () => {
  const initial = origins({ x: 403, y: 436 }), waiting = { ...window, launchAt: null };
  for (const elapsed of [waiting.start, 2500, 9000]) {
    const frame = arenaPairDodgeTargets(waiting, elapsed, center, initial);
    assert.equal(frame.stage, 'wrestle'); assert.equal(frame.launchAt, null); assert.equal(frame.released, false);
    assert.deepEqual(frame.charger, initial.charger); assert.deepEqual(frame.pair, initial.pair);
    assert.deepEqual(frame.jumpHeight, [0, 0]); assert.deepEqual(frame.jumpTuck, [0, 0]);
  }
  assert.deepEqual(initial, origins({ x: 403, y: 436 }), 'sampling cannot mutate live origins');
});

test('short and zero runways start grounded, then prepare before their last running stroke', () => {
  for (const charger of [center, { x: 485, y: 416 }, { x: 500, y: 402 }]) {
    const { opening, frame } = plan(window, origins(charger));
    assert.ok(opening.contactAt >= window.launchAt + 300);
    const start = frame(window.launchAt), after = frame(window.launchAt + .001);
    assert.deepEqual(start.charger, charger); assert.deepEqual(start.jumpHeight, [0, 0]);
    assert.ok(after.jumpHeight.every(height => height < .002), 'first live step cannot seek into an old jump');
    assert.ok(opening.runAt > window.launchAt, 'a short runway receives body preparation rather than staging backwards');
    assert.deepEqual(frame(opening.runAt - .001).charger, charger);
    if (charger === center) assert.equal(frame(opening.contactAt - 16).chargeStrength, 0, 'a zero runway never requests a running-in-place pose');
  }
});

test('both 550ms hops overlap while the runner passes, then land on opposite sides inside the sand', () => {
  for (const charger of [{ x: 300, y: 416 }, { x: 700, y: 416 }, { x: 500, y: 316 }, { x: 500, y: 510 }]) {
    const initial = origins(charger), { opening, frame } = plan(window, initial), atContact = frame(opening.contactAt);
    assert.ok(atContact.jumpHeight.every(height => height > 175), 'both feet are above the charging torso at the middle of the pass');
    const takeoffs = initial.pair.map((_, index) => {
      let first, last;
      for (let elapsed = window.launchAt; elapsed <= opening.requiredEndAt; elapsed += 1) if (frame(elapsed).jumpHeight[index] > 0) { first ??= elapsed; last = elapsed; }
      assert.ok(Math.abs(last - first + 1 - ARENA_PAIR_DODGE_JUMP_DURATION) <= 1);
      return first;
    });
    assert.ok(Math.abs(Math.abs(takeoffs[0] - takeoffs[1]) - 40) <= 1, 'the pair jumps together with a small, readable delay');
    const settled = frame(opening.requiredEndAt);
    assert.deepEqual(settled.jumpHeight, [0, 0]); assert.deepEqual(settled.jumpTuck, [0, 0]);
    assert.ok(settled.pair.every(point => sandRadius(point) < 1));
    assert.ok(distance(settled.pair[0], initial.pair[0]) > 25 && distance(settled.pair[1], initial.pair[1]) > 25);
    const perpendicular = { x: -atContact.chargeDirection.y, y: atContact.chargeDirection.x };
    const motions = settled.pair.map((point, index) => (point.x - initial.pair[index].x) * perpendicular.x + (point.y - initial.pair[index].y) * perpendicular.y);
    assert.ok(motions[0] * motions[1] < 0, 'the two landing lanes really separate around the runner');
  }
});

test('the actual runner remains on its incoming line at no more than 162px/s through acceleration, passing and braking', () => {
  for (const unit of [.75, 1, 1.5]) for (const charger of [{ x: 300, y: 416 }, { x: 700, y: 416 }, { x: 500, y: 316 }, center]) {
    const initial = origins(charger), { opening, frame } = plan(window, initial, unit), direction = opening.chargeDirection;
    let previous = frame(window.launchAt), previousDistance = 0;
    for (let elapsed = window.launchAt + 8; elapsed <= opening.requiredEndAt + 100; elapsed += 8) {
      const current = frame(elapsed), dx = current.charger.x - charger.x, dy = current.charger.y - charger.y;
      assert.ok(distance(previous.charger, current.charger) <= ARENA_PAIR_DODGE_SPEED * .008 + .00001);
      assert.ok(Math.abs(dx * direction.y - dy * direction.x) < .000001, 'a pass cannot bend into a different fixed lane');
      const along = dx * direction.x + dy * direction.y;
      assert.ok(along >= previousDistance - .000001, 'the charger never snaps backwards toward another staging point');
      assert.ok(sandRadius(current.charger) < 1, 'the escape branch stops safely inside');
      previous = current; previousDistance = along;
    }
    assert.deepEqual(frame(opening.requiredEndAt + 100).charger, frame(opening.requiredEndAt + 1000).charger);
  }
});

test('the rim branch crosses the real ellipse on the same heading and drops only the third fighter', () => {
  for (const [anchor, charger] of [[{ x: 750, y: 416 }, { x: 550, y: 416 }], [{ x: 250, y: 416 }, { x: 450, y: 416 }], [{ x: 500, y: 476 }, { x: 500, y: 366 }]]) {
    const initial = { charger, pair: [{ x: anchor.x - 20, y: anchor.y + 5 }, { x: anchor.x + 20, y: anchor.y - 5 }] };
    const actual = { ...window, outcome: 'out' }, opening = arenaPairDodgeTargets(actual, window.start, anchor, initial);
    const frame = elapsed => arenaPairDodgeTargets({ ...actual, contactAt: opening.contactAt, end: opening.requiredEndAt }, elapsed, anchor, initial);
    assert.ok(opening.outAt > opening.contactAt);
    assert.ok(sandRadius(frame(opening.outAt - .001).charger) < 1);
    assert.ok(Math.abs(sandRadius(frame(opening.outAt).charger) - 1) < .000001);
    assert.ok(sandRadius(frame(opening.outAt + 16).charger) > 1, 'the runner really moves outside instead of disappearing on the sand');
    const after = frame(opening.outAt + 640);
    assert.ok(after.chargerHeight < -60 && Math.abs(after.chargerAngle) > 1.4);
    assert.ok(after.pair.every(point => sandRadius(point) < 1));
    assert.deepEqual(after.jumpHeight, [0, 0], 'the original pair lands and survives');
    let previous = frame(window.launchAt);
    for (let elapsed = window.launchAt + 8; elapsed <= opening.requiredEndAt; elapsed += 8) {
      const current = frame(elapsed);
      assert.ok(distance(current.charger, previous.charger) <= ARENA_PAIR_DODGE_SPEED * .008 + .00001);
      previous = current;
    }
  }
});

test('all pose and location boundaries are continuous and recorded contact is the common jump clock', () => {
  const { opening, recorded, frame } = plan({ ...window, outcome: 'out' });
  const clocks = [window.launchAt, opening.runAt, opening.contactAt - 300, opening.contactAt - 260, opening.contactAt, opening.contactAt + 250, opening.contactAt + 290, opening.outAt, opening.requiredEndAt];
  for (const elapsed of clocks) {
    const before = frame(elapsed - .001), after = frame(elapsed + .001);
    assert.ok(distance(before.charger, after.charger) < .001);
    before.pair.forEach((point, index) => assert.ok(distance(point, after.pair[index]) < .001));
    for (const key of ['jumpHeight', 'jumpTuck', 'pairAngle']) before[key].forEach((value, index) => assert.ok(Math.abs(value - after[key][index]) < .004));
    assert.ok(Math.abs(before.chargerHeight - after.chargerHeight) < .001);
  }
  assert.equal(arenaPairDodgeTargets(recorded, opening.contactAt, center).contactAt, opening.contactAt, 'narration with a default runway cannot move a recorded contact later');
  assert.equal(frame(opening.requiredEndAt).released, true);
  assert.equal(frame(opening.requiredEndAt).stage, 'release');
  assert.deepEqual(frame(opening.contactAt + 150), frame(opening.contactAt + 150), 'pause/seek sampling is pure');
});

test('an upward exit supplies its real rear ledge and continuous depth progress', () => {
  const anchor = { x: 500, y: 352 }, initial = { charger: { x: 500, y: 478 }, pair: [{ x: 478, y: 358 }, { x: 522, y: 346 }] };
  const actual = { ...window, outcome: 'out' }, opening = arenaPairDodgeTargets(actual, window.start, anchor, initial);
  const frame = at => arenaPairDodgeTargets({ ...actual, contactAt: opening.contactAt, end: opening.requiredEndAt }, at, anchor, initial);
  assert.equal(frame(opening.outAt).rearExit, true);
  assert.ok(Math.abs(sandRadius(frame(opening.outAt).exitRim) - 1) < 1e-6);
  assert.equal(frame(opening.outAt).exitProgress, 0);
  assert.equal(frame(opening.outAt + 650).exitProgress, 1);
  assert.ok(frame(opening.outAt + 300).charger.y < frame(opening.outAt).exitRim.y, 'the runner continues behind the rear ledge');
  assert.equal(plan({ ...window, outcome: 'out' }).frame(9999).rearExit, false, 'side falls use their original visible fall');
});

test('the painted tucked soles clear the actual charging head when each fighter crosses its lane', () => {
  const actor = (id, index, point, facing, extra) => ({ candidate: { id, name: id, color: '#dd784c' }, index, ...point, scale: 2.04, facing, pose: 'run', angle: 0, alpha: 1, velocityX: facing * 162, velocityY: 0, gaitDistance: 30, phase: .5, motionImmediate: true, ...extra });
  for (const charger of [{ x: 300, y: 416 }, { x: 700, y: 416 }]) {
    const initial = origins(charger), { opening, frame } = plan(window, initial);
    for (let index = 0; index < 2; index++) {
      const direction = opening.chargeDirection, along = (initial.pair[index].x - center.x) * direction.x + (initial.pair[index].y - center.y) * direction.y;
      const elapsed = opening.contactAt + along / (ARENA_PAIR_DODGE_SPEED / 1000), current = frame(elapsed);
      const driver = sampleArenaFighterContacts(actor('charger', 2, current.charger, current.chargerFacing, { chargeStrength: 1 }), elapsed);
      const jumper = sampleArenaFighterContacts(actor(`pair-${index}`, index, { x: current.pair[index].x, y: current.pair[index].y - current.jumpHeight[index] }, index === 0 ? 1 : -1, { pose: 'airborne', angle: current.pairAngle[index], suspension: 1, jumpTuck: current.jumpTuck[index], depthY: current.pair[index].y, velocityX: 0, gaitDistance: 0 }), elapsed);
      assert.ok(Math.max(...jumper.feet.map(foot => foot.y)) + 4 < driver.head.y, `both painted feet must clear the charging head: ${JSON.stringify({ index, elapsed, jumper: jumper.feet, head: driver.head, frame: current })}`);
    }
  }
});
