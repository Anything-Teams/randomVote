import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/arenaWrestlingMoves.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { arenaWrestlingMoveTargets, ARENA_SCOOP_SLAM_TIMING } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const center = { x: 500, y: 416 };
const duration = Object.values(ARENA_SCOOP_SLAM_TIMING).reduce((sum, value) => sum + value, 0);

function received(side) {
  const origins = { driver: { x: 500 + side * 25, y: 416 }, victim: { x: 500 - side * 200, y: 416 } };
  const waiting = { kind: 'scoopslam', start: 0, end: 12000, launchAt: null, contactAt: null, ankleGripAt: null, releaseAt: null };
  const opening = arenaWrestlingMoveTargets(waiting, 0, center, origins, side);
  const launched = { ...waiting, launchAt: opening.plannedLaunchAt };
  const launch = arenaWrestlingMoveTargets(launched, launched.launchAt, center, origins, side);
  origins.launchDriver = launch.driver; origins.launchVictim = launch.victim;
  const contactAt = opening.plannedContactAt;
  const contact = arenaWrestlingMoveTargets(launched, contactAt, center, origins, side);
  origins.contactDriver = contact.driver; origins.contactVictim = contact.victim;
  origins.scoopWaist = { x: contact.victim.x, y: 370 };
  origins.scoopFloorWaist = { x: contact.driver.x + opening.side * 87, y: 397 };
  const held = { ...launched, contactAt };
  return { origins, opening, at: age => arenaWrestlingMoveTargets(held, contactAt + age, center, origins, side) };
}

test('the received scoop accelerates the supported back into the floor before the actual knockout', () => {
  for (const side of [-1, 1]) for (const step of [16, 50]) {
    const scene = received(side);
    const earlier = scene.at(duration - 500), middle = scene.at(duration - 500 + step);
    const before = scene.at(duration - step), floor = scene.at(duration);
    const earlyVelocity = (middle.scoopSupport.y - earlier.scoopSupport.y) * 1000 / step;
    const impactVelocity = (floor.scoopSupport.y - before.scoopSupport.y) * 1000 / step;
    assert.ok(impactVelocity > 130 && impactVelocity > earlyVelocity * 2, 'the back gains downward speed instead of braking into a gentle placement');
    assert.ok(before.victimHeight > 0 && before.scoopDown < 1);
    assert.equal(before.victimEyesClosed, false); assert.equal(before.slamImpact, 0);
    assert.equal(floor.victimHeight, 0); assert.equal(floor.victimEyesClosed, true);
    assert.equal(floor.victimPose, 'stunned'); assert.equal(floor.victimSlam.slump, 1);
    assert.equal(floor.slamImpact, 1, 'the impact is strongest on the actual collision frame');
    assert.deepEqual(floor.scoopSupport, scene.origins.scoopFloorWaist);
    assert.equal(floor.canRelease, false, 'the floor slam still needs a separate actual ankle pickup');
  }
});

test('a scoop impact briefly recoils the inside caster while the unconscious back remains anchored', () => {
  for (const side of [-1, 1]) {
    const scene = received(side), floor = scene.at(duration), recoil = scene.at(duration + 50), settled = scene.at(duration + 220);
    assert.ok(Math.abs((floor.driver.x - recoil.driver.x) * scene.opening.side - 3) < 1e-8);
    assert.deepEqual(settled.driver, floor.driver);
    assert.ok(recoil.slamImpact > .85); assert.equal(settled.slamImpact, 0);
    for (const age of [0, 16, 50, 100, 170, 220]) {
      const frame = scene.at(duration + age);
      assert.deepEqual(frame.scoopSupport, floor.scoopSupport);
      assert.equal(frame.victimEyesClosed, true); assert.equal(frame.victimHeight, 0);
      assert.ok(Math.hypot((frame.driver.x - 500) / 303, (frame.driver.y - 416) / 112) < 1);
    }
  }
});
