import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaAction, arenaApproachSpeed, arenaCatchTargets, arenaContactRound, arenaEdgeFall, arenaExchange, arenaLocalContact, arenaMove, arenaRanks, arenaRimDistance, arenaRounds, arenaShoveTargets, arenaThrow } = await source('src/arenaLogic.ts');
const { arenaStoryState } = await source('src/arenaStoryLogic.ts');
const { createArenaFighterAnimation, drawArenaFighter } = await source('src/game/ArenaFighter.ts');
const ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'fillRect', 'beginPath', 'ellipse', 'fill', 'moveTo', 'lineTo', 'closePath'].map(key => [key, () => {}]));
const base = { id: 'mechanic', index: 1, aggressor: 'receiver', victim: 'charger', start: 1000, impact: 4450, resolve: 5550, end: 6000, final: false };
const radius = point => Math.hypot((point.x - 500) / 303, (point.y - 416) / 112);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = (point, polygon) => {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
};

test('deciding bouts preserve their opponents until the result and make bounded room for a nearby preparation', () => {
  for (const origin of [{ x: 360, y: 400 }, { x: 610, y: 448 }, { x: 500, y: 416 }]) {
    assert.deepEqual(arenaLocalContact(origin, []), origin);
    const next = arenaLocalContact(origin, [origin]);
    assert.ok(distance(origin, next) <= 110, 'making room selects a nearby clear contact, not a fixed remote patch');
    assert.ok(Math.hypot((next.x - origin.x) / 108, (next.y - origin.y) / 63) >= .99, 'two independent pairs cannot share the same contact');
    assert.ok(radius(next) < 1);
    const body = { ...origin, facing: 1 };
    let previous = { ...body };
    for (let at = 0; at < 2000; at += 16) {
      arenaMove(body, next, .016, arenaApproachSpeed(distance(body, next)));
      assert.ok(distance(body, previous) <= 122 * .016 + .001);
      previous = { ...body };
    }
    assert.ok(distance(body, next) < 2);
  }
  const order = ['a', 'b', 'c', 'd'], first = arenaExchange(order, 0), nearResult = arenaExchange(order, first.resolve - .001), next = arenaExchange(order, first.resolve);
  assert.deepEqual([first.aggressor, first.victim], [nearResult.aggressor, nearResult.victim], 'the first met opponent stays through this deciding result');
  assert.equal(next.start, first.resolve); assert.notEqual(next.id, first.id);
  assert.ok(![next.aggressor, next.victim, next.helper].includes(first.victim), 'the defeated fighter cannot start another filler exchange');
});

test('a charge is caught at body contact before the receiver pivots, lifts and throws', () => {
  const round = { ...base, tactic: 'catch' }, span = round.impact - round.start;
  for (const center of [{ x: 355, y: 390 }, { x: 645, y: 445 }]) {
    let previous = arenaCatchTargets(round, round.start, center);
    for (let at = round.start + 16; at <= round.impact; at += 16) {
      const current = arenaCatchTargets(round, at, center), action = arenaAction(round, at);
      assert.ok(distance(current.charger, previous.charger) < 2.7, 'the charging root and pivot are continuous');
      assert.ok(distance(current.receiver, previous.receiver) < 2.7);
      if (current.stage === 'charge') {
        assert.equal(action.actors.find(part => part.id === round.victim).pose, 'run');
        assert.equal(action.lift, 0, 'the charger cannot lift before being caught');
      }
      if (current.stage === 'catch' || current.stage === 'turn') {
        assert.ok(distance(current.charger, current.receiver) < 66, 'both hands can physically reach the body');
        assert.ok(action.actors.every(part => part.gripId), 'the receiver retains the catch through the pivot');
      }
      previous = current;
    }
    const receive = arenaCatchTargets(round, round.start, center);
    const caught = arenaAction(round, receive.plannedContactAt + span * .06), lifted = arenaAction(round, round.start + span * .98);
    assert.equal(caught.lift, 0);
    assert.ok(lifted.lift > 40);
    assert.equal(lifted.liftedId, round.victim);
    const end = arenaCatchTargets(round, round.impact, center);
    const flight = arenaThrow(0, end.charger, { x: 885, y: 436 }, 1, 1, { lift: lifted.lift, angle: -.22 });
    assert.equal(flight.stage, 'hold');
    assert.equal(flight.groundX, end.charger.x);
    assert.equal(flight.height, lifted.lift, 'release inherits the existing held height instead of jumping into flight');
  }
  const receive = arenaCatchTargets(round, round.start, { x: 500, y: 416 });
  assert.match(arenaStoryState(round, receive.plannedContactAt + span * .06).action, /몸통.*팔.*잡/);
});

test('an outside shove reaches a fighting pair, frees one fighter and pushes only the drawn loser out', () => {
  const round = { ...base, tactic: 'shove', helper: 'wrestler' }, center = { x: 695, y: 435 };
  const span = round.impact - round.start;
  const initial = arenaAction(round, round.start + span * .1);
  assert.equal(initial.actors.find(part => part.id === round.aggressor).gripId, undefined);
  assert.equal(initial.actors.find(part => part.id === round.helper).gripId, round.victim);
  assert.equal(initial.actors.find(part => part.id === round.victim).gripId, round.helper);
  const contact = arenaShoveTargets(round, round.start + span * .64, center);
  assert.ok(distance(contact.aggressor, contact.victim) < 58, 'the third fighter touches before exerting the shove');
  const releasing = arenaAction(round, round.start + span * .8);
  assert.equal(releasing.actors.find(part => part.id === round.helper).gripId, undefined);
  assert.equal(releasing.actors.find(part => part.id === round.helper).pose, 'dodge');
  assert.deepEqual(releasing.attackers, [round.aggressor], 'joining a brawl is not represented as a three-person alliance');
  assert.equal(releasing.lift, 0);
  const end = arenaShoveTargets(round, round.impact, center);
  assert.ok(radius(end.helper) < 1, 'the original opponent regains their footing inside');
  assert.ok(radius(end.victim) < 1, 'the loser reaches the rim before falling');
  const fall = arenaEdgeFall(240, end.victim, { x: 885, y: 475 }, end.side);
  assert.ok(radius(fall) > 1);
  assert.equal(fall.height, 0);
});

test('central opponents fight at their existing encounter instead of preparing at a distant rim', () => {
  for (const center of [{ x: 500, y: 416 }, { x: 435, y: 405 }, { x: 585, y: 435 }]) {
    for (const [planned, actual] of [['bait', 'catch'], ['edge', 'brace'], ['shove', 'catch']]) {
      const round = { ...base, tactic: planned, helper: planned === 'shove' ? 'wrestler' : undefined };
      const local = arenaLocalContact(center, []), resolved = arenaContactRound(round, local);
      assert.deepEqual(local, center, 'the meeting point remains between the two actual bodies');
      assert.equal(resolved.tactic, actual);
      assert.equal(resolved.helper, undefined, 'a central duel cannot pull a third spectator to a scripted rim');
      for (const key of ['id', 'aggressor', 'victim', 'start', 'impact', 'resolve', 'end']) assert.equal(resolved[key], round[key]);
      const action = arenaAction(resolved, resolved.start);
      for (const part of action.actors) assert.ok(Math.abs(part.offset.x) <= 92, 'preparation is a local grip or charge setup');
      assert.equal(round.tactic, planned, 'selecting the visible maneuver does not mutate the draw or its schedule');
    }
  }
});

test('edge finishes remain available only when the actual contact is already close to a rim', () => {
  for (const center of [{ x: 305, y: 435 }, { x: 695, y: 435 }, { x: 330, y: 350 }, { x: 670, y: 350 }]) {
    assert.ok(arenaRimDistance(center) <= 112);
    for (const tactic of ['bait', 'edge', 'shove']) {
      const round = { ...base, tactic, helper: tactic === 'shove' ? 'wrestler' : undefined };
      assert.equal(arenaContactRound(round, center), round, 'a nearby rim keeps the original physical maneuver');
    }
  }
  const practice = { ...base, tactic: 'bait', exchange: true };
  assert.equal(arenaContactRound(practice, { x: 500, y: 416 }), practice, 'non-eliminating charges still dodge and brake on the sand');
});

test('catching and outside shoves occur in elimination stories with only living participants and fixed ranks', () => {
  const seen = new Set();
  for (let size = 2; size <= 10; size++) for (let variation = 0; variation < 40; variation++) {
    const order = Array.from({ length: size }, (_, index) => `arena-${variation}-${index}`), living = new Set(order);
    for (const round of arenaRounds(order)) {
      seen.add(round.tactic);
      if (round.tactic === 'shove') assert.ok(size >= 3 && round.helper && living.has(round.helper));
      assert.ok(living.has(round.victim) && living.has(round.aggressor));
      if (round.helper) assert.equal(new Set([round.aggressor, round.victim, round.helper]).size, 3);
      living.delete(round.victim);
    }
    assert.deepEqual(arenaRanks(order, 44_000), Object.fromEntries(order.map((id, index) => [id, index + 1])));
  }
  assert.ok(seen.has('bait') && seen.has('catch') && seen.has('shove'));
});

test('a two-person final also offers a catch and throw without adding a third attacker', () => {
  const order = ['1', '7'];
  const round = arenaRounds(order).at(-1);
  assert.equal(round.tactic, 'catch');
  assert.equal(round.helper, undefined);
  const action = arenaAction(round, round.impact - 100);
  assert.deepEqual(action.actors.map(part => part.id), order);
  assert.deepEqual(action.attackers, [order[0]]);
  assert.ok(action.lift > 40);
  assert.deepEqual(arenaRanks(order, round.resolve), { 1: 1, 7: 2 });
});

test('up and down steps keep knees compact and both trouser cuffs connected to the pelvis', () => {
  for (const direction of [-1, 1]) for (const facing of [-1, 1]) {
    const animation = createArenaFighterAnimation();
    const actor = { candidate: { id: 'walker', name: '선수', color: '#ffad72' }, index: 0, x: 500, y: 425, facing, scale: 2.04, pose: 'walk', angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: 0, animation };
    drawArenaFighter(ctx, actor, 0);
    let previous = animation.skeleton;
    const body = { x: actor.x, y: actor.y, facing };
    let planted = animation.feet.map(foot => ({ ...foot.ground }));
    for (let at = 16; at < 2400; at += 16) {
      const before = { ...body };
      arenaMove(body, { x: 500, y: 425 + direction * 500 }, .016, 105);
      actor.x = body.x; actor.y = body.y; actor.velocityY = (body.y - before.y) / .016; actor.gaitDistance += distance(before, body);
      drawArenaFighter(ctx, actor, at);
      const rig = animation.skeleton;
      for (let leg = 0; leg < 2; leg++) {
        assert.ok(rig.feet[leg].y <= 5.1 && rig.feet[leg].y >= -10, 'depth steps cannot lengthen the shin below the floor');
        assert.ok(distance(rig.hips[leg], rig.knees[leg]) <= 11.01);
        assert.ok(distance(rig.knees[leg], rig.feet[leg]) <= 11.01);
        assert.ok(distance(rig.knees[leg], previous.knees[leg]) < 2.5, 'changing stance cannot flip a knee');
        assert.ok(inside(rig.hips[leg], rig.shorts[leg]), 'the cuff extends over its thigh root');
        assert.ok(inside({ x: rig.hips[leg].x, y: rig.hips[leg].y + .5 }, rig.pelvis), 'the pelvic fabric covers the cuff seam');
      }
      for (let leg = 0; leg < 2; leg++) {
        const foot = animation.feet[leg];
        if (!foot.swinging && foot.lift === 0) {
          const rendered = { x: actor.x + rig.feet[leg].x * facing * actor.scale, y: actor.y + rig.feet[leg].y * actor.scale };
          assert.ok(distance(rendered, foot.ground) < .001, 'rendered planted feet stay at their world anchors');
          if (distance(foot.ground, planted[leg]) < .001) assert.ok(distance(rendered, planted[leg]) < .001, 'moving up or down cannot drag a stance heel along with the body');
        }
        planted[leg] = { ...foot.ground };
      }
      previous = rig;
    }
  }
});
