import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: ['src/game/ArenaFighter.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createArenaFighterAnimation, drawArenaFighter, sampleArenaFighterContacts } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const motionBundle = await build({ entryPoints: ['src/arenaWrestlingMoves.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { ARENA_SPINEBUSTER_TIMING: timing, ARENA_CLOTHESLINE_FINISH_TIMING: dragTiming, arenaWrestlingMoveTargets } = await import(`data:text/javascript;base64,${Buffer.from(motionBundle.outputFiles[0].text).toString('base64')}`);
const fighter = values => ({ candidate: { id: 'a', name: 'a', color: '#ffad72' }, index: 0, x: 500, y: 416, depthY: 416, scale: 2.04, facing: 1, pose: 'guard', angle: 0, alpha: 1, velocityX: 0, velocityY: 0, gaitDistance: 0, phase: 0, motionImmediate: false, animation: createArenaFighterAnimation(), ...values });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const smooth = value => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };
function paint(actor, clock) {
  let matrix;
  const eyes = [];
  const ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'scale', 'beginPath', 'ellipse', 'fill', 'closePath', 'fillRect', 'moveTo', 'lineTo'].map(key => [key, () => {}]));
  ctx.transform = (...values) => { matrix = values; };
  ctx.fillRect = (_x, _y, _width, height) => { if (ctx.fillStyle === '#172b37') eyes.push(height); };
  drawArenaFighter(ctx, actor, clock);
  return { contacts: structuredClone(actor.animation.contactPoints), rig: structuredClone(actor.animation.rig), skeleton: structuredClone(actor.animation.skeleton), matrix, eyes };
}
function humanBones(actor, frame) {
  assert.ok(frame.matrix.every(Number.isFinite));
  assert.ok(Math.abs(Math.hypot(frame.matrix[0], frame.matrix[1]) - actor.scale) < 1e-8, 'lifting keeps the complete body width');
  for (let arm = 0; arm < 2; arm++) {
    assert.ok(Math.abs(distance(frame.contacts.shoulders[arm], frame.contacts.elbows[arm]) - 11 * actor.scale) < .001, 'the upper arm stays connected and full length');
    assert.ok(Math.abs(distance(frame.contacts.elbows[arm], frame.contacts.hands[arm]) - 10.5 * actor.scale) < .001, 'the forearm stays connected and full length');
  }
  if (actor.animation.airborne && !actor.slamProgress) for (let leg = 0; leg < 2; leg++) {
    assert.ok(Math.abs(distance(frame.skeleton.hips[leg], frame.skeleton.knees[leg]) - 11) < .001);
    assert.ok(Math.abs(distance(frame.skeleton.knees[leg], frame.skeleton.feet[leg]) - 11) < .001);
  }
}


const points = rig => [rig.head, rig.waist, ...rig.shoulders, ...rig.elbows, ...rig.hands, ...rig.feet];

test('receiving the incoming waist loads planted knees before a distinct supported rise and guided floor slam', () => {
 for (const facing of [-1,1]) for(const step of [16,50]) for(const index of [0,3,6,9]) {
  const actor=fighter({facing,index}); const initial=paint(actor,1000); actor.pose='spinebuster';
  let previous=initial;
  for(let age=0;age<=timing.load+timing.lift+timing.slam+step;age+=step){
   const load=smooth(age/timing.load), lift=smooth((age-timing.load)/timing.lift), down=smooth((age-timing.load-timing.lift)/timing.slam);
   Object.assign(actor,{spineLoad:load,spineLift:lift,spineDown:down}); const frame=paint(actor,1000+age);
   humanBones(actor,frame); assert.equal(actor.animation.airborne,false);
   assert.ok(actor.animation.feet.every(foot=>foot.lift===0),'weight is driven through two actual planted heels');
   assert.ok(frame.rig.motion.lean<=36.01,'the receiver guides the back onto the floor without a sudden deep forward dive');
   assert.ok(frame.rig.motion.crouch<=5.81,'receiving the weight bends the knees without collapsing into a seated pose');
   if(!age)points(frame.contacts).forEach((point,i)=>assert.ok(distance(point,points(initial.contacts)[i])<.001,'preparation starts at the previous real guard'));
   if(age>0)points(frame.contacts).forEach((point,i)=>assert.ok(distance(point,points(previous.contacts)[i])<(step===16?9:26),'the knees, torso and support hands change together without a stage-boundary snap'));
   previous=frame;
  }
 }
});

test('a waist-supported spine victim keeps complete softly folded limbs through the slow lift',()=>{
 for(const facing of [-1,1]) for(const step of [16,50]) {
  const actor=fighter({facing,index:1}); const initial=paint(actor,1000);
  Object.assign(actor,{pose:'carried',carrySupport:'shoulder',spineCarry:true,carryEntry:true,carryStretch:0,suspension:0});
  const entered=paint(actor,1000); humanBones(actor,entered);
  entered.contacts.hands.forEach((hand,arm)=>assert.ok(distance(hand,initial.contacts.hands[arm])<1,'the supported lift keeps the actual received arm pose'));
  let previous=entered;
  for(let age=step;age<=timing.lift+step;age+=step) {
   const lift=smooth(age/timing.lift); Object.assign(actor,{carryStretch:lift,suspension:lift,y:416-72*lift});
   const frame=paint(actor,1000+age); humanBones(actor,frame);
   points(frame.contacts).forEach((point,i)=>assert.ok(distance(point,points(previous.contacts)[i])<(step===16?11:30),'the received arms and knees fold through a continuous normal-bone arc'));
   previous=frame;
  }
  assert.ok(previous.rig.hands.every(hand=>hand.y<previous.rig.hip.y+8),'both hands brace near the chest rather than trailing stiffly below the hips');
  assert.ok(previous.skeleton.feet.every((foot,leg)=>distance(foot,previous.skeleton.hips[leg])<20.5),'the supported body keeps visible knee flex instead of two rigid legs');
 }
});

test('the spine contact clock reserves load, lift, fall, actual two-ankle pickup and the inside-rim drag before release',()=>{
 for(const side of [-1,1]) {
  const center={x:500,y:416}, origins={driver:{x:500+side*25,y:416},victim:{x:500-side*200,y:416}};
  const pending={kind:'spinebuster',start:0,end:12000,launchAt:160,contactAt:null,ankleGripAt:null,releaseAt:null,kickAt:null};
  const approach=arenaWrestlingMoveTargets(pending,161,center,origins,side);
  assert.equal(approach.driverPose,'guard'); assert.equal(approach.gripStrength,0); assert.equal(approach.victimPose,'run');
  const contactAt=approach.plannedContactAt, actual={...pending,contactAt};
  const at=arenaWrestlingMoveTargets(actual,contactAt,center,origins,side);
  origins.contactDriver=at.driver;origins.contactVictim=at.victim;
  const loaded=arenaWrestlingMoveTargets(actual,contactAt+timing.load-1,center,origins,side);
  assert.equal(loaded.stage,'contact');assert.equal(loaded.victimHeight,0);assert.ok(loaded.spineLoad>.99);
  const lifted=arenaWrestlingMoveTargets(actual,contactAt+timing.load+timing.lift,center,origins,side);
  assert.equal(lifted.victimHeight,72);assert.equal(lifted.spineLift,1);assert.equal(lifted.spineDown,0);assert.equal(lifted.victimPose,'carried');
  const floor=arenaWrestlingMoveTargets(actual,lifted.floorAt,center,origins,side);
  assert.equal(floor.victimHeight,0);assert.equal(floor.canRelease,false);assert.equal(floor.canKick,false);assert.equal(floor.frontKick,undefined);
  const ankleGripAt=floor.pickupReadyAt+240, grip=arenaWrestlingMoveTargets({...actual,ankleGripAt},ankleGripAt,center,origins,side);
  origins.floorVictim=grip.victim;origins.ankleDriver=grip.driver;origins.pickupDriver=grip.driver;origins.ankles=grip.gripTargets;
  const held={...actual,ankleGripAt}; const start=arenaWrestlingMoveTargets(held,ankleGripAt,center,origins,side);
  const middle=arenaWrestlingMoveTargets(held,ankleGripAt+dragTiming.gripLoad+900,center,origins,side);
  assert.equal(middle.stage,'drag');assert.equal(middle.victimHeight,0);assert.ok(distance(middle.victim,start.victim)>65,'the real held body moves along the sand before the final throw');
  assert.ok(Math.hypot(middle.driverVelocity.x,middle.driverVelocity.y)<=105.001); assert.equal(middle.canRelease,false);
  const before=arenaWrestlingMoveTargets(held,start.requiredReleaseAt-1,center,origins,side); assert.equal(before.canRelease,false);
  const release=arenaWrestlingMoveTargets(held,start.requiredReleaseAt,center,origins,side);assert.equal(release.canRelease,true);assert.equal(release.ankleThrowProgress,1);
  assert.equal(release.requiredReleaseAt-release.dragEndAt,timing.throw);assert.ok(Math.hypot((release.driver.x-500)/303,(release.driver.y-416)/112)<1,'only the held opponent exits after an inside-rim throw');
 }
});

test('the received spine victim keeps both eyes open until the accelerated floor impact closes them', () => {
 for (const side of [-1, 1]) for (const step of [16, 50]) {
  const contactAt = 1200, center = { x: 500, y: 416 };
  const origins = { driver: { x: 500 + side * 25, y: 416 }, victim: { x: 500 - side * 200, y: 416 }, contactDriver: { x: 500 + side * 25, y: 416 }, contactVictim: { x: 500 + side * 67, y: 416 } };
  const window = { kind: 'spinebuster', start: 0, end: 12000, launchAt: 160, contactAt, ankleGripAt: null, releaseAt: null };
  const actor = fighter({ index: 1, facing: -side, ...origins.contactVictim });
  paint(actor, contactAt);
  const fallAt = timing.load + timing.lift, floorAge = fallAt + timing.slam;
  const times = [...new Set([0, ...Array.from({ length: Math.ceil((floorAge + 180) / step) }, (_, n) => (n + 1) * step), floorAge])].sort((a, b) => a - b);
  let previous, floorSeen = false, impactSeen = false;
  for (const age of times) {
   const frame = arenaWrestlingMoveTargets(window, contactAt + age, center, origins, side);
   Object.assign(actor, { x: frame.victim.x, y: frame.victim.y - frame.victimHeight, depthY: frame.victim.y, pose: frame.victimPose, angle: frame.victimAngle, phase: frame.victimPhase, suspension: frame.victimSuspension, slamProgress: frame.victimSlam, slamEntry: frame.victimSlam !== undefined, carrySupport: 'shoulder', carryStretch: frame.victimCarryStretch, carryEntry: frame.victimCarryStretch !== undefined, spineCarry: frame.victimCarryStretch !== undefined, eyesClosed: frame.victimEyesClosed, slamImpact: frame.slamImpact });
   const drawn = paint(actor, contactAt + age); humanBones(actor, drawn);
   assert.equal(frame.victimEyesClosed, age >= floorAge, 'receiving and lowering the actual held body precede unconscious eyes');
   assert.deepEqual(drawn.eyes, [age >= floorAge ? .7 : 1.8, age >= floorAge ? .7 : 1.8], 'both painted eyes use the actual floor contact clock');
   if (previous) for (const key of ['head', 'waist']) assert.ok(distance(drawn.contacts[key], previous.contacts[key]) < 8 + step * 1.3, 'accelerating into the floor still preserves one continuous full-size rig');
   if (age === floorAge) { floorSeen = true; assert.equal(frame.victimHeight, 0); assert.equal(frame.victimSlam.slump, 1); assert.equal(frame.slamImpactAt, contactAt + floorAge); }
   if (frame.slamImpact > .4) impactSeen = true;
   previous = drawn;
  }
  const early = arenaWrestlingMoveTargets(window, contactAt + fallAt + timing.slam * .25, center, origins, side);
  const late = arenaWrestlingMoveTargets(window, contactAt + fallAt + timing.slam * .75, center, origins, side);
  assert.ok(early.spineDown < .1 && late.spineDown > .7, 'the first receiving beat holds the weight before the faster final downward stroke');
  assert.ok(floorSeen && impactSeen);
 }
});

test('the waist receiver falls backward with the supported opponent, then rises from that same ground root before the ankle approach', () => {
 for (const side of [-1, 1]) for (const step of [16, 50]) {
  const contactAt = 1200, center = { x: 500, y: 416 }, driverRoot = { x: 500, y: 416 }, victimRoot = { x: 500 + side * 30, y: 416 };
  const driver = fighter({ ...driverRoot, facing: side }), victim = fighter({ ...victimRoot, facing: -side, index: 1 });
  const original = paint(victim, contactAt);
  paint(driver, contactAt);
  const floorRoot = { x: driverRoot.x - side * 62, y: victimRoot.y };
  const flat = sampleArenaFighterContacts({ ...victim, ...floorRoot, pose: 'stunned', angle: -side * Math.PI * .53, suspension: 0, slamProgress: { tuck: 0, slump: 1 }, animation: undefined, motionImmediate: true }, contactAt);
  const origins = { driver: driverRoot, victim: { x: 500 + side * 200, y: 416 }, contactDriver: driverRoot, contactVictim: victimRoot, spineWaist: original.contacts.waist, spineFloorVictim: floorRoot, spineFloorWaist: flat.waist };
  const window = { kind: 'spinebuster', start: 0, end: 12000, launchAt: 160, contactAt, ankleGripAt: null, releaseAt: null };
  const floorAge = timing.load + timing.lift + timing.slam, readyAge = floorAge + timing.recover;
  const times = [...new Set([0, ...Array.from({ length: Math.floor((readyAge - 1) / step) }, (_, n) => (n + 1) * step), floorAge, readyAge - 1])].sort((a, b) => a - b);
  let previousDriver, previousVictim, previousAge = 0, floorDriver, backwardSeen = false, recoverySeen = false;
  for (const age of times) {
   const frame = arenaWrestlingMoveTargets(window, contactAt + age, center, origins, side);
   Object.assign(victim, { x: frame.victim.x, y: frame.victim.y - frame.victimHeight, depthY: frame.victim.y, pose: frame.victimPose, angle: frame.victimAngle, phase: frame.victimPhase, suspension: frame.victimSuspension, slamProgress: frame.victimSlam, slamEntry: frame.victimSlam !== undefined, carrySupport: 'shoulder', carryStretch: frame.victimCarryStretch, carryEntry: frame.victimCarryStretch !== undefined, spineCarry: frame.victimCarryStretch !== undefined, eyesClosed: frame.victimEyesClosed });
   const rig = sampleArenaFighterContacts(victim, contactAt + age), offset = { x: frame.spineSupport.x - rig.waist.x, y: frame.spineSupport.y - rig.waist.y };
   victim.x += offset.x; victim.y += offset.y; victim.depthY += offset.y;
   const received = paint(victim, contactAt + age);
   Object.assign(driver, { ...frame.driver, depthY: frame.driver.y, pose: frame.driverPose, phase: frame.driverPhase, angle: frame.driverAngle, suspension: frame.driverSuspension, slamProgress: frame.driverSlam, slamEntry: frame.driverSlam !== undefined, spineLoad: frame.spineLoad, spineLift: frame.spineLift, spineDown: frame.spineDown, spinebusterProgress: frame.spinebusterProgress, bulldogProgress: 0, gripMode: 'waist', gripStrength: frame.gripStrength, gripLocked: true, gripTarget: { x: received.contacts.waist.x + side * 6, y: received.contacts.waist.y + 3 }, secondaryGripTarget: received.contacts.waist });
   const caster = paint(driver, contactAt + age);
   humanBones(driver, caster); humanBones(victim, received);
   if (previousDriver) {
    const cap = 8 + (age - previousAge) * 1.3;
    points(caster.contacts).forEach((point, index) => assert.ok(distance(point, points(previousDriver.contacts)[index]) < cap, `the backward caster keeps the shoulders, palms and feet connected through the release and rise: ${side}/${step}/${age}/${index}/${distance(point, points(previousDriver.contacts)[index])}`));
    points(received.contacts).forEach((point, index) => assert.ok(distance(point, points(previousVictim.contacts)[index]) < cap, 'the received body follows the same backward throwing arc without a floor reset'));
   }
   if (frame.spineDown > .2 && frame.spineDown < .9) {
    assert.ok(side * frame.driverAngle < 0 && side * frame.victimAngle < 0, 'both bodies fall behind the receiving wrestler');
    backwardSeen = true;
   }
   if (age === floorAge) {
    floorDriver = { ...frame.driver };
    assert.ok(side * (frame.victim.x - driverRoot.x) < -60, 'the opponent lands behind the original receiving position');
    assert.equal(frame.driverPose, 'recover'); assert.ok(frame.driverSlam.slump > .99);
    assert.ok(Math.abs(frame.driverAngle) > 1.4); assert.equal(frame.victimEyesClosed, true);
    assert.ok(distance(received.contacts.waist, flat.waist) < .001);
    assert.equal(frame.canGrabAnkle, false);
   }
   if (floorDriver && age > floorAge) {
    assert.deepEqual(frame.driver, floorDriver, 'rising cannot teleport the receiver back to its old standing position');
    assert.equal(frame.gripMode, 'waist'); assert.equal(frame.canGrabAnkle, false);
    recoverySeen = true;
   }
   previousDriver = caster; previousVictim = received; previousAge = age;
  }
  assert.ok(backwardSeen && recoverySeen);
  const ready = arenaWrestlingMoveTargets(window, contactAt + readyAge, center, origins, side);
  assert.equal(ready.gripMode, 'ankle'); assert.equal(ready.ankleApproach, 0); assert.equal(ready.canGrabAnkle, false);
 }
});
