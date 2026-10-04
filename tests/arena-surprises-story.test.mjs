import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
async function source(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { arenaStoryState } = await source('src/arenaStoryLogic.ts');
const { arenaAction, arenaTechniqueTargets } = await source('src/arenaLogic.ts');
const { arenaPassingTripTargets } = await source('src/arenaPassingTrip.ts');
const base = { id: 'surprise', index: 0, tactic: 'brace', aggressor: 'drawn-survivor', victim: 'drawn-loser', start: 3800, impact: 6500, resolve: 7600, end: 7600, final: false };
const pairDodge = { start: 1000, end: 3800, outcome: 'escape', partnerId: 'wrestling-partner', allowOut: true, launchAt: 1200, contactAt: 2500 };

test('the pair story identifies both wrestlers and reads jumping, passing and landing from the recorded charge clock', () => {
  const round = { ...base, pairDodge }, waiting = { ...round, pairDodge: { ...pairDodge, launchAt: null } };
  const pending = arenaStoryState(waiting, 2400);
  assert.equal(pending.step, 0); assert.doesNotMatch(pending.action, /뛰어올|돌진을 피/);
  for (const [clock, step, action] of [[1500, 1, /달려옵니다/], [2350, 2, /뛰어올라/], [2550, 3, /발 아래 빈 공간/], [2800, 4, /두 발.*착지/], [3100, 5, /세 선수 모두.*남았/]]) {
    const story = arenaStoryState(round, clock);
    assert.equal(story.kind, 'pair-dodge'); assert.equal(story.step, step);
    assert.deepEqual(story.left, [round.aggressor, pairDodge.partnerId]); assert.deepEqual(story.right, [round.victim]);
    assert.match(story.action, action); assert.ok(story.step >= 0 && story.step < story.steps.length);
  }
  assert.notEqual(arenaStoryState(round, pairDodge.end).kind, 'pair-dodge', 'a surviving dodge releases the story before the next ordinary bout');
});

test('a planned rim outcome cannot claim an elimination before the recorded actual exit instant', () => {
  const out = { ...base, impact: 3100, resolve: 4200, end: 4200, pairDodge: { ...pairDodge, outcome: 'out' } };
  const before = arenaStoryState(out, out.impact - 1), actual = arenaStoryState(out, out.impact);
  assert.doesNotMatch(before.label, /장외/); assert.doesNotMatch(before.action, /경계를 넘어 아래로/);
  assert.match(actual.label, /돌진 선수만 장외/); assert.match(actual.action, /돌진 선수만.*경계를 넘어/);
  assert.deepEqual(actual.left, [out.aggressor, pairDodge.partnerId]); assert.deepEqual(actual.right, [out.victim]);
  const held = arenaStoryState({ ...out, pairDodge: { ...out.pairDodge, launchAt: null } }, out.impact + 50);
  assert.doesNotMatch(held.label, /장외/); assert.equal(held.step, 0, 'an unlaunched charger has not crossed any boundary');
});

test('the passing story waits for the real hook and both real toe grips and names the passer separately', () => {
  const passingTrip = { start: 1000, end: 5820, passerId: 'nearby-passer', joined: true, hookAt: 1600, launchAt: null };
  const pending = { ...base, tactic: 'lift', start: 1000, impact: 4720, resolve: 5820, end: 5820, passingTrip };
  const before = arenaStoryState(pending, 1599);
  assert.equal(before.step, 0); assert.doesNotMatch(before.label, /걸었다|넘어진/);
  assert.equal(arenaStoryState(pending, 1600).step, 1);
  assert.equal(arenaStoryState(pending, 1730).step, 2);
  const ungripped = arenaStoryState(pending, 4000);
  assert.equal(ungripped.step, 3); assert.doesNotMatch(ungripped.action, /들어 올|던집/);
  const confirmed = { ...pending, passingTrip: { ...passingTrip, launchAt: 3400 } };
  const origins = { passer: { x: 576, y: 428 }, victim: { x: 524, y: 416 }, opponent: { x: 476, y: 416 } };
  const model = arenaPassingTripTargets(confirmed.passingTrip, 3400, { x: 500, y: 416 }, origins);
  assert.equal(model.launchedAt, 3700); assert.equal(model.requiredImpactAt, confirmed.impact);
  for (const [clock, step] of [[3400, 4], [3700, 5], [4450, 6], [4720, 7], [5600, 8]]) {
    const story = arenaStoryState(confirmed, clock);
    assert.equal(story.kind, 'passing-trip'); assert.equal(story.step, step);
    assert.equal(story.intruderId, passingTrip.passerId);
    assert.deepEqual(story.left, [confirmed.aggressor]); assert.deepEqual(story.right, [confirmed.victim]);
    assert.doesNotMatch(story.action, /함께 들어|동맹|협공/);
    assert.ok(story.step >= 0 && story.step < story.steps.length);
  }
  const notJoined = { ...pending, passingTrip: { start: 1000, end: 6000, passerId: 'unselected-walker' } };
  assert.notEqual(arenaStoryState(notJoined, 2200).kind, 'passing-trip', 'a provisional rare roll cannot announce a nearby participant before the Scene selects one');
});

test('the one-percent trip counter describes the real first pusher and the bracing player reversing it', () => {
  const round = { ...base, tactic: 'trip', tripCounter: true, start: 1000, impact: 6000, resolve: 7100, end: 7100 };
  const clock = round.start + (round.impact - round.start) * .14;
  const technique = arenaTechniqueTargets(round, clock, { x: 500, y: 416 }), action = arenaAction(round, clock), opening = arenaStoryState(round, clock);
  assert.equal(technique.stage, 'probe');
  assert.equal(action.actors.find(actor => actor.id === round.victim).pose, 'push');
  assert.equal(action.actors.find(actor => actor.id === round.aggressor).pose, 'brace');
  assert.equal(opening.label, '발걸기 되치기'); assert.deepEqual(opening.left, [round.victim]); assert.deepEqual(opening.right, [round.aggressor]);
  assert.match(opening.action, /밀어오는 힘.*받/);
  const hook = arenaStoryState(round, round.start + (round.impact - round.start) * .50);
  assert.deepEqual(hook.left, [round.aggressor]); assert.deepEqual(hook.right, [round.victim]);
  assert.match(hook.action, /먼저 공격한 상대/); assert.equal(hook.step, 2);
  const ordinary = arenaStoryState({ ...round, tripCounter: false }, clock);
  assert.notEqual(ordinary.label, opening.label, 'ordinary ankle hooks retain their existing technique story');
});
