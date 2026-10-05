import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Inspect the actual Scene's painted grip, body turn and hand release. The
// fixture selects natural encounters; it supplies no contacts or release clocks.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
const ranks = 'const ranks = props.preview ? {} : resolvedRanks(order, rounds, elapsed);';
const initialize = 'const ambient = won ? [] : active.filter';
assert.ok(source.includes(draw) && source.includes(ranks) && source.includes(initialize));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'ankleMotionScenery(ctx, clock,')
  .replace(draw, `ankleMotionActors = actors; arenaDrawOrder([...actors.values()]).forEach(actor => { ctx.fighterStart(actor); drawArenaFighter(ctx, actor, reduced ? 0 : clock); ctx.fighterEnd(); });`)
  .replace(ranks, `${ranks} ankleMotionRanks = ranks;`)
  .replace(initialize, `ankleMotionInitialize(sim, reset); ${initialize}`);
source += '\nlet ankleMotionActors, ankleMotionRanks; const ankleMotionScenery = () => {}; let ankleMotionInitialize = () => {}; export const setInitialize = fn => { ankleMotionInitialize = fn; }; export const capture = () => ({ actors: ankleMotionActors, ranks: ankleMotionRanks }); export { render, createArenaCamera, arenaRounds };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, capture, setInitialize } = module.exports;
const noop = () => {};
function context() {
  let currentId;
  const stack = [], eyeAlphas = new Map(), paintRecords = new Map(), actorOrder = [];
  const target = {
    globalAlpha: 1, fillStyle: '#000', eyeAlphas, paintRecords, actorOrder,
    measureText: value => ({ width: String(value).length * 8 }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    save() { stack.push({ alpha: target.globalAlpha, color: target.fillStyle }); },
    restore() { const saved = stack.pop(); if (saved) { target.globalAlpha = saved.alpha; target.fillStyle = saved.color; } },
    fighterStart(actor) {
      currentId = actor.candidate.id; eyeAlphas.set(currentId, []);
      paintRecords.set(currentId, { sequence: 0, palms: [], torsos: [] }); actorOrder.push(currentId);
    },
    fighterEnd() { currentId = undefined; },
    fillRect(_x, _y, width, height) {
      if (!currentId || target.globalAlpha <= 0) return;
      const record = paintRecords.get(currentId), sequence = record.sequence++;
      if (width === 5 && height === 4) record.palms.push({ sequence, alpha: target.globalAlpha });
      if (width >= 18 && width <= 20 && height === 23) record.torsos.push(sequence);
      if (target.fillStyle === '#172b37' && Math.abs(width - 1.8) < 1e-6) eyeAlphas.get(currentId).push(target.globalAlpha);
    },
  };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = points => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
const fixtures = [['backbodydrop', 16], ['scoopslam', 40], ['powerbomb', 4], ['clothesline', 19], ['spinebuster', 11]];


const ease = value => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };
function headClearance(point, rig, scale, padding = 2.5) {
  const center = midpoint(rig.headSides), dx = rig.headSides[1].x - rig.headSides[0].x, dy = rig.headSides[1].y - rig.headSides[0].y;
  const width = Math.hypot(dx, dy), side = { x: dx / width, y: dy / width }, offset = { x: point.x - center.x, y: point.y - center.y };
  const sign = side.x >= 0 ? 1 : -1, vertical = (-offset.x * side.y + offset.y * side.x) * sign;
  return (offset.x * side.x + offset.y * side.y) ** 2 / (width / 2 + padding * scale) ** 2
    + vertical ** 2 / ((vertical >= 0 ? 8 : 12) * scale + padding * scale) ** 2;
}
function segmentHeadClearance(from, to, rig, scale, padding) {
  let clearance = Infinity;
  for (let index = 0; index <= 32; index++) {
    const p = index / 32;
    clearance = Math.min(clearance, headClearance({ x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p }, rig, scale, padding));
  }
  return clearance;
}

for (const [kind, seed] of fixtures) for (const mirrored of [false, true]) for (const delta of [16, 50]) {
  test(`${kind} ${mirrored ? 'mirrored' : 'ordinary'} ${delta}ms: the ankle caster turns a front grip below its head`, () => {
    const order = ['2', '1'], duration = 44000, planned = arenaRounds(order, duration, 7, seed)[0];
    const props = { candidates: ['1', '2'].map(id => ({ id, name: id, color: '#ffad72' })), order, duration, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
    const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
    setInitialize((current, reset) => {
      if (current !== sim || !reset || !mirrored) return;
      for (const body of sim.bodies.values()) { body.x = 1000 - body.x; body.facing *= -1; body.vx = 0; body.vy = 0; body.motorX = 0; body.motorY = 0; body.animation = undefined; }
    });
    let held = 0, loading = 0, released = false, completed = false, minDepth = Infinity, maxDepth = -Infinity, previous;
    let frontPaints = 0, backPaints = 0, profilePaints = 0;
    for (let elapsed = 0; elapsed < 25000; elapsed += delta) {
      ctx.eyeAlphas.clear(); ctx.paintRecords.clear(); ctx.actorOrder.length = 0;
      render(ctx, props, elapsed, elapsed, sim, delta, false);
      const { actors, ranks } = capture(), caster = actors.get(planned.aggressor), victim = actors.get(planned.victim), exit = sim.exits.get(planned.victim);
      if (ranks[planned.victim]) { assert.deepEqual(ranks, { '1': 2, '2': 1 }); completed = true; break; }
      const rig = caster.animation.contactPoints, suspension = victim.spinSuspension;
      if (suspension?.planar && suspension.weight > 0 && !exit?.spinFlight) {
        loading += Number(suspension.weight < 1);
        const palms = rig.hands, feet = victim.animation.contactPoints.feet;
        for (let arm = 0; arm < 2; arm++) {
          assert.ok(headClearance(rig.elbows[arm], rig, caster.scale) >= 1, `${elapsed}: the elbow cannot fold through the painted head`);
          assert.ok(headClearance(palms[arm], rig, caster.scale) >= 1, `${elapsed}: a gripping palm cannot attach to its own head`);
          assert.ok(segmentHeadClearance(rig.shoulders[arm], rig.elbows[arm], rig, caster.scale, 2.8) >= 1, `${elapsed}: an upper arm cannot pass through the painted head`);
          assert.ok(segmentHeadClearance(rig.elbows[arm], palms[arm], rig, caster.scale, 2.5) >= 1, `${elapsed}: a forearm cannot wrap behind the painted head`);
          const gap = distance(palms[arm], feet[arm]);
          assert.ok(gap < 1, `${elapsed}: each physical palm keeps its original ankle slot throughout the loading arc (${gap.toFixed(3)}px)`);
          assert.ok(Math.abs(distance(rig.shoulders[arm], rig.elbows[arm]) - 11 * caster.scale) < .001);
          assert.ok(Math.abs(distance(rig.elbows[arm], palms[arm]) - 10.5 * caster.scale) < .001);
          const skeleton = victim.animation.skeleton;
          assert.ok(Math.abs(distance(skeleton.hips[arm], skeleton.knees[arm]) - 11) < .02, 'loading bends each normal thigh instead of stretching or compressing it');
          assert.ok(Math.abs(distance(skeleton.knees[arm], skeleton.feet[arm]) - 11) < .02, 'each normal shin reaches its own supporting palm');
        }
      }
      if (suspension?.planar && suspension.weight === 1 && !exit?.spinFlight) {
        held++;
        const palms = rig.hands;
        const shoulder = { x: rig.shoulders[1].x - rig.shoulders[0].x, y: rig.shoulders[1].y - rig.shoulders[0].y };
        const wrist = { x: palms[1].x - palms[0].x, y: palms[1].y - palms[0].y };
        const alignment = (shoulder.x * wrist.x + shoulder.y * wrist.y) / (Math.hypot(shoulder.x, shoulder.y) * Math.hypot(wrist.x, wrist.y));
        assert.ok(alignment > .5, `${elapsed}: both shoulder slots turn with the two held ankles instead of crossing the arms behind the head (alignment ${alignment.toFixed(3)})`);
        minDepth = Math.min(minDepth, shoulder.y); maxDepth = Math.max(maxDepth, shoulder.y);
        const expectedAlpha = ease((Math.sin(suspension.orbit) + .25) / .5), alphas = ctx.eyeAlphas.get(planned.aggressor) ?? [];
        if (expectedAlpha > 0) {
          assert.equal(alphas.length, 2, 'the loaded turn draws both eyes when the body faces the camera');
          assert.ok(alphas.every(alpha => Math.abs(alpha / caster.alpha - expectedAlpha) < .001), 'the actual face alpha follows the direction toward the held body');
        } else assert.equal(alphas.length, 0, 'the caster shows its back when its held body points away from the camera');
        const faceAlpha = alphas.length ? alphas[0] / caster.alpha : 0;
        const paint = ctx.paintRecords.get(planned.aggressor);
        assert.equal(paint.torsos.length, 1, 'the actual body rectangle separates rear and foreground arm painting');
        const before = paint.palms.filter(palm => palm.sequence < paint.torsos[0]);
        const after = paint.palms.filter(palm => palm.sequence > paint.torsos[0]);
        assert.equal(before.length, 2, `${elapsed}: both outside hand silhouettes remain opaque behind the body`);
        assert.ok(before.every(palm => Math.abs(palm.alpha - caster.alpha) < .001));
        if (faceAlpha === 0) {
          backPaints++;
          assert.equal(after.length, 0, `${elapsed}: a hand reaching away cannot be painted on top of the caster's back`);
        } else {
          if (faceAlpha === 1) frontPaints++; else profilePaints++;
          assert.equal(after.length, 1, 'only the nearer arm overlays the visible chest');
          assert.ok(Math.abs(after[0].alpha / caster.alpha - faceAlpha) < .001, 'the profile arm overlay fades with the actual painted face');
        }
        // Compare physical projected body direction and actual actor order;
        // this does not reuse the Scene's sin(orbit) depth expectation.
        const victimRig = victim.animation.contactPoints;
        const bodyDepth = midpoint(victimRig.headSides).y - midpoint(victimRig.feet).y;
        const groundDepth = victim.depthY - caster.depthY;
        if (Math.abs(bodyDepth) > 3 && Math.abs(groundDepth) > 3) {
          assert.ok(bodyDepth * groundDepth > 0, "the held body's projected depth agrees with its ground plane");
          const drawnAfter = ctx.actorOrder.indexOf(planned.victim) > ctx.actorOrder.indexOf(planned.aggressor);
          assert.equal(drawnAfter, bodyDepth > 0, 'the held body is painted on the same depth side as its actual projection');
        }
        if (bodyDepth > 20) assert.equal(faceAlpha, 1, 'the caster faces a body held toward the camera');
        if (bodyDepth < -20) assert.equal(faceAlpha, 0, 'the caster shows its back toward a body held away from the camera');
      }
      if (caster.carrierRelease) released = true;
      if (previous && (suspension?.planar || caster.carrierRelease)) {
        const joints = [...rig.shoulders, ...rig.elbows, ...rig.hands], limit = delta === 16 ? 22.4 : 53;
        assert.ok(joints.every((point, index) => distance(point, previous[index]) < limit), `${elapsed}: the loaded turn and hand opening keep continuous arm joints`);
      }
      previous = [...rig.shoulders, ...rig.elbows, ...rig.hands].map(point => ({ ...point }));
    }
    assert.ok(loading >= 5 && held >= 8 && minDepth < -5 && maxDepth > 5, 'the real loading arc precedes both front and rear depth halves');
    assert.ok(frontPaints > 2 && backPaints > 2 && profilePaints > 0, 'the real circle exercises front, back and a partially faded profile layer');
    assert.ok(released && completed, 'the physical turn, release and unchanged drawn result complete');
  });
}
