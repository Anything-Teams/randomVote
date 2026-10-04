import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const bundled = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
}
const { arenaAction, arenaActionWords, arenaMiniExchanges, arenaNarration, arenaPodium, arenaRounds } = await source('src/arenaLogic.ts');
const { arenaStoryState } = await source('src/arenaStoryLogic.ts');
const { arenaFloorExitTiming } = await source('src/arenaTechniques.ts');
const candidates = [{ id: 'a', name: '받는 선수', color: '#f00' }, { id: 'v', name: '돌진 선수', color: '#0ff' }];
const order = candidates.map(candidate => candidate.id);
const base = { id: 'story', index: 0, tactic: 'brace', aggressor: 'a', victim: 'v', start: 3600, impact: 7500, resolve: 8600, end: 8600, final: false, timeScale: 1 };

test('outer charge announcements follow preparation, actual sprint, dodge or planted resistance without an advance grip', () => {
  for (const outcome of ['dodge', 'resist']) {
    const round = { ...base, tactic: outcome === 'dodge' ? 'bait' : 'brace', rimCharge: { start: 1000, end: 3600, outcome }, impact: outcome === 'dodge' ? 3600 : 7500, resolve: outcome === 'dodge' ? 4700 : 8600 };
    const at = phase => round.rimCharge.start + 2600 * phase;
    const preparing = arenaStoryState(round, 999), sprint = arenaAction(round, at(.3));
    assert.match(preparing.steps[preparing.step], /지금 자리.*준비/);
    assert.match(arenaNarration(round, candidates, order, 999).title, /돌진 준비/);
    assert.equal(sprint.lift, 0); assert.equal(sprint.liftedId, undefined);
    assert.equal(sprint.actors.find(actor => actor.id === 'v').pose, 'run');
    assert.ok(sprint.actors.every(actor => !actor.gripId), 'the runner does not take a grip before reaching the defender');
    assert.deepEqual(arenaActionWords(round, at(.3)), [{ id: 'v', word: '돌진!' }]);
    const reaction = arenaStoryState(round, at(outcome === 'dodge' ? .58 : .75));
    assert.match(reaction.steps[reaction.step], outcome === 'dodge' ? /옆으로 회피/ : /두 발로 버티기/);
    assert.match(arenaNarration(round, candidates, order, at(outcome === 'dodge' ? .58 : .75)).detail, outcome === 'dodge' ? /옆으로 빠집/ : /두 사람 모두.*남았/);
    if (outcome === 'dodge') assert.match(arenaStoryState(round, 3650).action, /돌진.*경계/);
    else {
      const blocked = arenaAction(round, at(.75));
      assert.equal(blocked.outcome, 'resisted'); assert.ok(blocked.actors.every(actor => actor.gripId));
      assert.notEqual(arenaStoryState(round, round.rimCharge.end).kind, 'rim-charge', 'the deciding bout takes over after the failed charge');
    }
    const available = candidates.map((candidate, index) => ({ id: candidate.id, x: 500 + index * 90, y: 416 }));
    assert.deepEqual(arenaMiniExchanges(available, 999, 44000, [round]), [], 'no preparation motor can pull the outer charge into a central grip');
    assert.deepEqual(arenaMiniExchanges(available, 2000, 44000, [round]), []);
  }
});

test('a surviving throw keeps its ordinary hold and lift labels until the hands really release', () => {
  const round = { ...base, start: 5150, impact: 9050, resolve: 10150, end: 10150, recovery: { start: 0, throwAt: 3900, end: 5150 } };
  const holdTime = 3900 * .4, hold = arenaAction(round, holdTime), story = arenaStoryState(round, holdTime);
  assert.equal(hold.stage, 'link'); assert.equal(hold.lift, 0);
  assert.equal(hold.actors[0].pose, 'grapple'); assert.ok(hold.actors.every(actor => actor.gripId));
  assert.match(story.steps[story.step], /맞잡고 버티기/); assert.match(story.action, /아직 두 발로/);
  assert.doesNotMatch(arenaNarration(round, candidates, order, holdTime).detail, /착지|공중|살아남/);
  assert.deepEqual(arenaActionWords(round, holdTime), [{ id: 'a', word: '맞잡기!' }]);
  const lifting = arenaAction(round, 3900 * .85);
  assert.equal(lifting.stage, 'lift'); assert.ok(lifting.lift > 0); assert.equal(lifting.actors[0].pose, 'lift');
  assert.match(arenaStoryState(round, 3900 * .85).steps[2], /발 딛고 들기/);
  assert.equal(arenaAction(round, 3900 + 460).stage, 'throw');
  assert.match(arenaStoryState(round, 3900 + 460).steps[3], /공중 한 바퀴/);
  assert.match(arenaNarration(round, candidates, order, 3900 + 880).title, /착지/);
});

test('an elbow knockout announces foot approach, grounded dragging, rim throw and recovery on the physical clock', () => {
  for (const unit of [.5, 1, 1.4]) {
    const round = { ...base, tactic: 'elbow', start: 0, impact: 4100 * unit, resolve: 8200 * unit, end: 8600 * unit, timeScale: unit, final: true };
    const timing = arenaFloorExitTiming(round), at = age => round.impact + age;
    assert.match(arenaStoryState(round, round.impact * .8).steps[5], /발끝으로 접근/);
    const dragAt = at((timing.stunnedUntil + timing.dragUntil) / 2), drag = arenaAction(round, dragAt), dragStory = arenaStoryState(round, dragAt);
    assert.equal(drag.lift, 0); assert.equal(drag.liftedId, undefined); assert.equal(drag.actors[0].pose, 'drag');
    assert.match(dragStory.steps[dragStory.step], /모래 위로 끌기/);
    assert.match(dragStory.action, /모래 위.*경계/); assert.doesNotMatch(dragStory.action, /들어|공중/);
    assert.deepEqual(arenaActionWords(round, dragAt), [{ id: 'a', word: '끌기!' }]);
    const holdAt = at(timing.dragUntil + 50 * unit), held = arenaAction(round, holdAt);
    assert.equal(held.actors[0].pose, 'overhead');
    assert.equal(held.actors[0].gripId, 'v');
    assert.match(arenaStoryState(round, holdAt).action, /머리 위/);
    assert.deepEqual(arenaActionWords(round, holdAt), [{ id: 'a', word: '던지기!' }]);
    const tossAt = at(timing.throwUntil + 50 * unit);
    assert.equal(arenaAction(round, tossAt).actors[0].pose, 'throw');
    assert.match(arenaStoryState(round, tossAt).steps[8], /끝에서 던지기/);
    assert.deepEqual(arenaActionWords(round, tossAt), [{ id: 'a', word: '던지기!' }]);
    const recoveryAt = at((timing.landUntil + timing.recoverUntil) / 2);
    assert.ok(recoveryAt < at(timing.recoverUntil));
    const recovery = arenaStoryState(round, recoveryAt);
    assert.match(recovery.steps[recovery.step], /몸 일으키기/); assert.doesNotMatch(recovery.action, /우승 확정|순위가 확정/);
    assert.match(arenaNarration(round, candidates, order, recoveryAt).title, /몸을 일으킨다/);
  }
});

test('both finalists wait until a floor-drag loser has physically recovered before podium walking', () => {
  for (const tactic of ['elbow', 'suplex']) {
    let fixture;
    for (let variant = 0; variant < 100 && !fixture; variant++) {
      const participants = [`podium-floor-${variant}-winner`, `podium-floor-${variant}-runner`];
      for (let seed = 0; seed < 64 && !fixture; seed++) {
        const final = arenaRounds(participants, 44000, 7, seed).at(-1);
        if (final.tactic === tactic) fixture = { participants, seed, final };
      }
    }
    assert.ok(fixture, `${tactic}: exercise an actual scheduled final`);
    const { participants, seed, final } = fixture, recoveredAt = final.impact + arenaFloorExitTiming(final).recoverUntil;
    const places = arenaPodium(participants, 44000, 7, seed);
    assert.ok(places.every(place => place.readyAt > recoveredAt));
    assert.ok(places.every(place => place.readyAt >= final.resolve));
  }
});

test('a completed escape describes lost contact without claiming the pursuer changes direction', () => {
  const round = { ...base, start: 4450, escape: { start: 0, end: 3800, releasedUntil: 4450, runnerId: 'v', chaserId: 'a', side: 1, outcome: 'separate' } };
  for (const elapsed of [3500, 4000]) {
    const story = arenaStoryState(round, elapsed), narration = arenaNarration(round, candidates, order, elapsed);
    assert.match(story.action, /손이 닿지 않는 거리/);
    assert.match(narration.detail, /두 선수 모두.*남았/);
    assert.doesNotMatch(`${story.action} ${narration.detail}`, /다른 방향|방향을 바|서로 다른 상대/);
  }
});
