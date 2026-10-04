import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundled = await build({ entryPoints: ['src/arenaLogic.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { arenaWrestlingPresentation, arenaAction, arenaActionWords } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const motionBundle = await build({ entryPoints: ['src/arenaWrestlingMoves.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { ARENA_SCOOP_SLAM_TIMING: timing } = await import(`data:text/javascript;base64,${Buffer.from(motionBundle.outputFiles[0].text).toString('base64')}`);
test('scoop lift and turn explain the held body instead of announcing the attacker landing', () => {
  const round = { id: 'scoop', aggressor: 'a', victim: 'v', start: 0, end: 9000, contactSide: 1, wrestlingMove: { kind: 'scoopslam', start: 0, end: 9000, launchAt: 300, contactAt: 500, ankleGripAt: null, releaseAt: null, kickAt: null } };
  const lift = arenaWrestlingPresentation(round, 500 + timing.load + timing.lift / 2), turn = arenaWrestlingPresentation(round, 500 + timing.load + timing.lift + timing.turn / 2), fall = arenaWrestlingPresentation(round, 500 + timing.load + timing.lift + timing.turn + timing.slam / 2);
  assert.equal(lift.stage, 'lift'); assert.equal(lift.step, 3); assert.match(lift.title, /들어 올리기/); assert.match(lift.detail, /등과 허벅지/);
  assert.equal(turn.stage, 'turn'); assert.equal(turn.step, 4); assert.match(turn.title, /거꾸로 돌려/);
  assert.equal(fall.stage, 'fall'); assert.equal(fall.step, 5);
  for (const frame of [lift, turn]) assert.doesNotMatch(frame.word + frame.detail, /착지|발을 내리고/);
});

test('scoop is performed by the receiver and the incoming opponent owns the rush call', () => {
  const round = { id: 'scoop-counter', aggressor: 'a', victim: 'v', tactic: 'lift', start: 0, impact: 9000, resolve: 10100, end: 10100, contactSide: 1, wrestlingMove: { kind: 'scoopslam', start: 0, end: 9000, launchAt: 160, contactAt: null, ankleGripAt: null, releaseAt: null } };
  const clock = 500, action = arenaAction(round, clock), presentation = arenaWrestlingPresentation(round, clock);
  assert.equal(presentation.reverse, true);
  assert.equal(presentation.wordId, 'v');
  assert.deepEqual(action.attackers, ['v']);
  assert.equal(action.actors.find(actor => actor.id === 'a').pose, 'guard');
  assert.equal(action.actors.find(actor => actor.id === 'v').pose, 'run');
  assert.ok(arenaActionWords(round, clock).some(word => word.id === 'v' && word.word === '돌진!'));
  assert.doesNotMatch(presentation.title + presentation.label, /안아 메치기/);
});
