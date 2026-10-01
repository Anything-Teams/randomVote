import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaAction, arenaMove, arenaRamTargets, arenaRanks, arenaRounds, arenaThrow } = await source('src/arenaLogic.ts');
const { arenaStoryState } = await source('src/arenaStoryLogic.ts');
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const round = { id: 'ram', index: 0, tactic: 'ram', aggressor: 'driver', victim: 'receiver', start: 1000, impact: 6000, resolve: 7100, end: 7600, final: false };
const atPhase = p => round.start + (round.impact - round.start) * p;

test('a successful charge hits without becoming a grip or a lifting attack', () => {
  for (const phase of [.15, .5, .8]) {
    const action = arenaAction(round, atPhase(phase));
    assert.equal(action.lift, 0, 'the receiver stays on the sand before shoulder contact');
    assert.equal(action.liftedId, undefined);
    assert.ok(action.actors.every(actor => actor.gripId === undefined), 'a running collision never starts by grasping the opponent');
  }
  const hit = arenaAction(round, atPhase(.96)), release = arenaAction(round, round.impact);
  assert.deepEqual(hit.attackers, [round.aggressor]);
  assert.equal(hit.targetId, round.victim);
  assert.equal(hit.liftedId, round.victim);
  assert.ok(hit.lift > 15, 'the impact visibly knocks the receiver off the ground');
  assert.equal(release.liftedId, round.victim);
  assert.equal(release.lift, 26);
  for (const time of [atPhase(.5), atPhase(.96), round.impact, round.impact + 200]) {
    const driver = arenaAction(round, time).actors.find(actor => actor.id === round.aggressor);
    assert.ok(!['lift', 'throw'].includes(driver.pose), 'the driver keeps running through contact instead of performing a throw');
  }
});

test('the driving fighter reaches real contact within bounded live movement in short and long bouts', () => {
  for (const span of [2068, 3450, 5000, 7045]) for (const center of [{ x: 325, y: 385 }, { x: 675, y: 440 }]) {
    const bout = { ...round, impact: round.start + span }, first = arenaRamTargets(bout, bout.start, center);
    const driver = { ...first.driver, facing: first.side }, victim = { ...first.victim, facing: -first.side };
    let previous = first;
    for (let time = bout.start + 16; time <= bout.impact; time += 16) {
      const target = arenaRamTargets(bout, time, center);
      assert.ok(distance(target.driver, previous.driver) < 5, 'the charge target never cuts to the opponent');
      for (const [body, destination] of [[driver, target.driver], [victim, target.victim]]) {
        const before = { ...body };
        arenaMove(body, destination, .016, 165);
        assert.ok(distance(before, body) <= 165 * .016 + .001);
      }
      previous = target;
    }
    assert.ok(distance(driver, victim) < 56, 'the receiver can only fly away after the actual running body reaches them');
    const contact = arenaRamTargets(bout, bout.impact, center);
    assert.equal(contact.stage, 'release');
    assert.ok(contact.impact > .99);
    assert.ok(Math.sign(contact.victim.x - contact.driver.x) === contact.side, 'the impact carries the receiver forward along the charge');
  }
});

test('collision recoil hands its actual height and origin directly to the outgoing flight', () => {
  const contact = arenaRamTargets(round, round.impact, { x: 675, y: 430 });
  const action = arenaAction(round, round.impact), preparation = { lift: action.lift, angle: -.11 };
  const released = arenaThrow(0, contact.victim, { x: 885, y: 460 }, contact.side, 1, preparation);
  assert.equal(released.groundX, contact.victim.x);
  assert.equal(released.groundY, contact.victim.y);
  assert.equal(released.height, action.lift);
  assert.equal(released.y, contact.victim.y - action.lift, 'release does not reset the struck fighter onto the sand');
  const flying = arenaThrow(80, contact.victim, { x: 885, y: 460 }, contact.side, 1, preparation);
  assert.equal(flying.stage, 'flight');
  assert.ok(flying.groundX > released.groundX && flying.height > released.height, 'the shoulder impact immediately continues outward and upward');
  assert.match(arenaStoryState(round, atPhase(.95)).action, /어깨|충돌|돌진/);
});

test('occasional successful charges knock out only the drawn loser and preserve every final place', () => {
  let charges = 0, roundsSeen = 0;
  for (let variation = 0; variation < 80; variation++) for (const count of [2, 3, 7, 10]) {
    const order = Array.from({ length: count }, (_, index) => `fighter-${variation}-${index}`);
    const rounds = arenaRounds(order);
    roundsSeen += rounds.length;
    for (const bout of rounds.filter(item => item.tactic === 'ram')) {
      charges++;
      assert.equal(bout.helper, undefined);
      const action = arenaAction(bout, bout.impact);
      assert.deepEqual(action.attackers, [bout.aggressor]);
      assert.equal(action.liftedId, bout.victim);
      assert.ok(order.indexOf(bout.aggressor) < order.indexOf(bout.victim));
    }
    assert.deepEqual(arenaRanks(order, 44000), Object.fromEntries(order.map((id, rank) => [id, rank + 1])));
  }
  assert.ok(charges > 0 && charges < roundsSeen * .3, 'a direct charge is an occasional different outcome among the other bouts');
});
