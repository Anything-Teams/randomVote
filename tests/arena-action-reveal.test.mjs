import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const bundle = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
}
const { arenaActionWords, arenaNarration, arenaWrestlingPresentation } = await source('src/arenaLogic.ts');
const { arenaStoryState } = await source('src/arenaStoryLogic.ts');
const { arenaRecoveryTargets } = await source('src/arenaRecovery.ts');
const { ARENA_BACK_BODY_DROP_TIMING, ARENA_POWERBOMB_TIMING, ARENA_SCOOP_FINISH_TIMING, ARENA_WRESTLING_MOVE_TIMING, arenaWrestlingMoveTargets } = await source('src/arenaWrestlingMoves.ts');
const { arenaTechniqueTargets } = await source('src/arenaTechniques.ts');
const candidates = ['a', 'v'].map(id => ({ id, name: id, color: '#ffad72' }));
const base = { id: 'reveal', index: 0, aggressor: 'a', victim: 'v', tactic: 'lift', start: 0, impact: 15000, resolve: 16100, end: 16100, final: true, timeScale: 1 };
const techniqueNames = /안아 메치기|돌진 카운터|돌진 받아내기|들어 내려찍기|머리메치기|넘어뜨리기|드롭킥/;

test('a two-person push announces its elimination only after the actual push finishes', () => {
  const round = { ...base, tactic: 'double-shove', final: false, helper: 'h', secondaryVictim: 'h', rushOutcome: 'double-out', rushLaunchAt: 0, rushContactAt: 1000, rushPushDuration: 2000 };
  const waiting = { ...round, rushLaunchAt: null };
  for (const elapsed of [0, 900, 1500, 2900]) {
    for (const current of [waiting, round]) {
      const story = arenaStoryState(current, elapsed);
      assert.doesNotMatch([story.label, story.relationLabel, story.steps[story.step]].join(' '), /장외/);
    }
  }
  assert.match(arenaStoryState(round, 3010).label, /장외/);
});

test('approach and preparation cannot announce a selected wrestling finish before it begins', () => {
  for (const kind of ['clothesline', 'dropkick', 'powerbomb', 'backbodydrop', 'spinebuster', 'scoopslam']) {
    const round = { ...base, wrestlingMove: { kind, start: 0, end: 15000, plannedLaunchAt: 1500, plannedContactAt: 2500, counterReadyAt: 2000, launchAt: null, contactAt: null, ankleGripAt: null, releaseAt: null } };
    for (const elapsed of [100, 1200, 1450]) {
      const story = arenaStoryState(round, elapsed), narration = arenaNarration(round, candidates, ['a', 'v'], elapsed);
      assert.doesNotMatch([story.label, story.relationLabel, story.steps[story.step], narration.title, ...arenaActionWords(round, elapsed).map(word => word.word)].join(' '), techniqueNames, `${kind} at ${elapsed}ms`);
      assert.equal(story.step, 0, `${kind} cannot reveal its follow-up in the current step chip`);
    }
    if (kind !== 'dropkick') {
      const running = { ...round, wrestlingMove: { ...round.wrestlingMove, launchAt: 1500 } };
      const story = arenaStoryState(running, 2200);
      assert.doesNotMatch(story.label + story.relationLabel + arenaActionWords(running, 2200).map(word => word.word).join(' '), techniqueNames);
      assert.equal(story.step, 0, `${kind} keeps its incoming run visible until contact`);
    }
  }
});

test('the incoming player owns the powerbomb rush while the planted opponent owns the lift and slam', () => {
  for (const side of [-1, 1]) {
    const opening = { kind: 'powerbomb', start: 0, end: 15000, launchAt: null, contactAt: null, ankleGripAt: null, releaseAt: null };
    const planned = arenaWrestlingMoveTargets(opening, 0, { x: 500, y: 416 }, undefined, side);
    const actual = { ...opening, launchAt: planned.plannedLaunchAt, plannedLaunchAt: planned.plannedLaunchAt, plannedContactAt: planned.plannedContactAt, counterReadyAt: planned.counterReadyAt };
    const round = { ...base, contactSide: side, wrestlingMove: actual };
    for (const elapsed of [actual.launchAt + 100, planned.counterReadyAt + 80, planned.plannedContactAt - 20]) {
      const frame = arenaWrestlingMoveTargets(actual, elapsed, { x: 500, y: 416 }, undefined, side);
      assert.deepEqual(frame.driverVelocity, { x: 0, y: 0 }); assert.equal(frame.driverPose === 'run', false);
      assert.equal(frame.victimPose, 'run'); assert.ok(Math.hypot(frame.victimVelocity.x, frame.victimVelocity.y) > 1);
      const words = arenaActionWords(round, elapsed);
      assert.ok(words.some(value => value.id === 'v' && value.word === '돌진!'));
      assert.ok(!words.some(value => value.id === 'a' && value.word === '돌진!'));
      const story = arenaStoryState(round, elapsed);
      assert.equal(story.leftLabel, '돌진을 받아내는 선수'); assert.equal(story.rightLabel, '달려오는 선수');
    }
    const held = { ...round, wrestlingMove: { ...actual, contactAt: planned.plannedContactAt } };
    const liftAt = planned.plannedContactAt + ARENA_POWERBOMB_TIMING.load + ARENA_POWERBOMB_TIMING.lift / 2;
    const words = arenaActionWords(held, liftAt);
    assert.ok(words.some(value => value.id === 'a' && value.word === '들어올리기!'));
    const presentation = arenaWrestlingPresentation(held, liftAt, { aggressor: '받는 선수', victim: '돌진한 선수' });
    assert.equal(presentation.reverse, true); assert.equal(presentation.steps[0], '상대 돌진');
    assert.match(presentation.detail, /받는 선수가 두 손으로 돌진한 선수의 허리를 받쳐/);
    assert.match(arenaWrestlingPresentation(held, liftAt).detail, /받아낸 선수가 두 손으로 달려온 선수의 허리를 받쳐/);
  }
});

test('a surviving somersault shows its throw call when the opponent really rises, after the grounded hold', () => {
  const round = { ...base, start: 7600, recovery: { start: 0, throwAt: 5000, end: 7600 } };
  for (const elapsed of [1600, 2700, 3500]) {
    assert.equal(arenaRecoveryTargets(round, elapsed, { x: 500, y: 416 }).height, 0);
    assert.ok(arenaActionWords(round, elapsed).every(word => word.word !== '던지기!'));
    assert.doesNotMatch(arenaStoryState(round, elapsed).label, /던지기/);
    assert.doesNotMatch(arenaNarration(round, candidates, ['a', 'v'], elapsed).title, /던지기/);
  }
  for (const elapsed of [3750, 4300, 4990]) {
    assert.ok(arenaRecoveryTargets(round, elapsed, { x: 500, y: 416 }).height > 0);
    assert.ok(arenaActionWords(round, elapsed).some(word => word.id === 'a' && word.word === '던지기!'));
  }
});

test('all ankle spin finishes announce the throw during the continuing final turn and release at one revolution', () => {
  assert.ok(ARENA_WRESTLING_MOVE_TIMING.backFlip >= 900);
  assert.ok(ARENA_BACK_BODY_DROP_TIMING.groggy >= 500);
  for (const kind of ['backbodydrop', 'scoopslam', 'powerbomb']) {
    const timing = kind === 'backbodydrop' ? ARENA_BACK_BODY_DROP_TIMING : kind === 'powerbomb' ? ARENA_POWERBOMB_TIMING : ARENA_SCOOP_FINISH_TIMING;
    assert.ok(timing.ankleLoad >= 250);
    assert.equal(timing.ankleThrow, 0, 'there is no separate stationary throwing beat after the turn');
    const window = { kind, start: 0, end: 12000, launchAt: 160, contactAt: 1500, ankleGripAt: null, releaseAt: null };
    const landed = arenaWrestlingMoveTargets(window, 5000, { x: 500, y: 416 });
    const gripAt = landed.pickupReadyAt + 400, held = { ...window, ankleGripAt: gripAt };
    const round = { ...base, wrestlingMove: held };
    const receiving = arenaWrestlingMoveTargets(held, gripAt + 200, { x: 500, y: 416 });
    assert.equal(receiving.stage, 'ankle-grip'); assert.equal(receiving.victimHeight, 0);
    assert.ok(receiving.ankleSpinProgress > 0 && receiving.ankleSpinProgress < .1, 'the ankle pickup already begins turning without announcing the eventual throw');
    assert.ok(arenaActionWords(round, gripAt + 200).every(word => word.word !== '던지기!'));
    const spinning = arenaWrestlingMoveTargets(held, gripAt + timing.ankleLoad + timing.ankleSpin / 2, { x: 500, y: 416 });
    assert.equal(spinning.stage, 'spin'); assert.equal(spinning.ankleSpin.gripBoth, true);
    assert.match(arenaWrestlingPresentation(round, gripAt + timing.ankleLoad + timing.ankleSpin / 2).title, /한 바퀴/);
    const releaseAt = gripAt + timing.ankleLoad + timing.ankleSpin;
    const throwing = arenaWrestlingMoveTargets(held, releaseAt - 16, { x: 500, y: 416 });
    assert.equal(throwing.stage, 'toss'); assert.equal(throwing.driverPose, 'grapple');
    assert.equal(throwing.gripMode, 'ankle'); assert.equal(throwing.ankleSpin.planar, true);
    assert.ok(Math.abs(throwing.pivotTurn) < Math.PI * 2 && throwing.ankleSpinProgress < 1, 'the final throw call happens while the body is still rotating');
    assert.equal(throwing.canRelease, false); assert.equal(throwing.requiredReleaseAt, releaseAt);
    assert.ok(arenaActionWords(round, releaseAt - 16).some(word => word.id === 'a' && word.word === '던지기!'));
    const released = { ...round, wrestlingMove: { ...held, releaseAt } };
    const frame = arenaWrestlingMoveTargets(released.wrestlingMove, releaseAt, { x: 500, y: 416 });
    assert.equal(frame.stage, 'release'); assert.ok(Math.abs(Math.abs(frame.pivotTurn) - Math.PI * 2) < 1e-8);
    const beat = arenaWrestlingPresentation(released, releaseAt);
    assert.match(beat.title, /회전 끝/); assert.match(beat.detail, /마치는 순간|돌던 힘 그대로/);
  }
});

test('the ordinary probe does not disclose an upcoming wrestling finish in the headline', () => {
  for (const tactic of ['armspin', 'trip', 'suplex', 'sidekick', 'elbow']) {
    const round = { ...base, tactic, start: 1000, impact: 6000, resolve: 18000, end: 18000 };
    for (const phase of [.09, .15, .25]) {
      const elapsed = round.start + phase * (round.impact - round.start);
      const technique = arenaTechniqueTargets(round, elapsed, { x: 500, y: 416 });
      if (!['approach', 'probe', 'reset', 'plant'].includes(technique.stage)) continue;
      const story = arenaStoryState(round, elapsed);
      assert.doesNotMatch(story.label + story.relationLabel, /회전 던지기|발목 걸기|내리찍기|점프 옆차기|엘보우/);
    }
  }
});

test('an elbow sequence cannot announce dragging before the actual ankle grip, even beyond its planned clock', () => {
  const round = { ...base, tactic: 'elbow', start: 1000, impact: 6000, resolve: 18000, end: 18000, elbowGripAt: null };
  const elapsed = round.impact + 400;
  assert.equal(arenaTechniqueTargets(round, elapsed, { x: 500, y: 416 }).stage, 'ankle-grip');
  const story = arenaStoryState(round, elapsed), narration = arenaNarration(round, candidates, ['a', 'v'], elapsed);
  assert.equal(story.step, 6);
  assert.ok(arenaActionWords(round, elapsed).some(word => word.word === '발끝 잡기!'));
  assert.doesNotMatch(story.steps[story.step] + narration.title, /끌기|던지기|던졌다/);
});

test('floor drag finishes call the held throw before announcing an actual release', () => {
  for (const tactic of ['suplex', 'elbow']) {
    const round = { ...base, tactic, impact: 4000, resolve: 11000, end: 12000, elbowGripAt: 4000, floorFinish: { dragUntil: 1600, throwAt: 5600, releaseAt: 6600 } };
    assert.ok(arenaActionWords(round, 5900).some(call => call.id === 'a' && call.word === '던지기!'));
    assert.match(arenaNarration(round, candidates, ['a', 'v'], 5900).detail, /손은 붙어/);
    assert.doesNotMatch(arenaNarration(round, candidates, ['a', 'v'], 5900).title, /던졌다|장외/);
    assert.match(arenaStoryState(round, 5900).action, /두 발끝.*힘을 실어 위쪽/);
    assert.match(arenaStoryState(round, 5900).action, /포물선/);
    assert.match(arenaNarration(round, candidates, ['a', 'v'], 6700).title, /던졌다/);
    const waiting = { ...round, floorFinish: { dragUntil: 1600, throwAt: null, releaseAt: null } };
    assert.ok(!arenaActionWords(waiting, 8000).some(call => call.word === '던지기!'));
    assert.doesNotMatch(arenaNarration(waiting, candidates, ['a', 'v'], 8000).title, /던졌다|장외/);
    assert.match(arenaStoryState(waiting, 8000).action, /아직/);
  }
});
