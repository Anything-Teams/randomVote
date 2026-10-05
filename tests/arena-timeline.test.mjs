import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const built = await build({
  stdin: { contents: [
    'arenaTimeline', 'arenaLogic', 'arenaEscape', 'arenaRecovery', 'arenaRimEvent', 'arenaRimCharge',
    'arenaWrestlingMoves', 'arenaKickCatch', 'arenaSupermanPunch', 'arenaSlideTrip',
    'arenaLinkedRush', 'arenaPairDodge', 'arenaPassingTrip', 'arenaTechniques', 'arenaPairRush',
  ].map(name => `export * from './${name}';`).join('\n'), resolveDir: `${process.cwd()}/src`, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false,
});
const api = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const { arenaDelayRound } = api;
const delay = 1733.375, center = { x: 600, y: 416 };
const base = { id: 'clock', index: 1, tactic: 'brace', aggressor: 'a', victim: 'v', final: false, contactSide: 1, start: 1000, impact: 7000, resolve: 11000, end: 11000, timeScale: 1.25 };
const clockOutputs = new Set([
  'start', 'end', 'throwAt', 'releasedUntil', 'forwardUntil', 'chargeStartsAt', 'dodgeStartsAt',
  'launchAt', 'plannedLaunchAt', 'plannedContactAt', 'counterReadyAt', 'contactAt', 'releaseAt',
  'kickAt', 'ankleGripAt', 'dragEndAt', 'requiredReleaseAt', 'landingAt', 'floorAt', 'pickupReadyAt',
  'requiredEndAt', 'runAt', 'outAt', 'plannedHookAt', 'kickReadyAt', 'requiredImpactAt',
  'plannedJumpAt', 'jumpAt', 'passAt', 'hookAt', 'fallAt', 'fallenAt', 'gripAt', 'plannedPickupAt',
  'pickupAt', 'launchedAt', 'tossAt', 'readyAt', 'kickReactionAt', 'slamImpactAt', 'hitAt',
]);
function unshiftFrame(value, offset) {
  if (Array.isArray(value)) return value.map(item => unshiftFrame(item, offset));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    clockOutputs.has(key) && typeof item === 'number' && Number.isFinite(item) ? item - offset : unshiftFrame(item, offset),
  ]));
}
function equalFrame(actual, expected, path = '') {
  if (typeof expected === 'number' && Number.isFinite(expected)) {
    assert.ok(typeof actual === 'number' && Math.abs(actual - expected) < 1e-7, `${path}: ${actual} / ${expected}`);
  } else if (expected && typeof expected === 'object') {
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `${path}: same frame fields`);
    for (const key of Object.keys(expected)) equalFrame(actual[key], expected[key], `${path}.${key}`);
  } else assert.equal(actual, expected, path);
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

test('delaying a pending bout preserves unset contacts, durations, geometry and the source objects', () => {
  const charger = { x: 330, y: 411 }, receiver = { x: 640, y: 417 };
  const round = deepFreeze({ ...base,
    suplexGripAt: null, elbowGripAt: undefined, rushContactAt: 4200, pairPickupAt: null,
    rushLaunchAt: Infinity, sidekickLaunchAt: -Infinity, pushContactAt: 4400, rushPushDuration: 960,
    chargeSetup: { charger, receiver, side: 1, contactAt: 4000, contactCharger: charger, contactReceiver: receiver, loadDuration: 280, turnDuration: 650 },
    floorFinish: { dragUntil: 2300, throwAt: 9400, releaseAt: null },
    escape: { start: 1000, end: 4800, releasedUntil: 5450, runnerId: 'a', chaserId: 'v', side: -1, outcome: 'separate', ungripped: true },
    recovery: { start: 1000, end: 7400, throwAt: 4800, kind: 'overhead-escape', throwerId: 'a' },
    rim: { start: 1000, end: 3200, contactAt: null, outcome: 'resist' },
    rimCharge: { start: 1000, end: 3600, outcome: 'dodge' },
    wrestlingMove: { kind: 'powerbomb', start: 1000, end: 11000, launchAt: null, contactAt: Infinity, releaseAt: 9000, kickAt: undefined, ankleGripAt: 6800, dragEndAt: 7200, plannedLaunchAt: 1700, plannedContactAt: 2800, counterReadyAt: 2200 },
    kickCatch: { start: 1000, end: 11000, launchAt: null, catchAt: 2800, plannedLaunchAt: 1700 },
    supermanPunch: { start: 1000, end: 11000, launchAt: 1700, hitAt: null, plannedLaunchAt: 1700 },
    slideTrip: { start: 1000, end: 11000, launchAt: 1700, hookAt: 2800, kickAt: null, jumpAt: Infinity, passAt: undefined, plannedLaunchAt: 1700, plannedPassAt: 3000, evade: true },
    linkedRush: { start: 1000, end: 11000, launchAt: 1700, contactAt: 2800 },
    pairDodge: { start: 1000, end: 11000, launchAt: null, contactAt: 2800, outcome: 'out', partnerId: 'h', allowOut: true },
    passingTrip: { start: 1000, end: 11000, hookAt: 2800, launchAt: 6800, passerId: 'h', joined: true },
  });
  const original = structuredClone(round), shifted = arenaDelayRound(round, delay);
  assert.deepEqual(round, original, 'the function never modifies its frozen input');
  assert.deepEqual(arenaDelayRound(shifted, -delay), round, 'every absolute clock is reversible');
  assert.notEqual(shifted, round);
  for (const key of ['chargeSetup', 'floorFinish', 'escape', 'recovery', 'rim', 'rimCharge', 'wrestlingMove', 'kickCatch', 'supermanPunch', 'slideTrip', 'linkedRush', 'pairDodge', 'passingTrip']) assert.notEqual(shifted[key], round[key]);
  assert.equal(shifted.chargeSetup.charger, charger); assert.equal(shifted.chargeSetup.receiver, receiver);
  assert.equal(shifted.chargeSetup.contactCharger, charger); assert.equal(shifted.chargeSetup.contactReceiver, receiver);
  assert.equal(shifted.chargeSetup.loadDuration, 280); assert.equal(shifted.chargeSetup.turnDuration, 650);
  assert.equal(shifted.rushPushDuration, 960); assert.equal(shifted.timeScale, 1.25); assert.equal(shifted.floorFinish.dragUntil, 2300);
  assert.equal(shifted.suplexGripAt, null); assert.equal(shifted.elbowGripAt, undefined);
  assert.equal(shifted.rushLaunchAt, Infinity); assert.equal(shifted.sidekickLaunchAt, -Infinity);
  assert.equal(shifted.wrestlingMove.contactAt, Infinity); assert.equal(shifted.slideTrip.jumpAt, Infinity);
  const verifyClocks = (before, after, path = '') => {
    for (const [key, value] of Object.entries(before)) {
      if (value && typeof value === 'object') verifyClocks(value, after[key], `${path}.${key}`);
      else if (/At$/.test(key) || ['start', 'impact', 'resolve', 'end', 'releasedUntil'].includes(key)) {
        const expected = typeof value === 'number' && Number.isFinite(value) ? value + delay : value;
        assert.equal(after[key], expected, `${path}.${key}: authored and recorded events share the same delay`);
      } else assert.equal(after[key], value, `${path}.${key}: physical quantities stay unchanged`);
    }
  };
  verifyClocks(round, shifted);
  assert.deepEqual(Object.keys(shifted).sort(), Object.keys(round).sort(), 'an absent clock or story is never invented');
  assert.deepEqual(Object.keys(shifted.wrestlingMove).sort(), Object.keys(round.wrestlingMove).sort());
  assert.deepEqual(Object.keys(arenaDelayRound(base, delay)).sort(), Object.keys(base).sort(), 'ordinary bouts do not gain optional windows or clocks');
  assert.equal(arenaDelayRound(round, 0), round);
  for (const invalid of [Infinity, -Infinity, NaN]) assert.throws(() => arenaDelayRound(round, invalid), RangeError);
});

const windows = [
  ['escape rejoin', { escape: { start: 1000, end: 4800, runnerId: 'a', chaserId: 'v', side: 1, outcome: 'rejoin' } }, (r, t) => api.arenaEscapeTargets(r, t, center)],
  ['escape separation', { escape: { start: 1000, end: 4800, releasedUntil: 5450, runnerId: 'a', chaserId: 'v', side: -1, outcome: 'separate', ungripped: true } }, (r, t) => api.arenaEscapeTargets(r, t, center)],
  ['somersault recovery', { recovery: { start: 1000, end: 7500, throwAt: 4900, throwerId: 'a' } }, (r, t) => api.arenaRecoveryTargets(r, t, center)],
  ['overhead escape', { tactic: 'suplex', recovery: { start: 1000, end: 7500, throwAt: 4900, kind: 'overhead-escape', throwerId: 'a' } }, (r, t) => api.arenaRecoveryTargets(r, t, center)],
  ...['out', 'resist'].map(outcome => [`rim ${outcome}`, { rim: { start: 1000, end: 3200, contactAt: 1600, outcome } }, (r, t) => api.arenaRimTargets(r, t, center)]),
  ...['dodge', 'resist'].map(outcome => [`outer charge ${outcome}`, { rimCharge: { start: 1000, end: 3600, outcome } }, (r, t) => api.arenaRimChargeTargets(r, t, center)]),
  ...['clothesline', 'dropkick', 'powerbomb', 'backbodydrop', 'spinebuster', 'scoopslam'].map(kind => [`wrestling ${kind}`, { wrestlingMove: { kind, start: 1000, end: 11000, launchAt: 1700, contactAt: 2800, ankleGripAt: 6900, releaseAt: 9000, dragEndAt: 7700, plannedLaunchAt: 1700, plannedContactAt: 2800, counterReadyAt: 2200 } }, (r, t) => api.arenaWrestlingMoveTargets(r.wrestlingMove, t, center)]),
  ['kick catch', { kickCatch: { start: 1000, end: 11000, launchAt: 1700, catchAt: 2800, plannedLaunchAt: 1700 } }, (r, t) => api.arenaKickCatchTargets(r.kickCatch, t, center)],
  ['superman punch', { supermanPunch: { start: 1000, end: 11000, launchAt: 1700, hitAt: 2800, plannedLaunchAt: 1700 } }, (r, t) => api.arenaSupermanPunchTargets(r.supermanPunch, t, center)],
  ['slide trip', { slideTrip: { start: 1000, end: 11000, launchAt: 1700, hookAt: 2800, kickAt: 3900, plannedLaunchAt: 1700, plannedPassAt: 3000 } }, (r, t) => api.arenaSlideTripTargets(r.slideTrip, t, center)],
  ['slide jump evasion', { slideTrip: { start: 1000, end: 11000, launchAt: 1700, hookAt: null, kickAt: null, jumpAt: 2600, passAt: 3000, plannedLaunchAt: 1700, plannedPassAt: 3000, evade: true } }, (r, t) => api.arenaSlideTripTargets(r.slideTrip, t, center)],
  ['linked rush', { linkedRush: { start: 1000, end: 11000, launchAt: 1700, contactAt: 2800 } }, (r, t) => api.arenaLinkedRushTargets(r.linkedRush, t, center)],
  ...['escape', 'out'].map(outcome => [`pair dodge ${outcome}`, { pairDodge: { start: 1000, end: 11000, launchAt: 1700, contactAt: 2800, outcome, partnerId: 'h', allowOut: true } }, (r, t) => api.arenaPairDodgeTargets(r.pairDodge, t, center)]),
  ['passing trip', { passingTrip: { start: 1000, end: 11000, hookAt: 2800, launchAt: 4900, passerId: 'h', joined: true } }, (r, t) => api.arenaPassingTripTargets(r.passingTrip, t, center)],
  ['waist catch', { tactic: 'catch', chargeSetup: { charger: { x: 400, y: 416 }, receiver: { x: 610, y: 416 }, side: 1, contactAt: 4000, loadDuration: 280, turnDuration: 650 } }, (r, t) => api.arenaCatchTargets(r, t, center)],
  ['ram', { tactic: 'ram', chargeSetup: { charger: { x: 400, y: 416 }, receiver: { x: 610, y: 416 }, side: 1, contactAt: 4000 } }, (r, t) => api.arenaRamTargets(r, t, center)],
  ['pair counter', { tactic: 'double-shove', helper: 'h', rushOutcome: 'counter-throw', rushLaunchAt: 1700, rushContactAt: 2800, pairPickupAt: 4600 }, (r, t) => api.arenaPairRushTargets(r, t, center)],
  ['pair push', { tactic: 'double-shove', helper: 'h', rushOutcome: 'double-out', rushLaunchAt: 1700, rushContactAt: 2800, rushPushDuration: 1900 }, (r, t) => api.arenaPairRushTargets(r, t, center)],
  ['suplex grip', { tactic: 'suplex', suplexGripAt: 2300 }, (r, t) => api.arenaTechniqueTargets(r, t, center)],
  ['elbow grip', { tactic: 'elbow', elbowGripAt: 5200 }, (r, t) => api.arenaTechniqueTargets(r, t, center)],
  ['sidekick launch', { tactic: 'sidekick', sidekickLaunchAt: 1700 }, (r, t) => api.arenaTechniqueTargets(r, t, center)],
  ['drag finish', { tactic: 'suplex', floorFinish: { dragUntil: 2300, throwAt: 9400, releaseAt: 10400 } }, (r, t) => api.arenaTechniqueExit(r, t - r.impact, center, { x: 1003, y: 450 }, 1, r.timeScale)],
];
for (const [name, extra, sample] of windows) test(`a delayed ${name} keeps its complete continuous pose, movement and contact phase`, () => {
  const round = deepFreeze({ ...base, ...extra });
  const stages = new Set();
  for (const offset of [delay, -768.625]) {
    const shifted = arenaDelayRound(round, offset);
    for (let elapsed = 896; elapsed <= 11200; elapsed += 32) {
      const before = sample(round, elapsed), after = sample(shifted, elapsed + offset);
      if (before?.stage) stages.add(before.stage);
      equalFrame(unshiftFrame(after, offset), before, `${name}@${elapsed}+${offset}`);
    }
  }
  assert.ok(stages.size >= 2, `${name}: verification spans actual stage transitions`);
});
