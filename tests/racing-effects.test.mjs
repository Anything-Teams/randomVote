import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function source(path) {
  const result = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { buildRacingTimeline, createRacingIncidents, readRacingDistance, racingStandings, racingTrickLoss, RACING_STORIES } = await source('src/racingNarrative.ts');
const { createRacingCamera, placeRacingField } = await source('src/racingCamera.ts');
const { racingIncidentMotion, placeRacingDuel, placeRacingTrick, racingTrickMotion, racingTrickProjectile } = await source('src/racingEffects.ts');
const { raceHorseAttachments, drawRaceHorse } = await source('src/racingArt.ts');
const players = Array.from({ length: 10 }, (_, index) => ({ id: String(index), name: `선수 ${index}`, color: '#abcdef' }));

test('a reversed ten-horse field overtakes gradually without a late speed surge', () => {
  for (let count = 2; count <= 10; count++) for (let seed = 0; seed <= 20; seed++) {
    const list = players.slice(0, count), order = list.map(player => player.id).reverse();
    const timeline = buildRacingTimeline(list, order, 44_000, seed ? createRacingIncidents(list, order, 44_000, seed) : []);
    assert.equal(timeline.finish, 39_000, 'extending duels must preserve one lap and the result time');
    assert.ok(timeline.finish - timeline.straight.start >= 7000);
    const pace = 1 / (timeline.finish - timeline.start);
    for (const player of list) for (let at = timeline.straight.start; at < timeline.finish - 16; at += 16) {
      const speed = (readRacingDistance(timeline, player.id, at + 16) - readRacingDistance(timeline, player.id, at)) / 16;
      assert.ok(speed >= pace * .5 && speed <= pace * 1.5, `sudden late surge: ${count}/${seed}/${player.id}/${at}: ${speed / pace}`);
    }
  }
});

test('the camera keeps every named horse visible throughout the live race on small and large screens', () => {
  for (const [width, height] of [[320, 180], [960, 540]]) for (let count = 2; count <= 10; count++) {
    const list = players.slice(0, count), order = list.map(player => player.id).reverse();
    const timeline = buildRacingTimeline(list, order, 44_000, createRacingIncidents(list, order, 44_000, count));
    const camera = createRacingCamera();
    for (let at = timeline.start; at <= 41_000; at += 16) {
      for (const horse of placeRacingField(camera, list, timeline, at, width, height, 16)) {
        assert.ok(horse.x <= width && horse.x - 109 * horse.scale >= 0, `offscreen horse: ${width}/${count}/${horse.id}/${at}`);
      }
    }
  }
});

test('racing tactics and obstacle jumps animate the correct bodies smoothly', () => {
  const base = { actorId: '0', rivalId: '1', start: 10_000, end: 15_500, beforeOrder: ['1', '0'], waitingOrder: ['1', '0'], afterOrder: ['0', '1'] };
  for (const { kind } of RACING_STORIES) {
    const incident = { ...base, kind };
    let activeFrames = 0;
    for (const id of ['0', '1', '2']) {
      let previous = {};
      for (let at = incident.start - 16; at <= incident.end + 16; at += 16) {
        const motion = racingIncidentMotion(incident, id, at);
        assert.deepEqual(racingIncidentMotion(incident, id, at), motion, 'pause and seek must reproduce the same pose');
        assert.deepEqual(racingIncidentMotion(incident, id, at, true), {});
        if (!['hay-jump', 'puddle'].includes(kind)) assert.equal(motion.jump, undefined, 'only a visible course obstacle asks a horse to leap');
        assert.equal(motion.kick, undefined, 'horses race through gaps instead of attacking rivals');
        const rivalResponds = ['gust', 'blocked', 'draft', 'lead-change', 'inside', 'outside', 'rail', 'chase', 'last-kick', 'patience'].includes(kind);
        if (id === '2' || id === '1' && !rivalResponds) assert.deepEqual(motion, {});
        for (const key of new Set([...Object.keys(previous), ...Object.keys(motion)])) {
          const current = motion[key] ?? 0, prior = previous[key] ?? 0;
          assert.ok(Number.isFinite(current) && Math.abs(current) <= 1);
          assert.ok(Math.abs(current - prior) < .08, `body action popped: ${kind}/${id}/${at}/${key}`);
          if (current > .2) activeFrames++;
        }
        previous = motion;
      }
    }
    assert.ok(activeFrames > 20, `${kind} must visibly change a body`);
    assert.deepEqual(racingIncidentMotion(incident, '0', incident.start - 1), {});
    assert.deepEqual(racingIncidentMotion(incident, '0', incident.end + 1), {});
  }
});

test('opponents close the lane, respond to a pass, and separate without changing race distances', () => {
  const base = [{ id: '0', x: 340, y: 290, scale: 1, distance: .5 }, { id: '1', x: 390, y: 420, scale: 1, distance: .505 }, { id: '2', x: 310, y: 350, scale: 1, distance: .497 }];
  for (const kind of ['blocked', 'draft', 'lead-change', 'inside', 'outside', 'rail', 'chase', 'last-kick', 'patience']) {
    const incident = { kind, actorId: '0', rivalId: '1', start: 10_000, end: 15_500, beforeOrder: ['1', '0', '2'], waitingOrder: ['1', '0', '2'], afterOrder: ['0', '1', '2'] };
    let previous = base;
    for (let at = 9984; at <= 15_516; at += 16) {
      const next = placeRacingDuel(incident, base, [], at);
      for (let i = 0; i < next.length; i++) {
        assert.equal(next[i].x, base[i].x, 'a defensive line never fabricates progress');
        assert.equal(next[i].distance, base[i].distance);
        assert.ok(Math.abs(next[i].y - previous[i].y) < 2, 'approach and release remain smooth');
      }
      assert.deepEqual(next[2], base[2], 'unrelated racers keep their lane');
      previous = next;
    }
    const joined = placeRacingDuel(incident, base, [], 12_000);
    assert.ok(Math.abs(joined[0].y - joined[1].y) < 50, 'the defence and attempted pass occur together on screen');
    assert.ok(racingIncidentMotion(incident, '0', 11_600).check > .6 || racingIncidentMotion(incident, '0', 13_700).crouch > .6);
    assert.ok(racingIncidentMotion(incident, '1', 13_800).crouch > .5, 'the defending rider responds to the attack');
    assert.deepEqual(placeRacingDuel(incident, base, [], incident.end), base);
  }
});


function recordingContext() {
  let matrix = [1, 0, 0, 1, 0, 0], stack = [], lines = [], arcs = [], points = [];
  const transform = (x, y) => ({ x: matrix[0] * x + matrix[2] * y + matrix[4], y: matrix[1] * x + matrix[3] * y + matrix[5] });
  const ctx = { globalAlpha: 1, strokeStyle: '', lineWidth: 1,
    save() { stack.push({ matrix: [...matrix], strokeStyle: this.strokeStyle, lineWidth: this.lineWidth, globalAlpha: this.globalAlpha }); },
    restore() { const state = stack.pop(); matrix = state.matrix; Object.assign(this, { strokeStyle: state.strokeStyle, lineWidth: state.lineWidth, globalAlpha: state.globalAlpha }); },
    translate(x, y) { matrix[4] += matrix[0] * x + matrix[2] * y; matrix[5] += matrix[1] * x + matrix[3] * y; },
    scale(x, y) { matrix[0] *= x; matrix[1] *= x; matrix[2] *= y; matrix[3] *= y; },
    rotate(angle) { const [a, b, c, d] = matrix, co = Math.cos(angle), si = Math.sin(angle); matrix[0] = a * co + c * si; matrix[1] = b * co + d * si; matrix[2] = c * co - a * si; matrix[3] = d * co - b * si; },
    beginPath() { points = []; }, moveTo(x, y) { points.push(transform(x, y)); }, lineTo(x, y) { points.push(transform(x, y)); },
    stroke() { if (points.length === 2) lines.push({ points: [...points], color: this.strokeStyle, width: this.lineWidth }); },
    arc(x, y, radius) { arcs.push({ ...transform(x, y), radius }); },
    createLinearGradient() { return { addColorStop() {} }; },
    fill() {}, fillRect() {}, closePath() {}, roundRect() {}, bezierCurveTo() {}, quadraticCurveTo() {}, ellipse() {}, fillText() {},
  };
  return { ctx, lines, arcs };
}

function physicalField(timeline, list, elapsed, width = 960, height = 540) {
  const raw = placeRacingField(createRacingCamera(), list, timeline, elapsed, width, height, 0, true).map(item => ({ ...item, x: item.x - 57 * item.scale }));
  const trick = timeline.tricks.find(item => elapsed >= item.start && elapsed < item.recovered);
  const field = placeRacingTrick(trick, raw, elapsed);
  return field.map(item => {
    const motion = racingTrickMotion(trick, item.id, elapsed, field), phase = item.distance * 62 + item.index * .193;
    const effort = Math.max(.45, Math.min(1.35, (item.distance - readRacingDistance(timeline, item.id, elapsed - 100)) * 335));
    const attachments = raceHorseAttachments(item.index, elapsed, effort, false, { phase, ...motion });
    const world = point => ({ x: item.x + point.x * item.scale, y: item.y + point.y * item.scale });
    return { ...item, effort, phase, motion, hand: world(attachments.hand), helmet: world(attachments.helmet), boot: world(attachments.boot) };
  });
}

test('rear kicks and landed beanbags slow actual travel and lose ground before recovery without changing the result', () => {
  let rankLosses = 0;
  for (const count of [2, 10]) for (let seed = 0; seed < 20; seed++) {
    const list = players.slice(0, count), order = list.map(player => player.id).reverse();
    const timeline = buildRacingTimeline(list, order, 44_000, createRacingIncidents(list, order, 44_000, seed));
    assert.deepEqual(timeline.tricks.map(item => item.kind), ['rear-kick', 'beanbag']);
    const noTricks = { ...timeline, tricks: [] };
    for (const trick of timeline.tricks) {
      assert.notEqual(trick.actorId, trick.targetId);
      if (trick.kind === 'beanbag') {
        assert.ok(trick.start > timeline.obstacles[0].recovered, 'the complete throw starts after the first course accident resolves');
        assert.ok(trick.recovered < timeline.obstacles[1].encounter, 'stun and recovery finish before the next hurdle approaches');
      }
      const actorDistance = readRacingDistance(timeline, trick.actorId, trick.impact), targetDistance = readRacingDistance(timeline, trick.targetId, trick.impact);
      assert.ok(trick.kind === 'rear-kick' ? actorDistance > targetDistance : actorDistance < targetDistance, 'a back kick targets behind and a thrown bag targets a rider ahead');
      const at = (trick.impact + trick.lowest) / 2, speed = (plan, time) => (readRacingDistance(plan, trick.targetId, time + 8) - readRacingDistance(plan, trick.targetId, time - 8)) / 16;
      assert.ok(speed(timeline, at) < speed(noTricks, at) * .6, 'a hit changes speed instead of only drawing stars');
      assert.equal(racingTrickLoss(trick, trick.lowest), trick.loss);
      const before = racingStandings(timeline, trick.impact).find(item => item.id === trick.targetId).rank, after = racingStandings(timeline, trick.lowest).find(item => item.id === trick.targetId).rank;
      if (after > before) rankLosses++;
      assert.equal(racingTrickLoss(trick, trick.recovered), 0);
    }
    for (const player of list) {
      let prior = 0;
      for (let at = timeline.start; at <= 44_000; at += 16) { const current = readRacingDistance(timeline, player.id, at); assert.ok(current >= prior - 1e-9, 'combined tricks, hurdles and checks never reverse a horse'); prior = current; }
    }
    assert.deepEqual(racingStandings(timeline, 44_000).map(item => item.id), order);
  }
  assert.ok(rankLosses > 20, 'the attacks produce visible overtakes');
});

test('a rear kick uses the painted rival boot as its target and the painted hoof reaches it at contact', () => {
  for (const count of [2, 10]) for (let seed = 0; seed < 20; seed++) for (const [width, height] of [[320, 180], [960, 540]]) {
    const list = players.slice(0, count), order = list.map(player => player.id).reverse();
    const timeline = buildRacingTimeline(list, order, 44_000, createRacingIncidents(list, order, 44_000, seed)), kick = timeline.tricks[0];
    const field = physicalField(timeline, list, kick.impact, width, height), actor = field.find(item => item.id === kick.actorId), target = field.find(item => item.id === kick.targetId);
    const motion = racingTrickMotion(kick, actor.id, kick.impact, field);
    assert.equal(motion.kick, 1);
    assert.ok(motion.kickX < -14 && motion.kickX > -72, 'the rival boot is physically behind the rump within hind-leg reach');
    const recording = recordingContext();
    drawRaceHorse(recording.ctx, list[actor.index], actor.index, actor.x, actor.y, actor.scale, kick.impact, actor.effort, false, false, 0, { phase: actor.phase, ...motion });
    const hoof = recording.lines.filter(line => line.color === '#17202b' && line.width === 3.8).at(-2);
    const a = hoof.points[0], b = hoof.points[1];
    assert.ok(target.boot.x >= Math.min(a.x, b.x) && target.boot.x <= Math.max(a.x, b.x), 'the drawn hind hoof overlaps the opponent boot at the hit');
    assert.ok(Math.abs(target.boot.y - a.y) <= actor.scale * 1.01, 'the same painted depth and elevation determine contact');
    const hip = recording.lines.find(line => line.color && line.width === 6.2).points[0];
    assert.ok(Math.hypot(target.boot.x - hip.x, target.boot.y - hip.y) < 43 * actor.scale, 'contact never stretches a rear leg beyond the joint chain');
  }
});

test('a beanbag leaves the actual painted hand and lands on the actual helmet, with no unrelated rider reaction', () => {
  for (const count of [2, 10]) for (let seed = 0; seed < 12; seed++) {
    const list = players.slice(0, count), order = list.map(player => player.id).reverse();
    const timeline = buildRacingTimeline(list, order, 44_000, createRacingIncidents(list, order, 44_000, seed)), toss = timeline.tricks[1];
    const released = physicalField(timeline, list, toss.release), contact = physicalField(timeline, list, toss.impact);
    const start = racingTrickProjectile(toss, released, toss.release), end = racingTrickProjectile(toss, contact, toss.impact);
    const hand = released.find(item => item.id === toss.actorId).hand, helmet = contact.find(item => item.id === toss.targetId).helmet;
    assert.ok(Math.hypot(start.x - hand.x, start.y - hand.y) < 1e-9);
    assert.ok(Math.hypot(end.x - helmet.x, end.y - helmet.y) < 1e-9);
    let previous;
    for (let elapsed = toss.release; elapsed <= toss.impact; elapsed += 16) {
      const field = physicalField(timeline, list, elapsed), ball = racingTrickProjectile(toss, field, elapsed);
      if (previous) assert.ok(Math.hypot(ball.x - previous.x, ball.y - previous.y) < 12, 'flight stays continuous while horses and camera move');
      previous = ball;
    }
    for (const item of contact) if (![toss.actorId, toss.targetId].includes(item.id)) assert.deepEqual(racingTrickMotion(toss, item.id, toss.impact + 500, contact), {});
    assert.ok(racingTrickMotion(toss, toss.targetId, toss.impact + 500, contact).stun > .8);
    assert.deepEqual(racingTrickMotion(toss, toss.targetId, toss.impact + 500, contact, true), {});
  }
});

test('rider attachment geometry agrees with the painted hands and boot through throwing, stun, and falling', () => {
  const motions = [{}, { toss: 1, tossRelease: 0 }, { toss: 1, tossRelease: .5 }, { toss: .7, tossRelease: 1 }, { stun: 1, check: .94 }, { fall: 1, spill: 1, trip: .8 }, { fall: .45, spill: .45, slip: .5 }];
  for (let index = 0; index < 6; index++) for (const motion of motions) {
    const pose = raceHorseAttachments(index, 1234, .9, false, motion), recording = recordingContext();
    drawRaceHorse(recording.ctx, players[index], index, 0, 0, 1, 1234, .9, false, false, 0, motion);
    const hand = recording.arcs.filter(arc => arc.radius === 1.8).at(-1);
    assert.ok(Math.hypot(pose.hand.x - hand.x, pose.hand.y - hand.y) < 1e-9, 'physics never guesses a different hand position');
    const boot = recording.lines.find(line => line.color === '#142135' && line.width === 3.8);
    const a = boot.points[0], b = boot.points[1], cross = (pose.boot.x - a.x) * (b.y - a.y) - (pose.boot.y - a.y) * (b.x - a.x);
    assert.ok(Math.abs(cross) < 1e-8, 'the attachment lies on the actual painted rider boot');
  }
});


test('trick windup, contact, stunned posture and recovery remain continuous through live frames', () => {
  for (const count of [2, 10]) {
    const list = players.slice(0, count), order = list.map(player => player.id).reverse();
    const timeline = buildRacingTimeline(list, order, 44_000, createRacingIncidents(list, order, 44_000, 3));
    for (const trick of timeline.tricks) for (const id of [trick.actorId, trick.targetId]) {
      let previous = {}, previousY;
      for (let elapsed = trick.start - 16; elapsed < trick.recovered + 16; elapsed += 16) {
        const field = physicalField(timeline, list, elapsed), motion = racingTrickMotion(trick, id, elapsed, field);
        for (const key of ['kick', 'check', 'toss', 'stun', 'stumble', 'crouch']) assert.ok(Math.abs((motion[key] ?? 0) - (previous[key] ?? 0)) < .13, `pose jumped: ${trick.kind}/${key}/${elapsed}`);
        const y = field.find(item => item.id === id).y;
        if (previousY !== undefined) assert.ok(Math.abs(y - previousY) < 3, 'joining and leaving the shared lane stays smooth');
        previous = motion; previousY = y;
      }
    }
  }
});
