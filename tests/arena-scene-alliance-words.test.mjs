import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Keep the real frame loop, fighter shadows, and final headword painting.
// Skip static scenery so its rope markings cannot resemble alliance effects.
const require = createRequire(import.meta.url);
let source = await readFile('src/ArenaShow.tsx', 'utf8');
const draw = 'arenaDrawOrder([...actors.values()]).forEach(actor => drawArenaFighter(ctx, actor, reduced ? 0 : clock));';
assert.ok(source.includes(draw));
source = source.replaceAll('drawArenaScenery(ctx, clock,', 'allianceTestScenery(ctx, clock,')
  .replace(draw, `allianceTestActors = actors; allianceTestWords = words; ${draw}`);
source += '\nlet allianceTestActors, allianceTestWords; const allianceTestScenery = () => {}; export const capturedActors = () => allianceTestActors; export const capturedWords = () => allianceTestWords; export { render, createArenaCamera, arenaRounds, arenaAction };';
const bundle = await build({ stdin: { contents: source, resolveDir: `${process.cwd()}/src`, sourcefile: 'ArenaShow.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], loader: { '.css': 'empty' } });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
const { render, createArenaCamera, arenaRounds, arenaAction, capturedActors, capturedWords } = module.exports;
const noop = () => {};
const social = new Set(['이리 와!', '도와줘!', '갈게!', '같이 하자!', '좋아!']);
const order = ['1', '2', '3', '4', '5'];

function context() {
  let path = [], stack = [];
  const target = {
    fillStyle: '', strokeStyle: '', globalAlpha: 1,
    fills: [], strokes: [], labels: [],
    measureText: value => ({ width: value.length * 8 }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    save() { stack.push({ fillStyle: target.fillStyle, strokeStyle: target.strokeStyle, globalAlpha: target.globalAlpha }); },
    restore() { Object.assign(target, stack.pop()); },
    beginPath() { path = []; },
    ellipse(...args) { path.push({ kind: 'ellipse', args }); },
    moveTo(x, y) { path.push({ kind: 'move', x, y }); }, lineTo(x, y) { path.push({ kind: 'line', x, y }); },
    fill() { target.fills.push({ style: target.fillStyle, path: structuredClone(path) }); },
    stroke() { target.strokes.push({ style: target.strokeStyle, path: structuredClone(path) }); },
    fillText(value, x, y) { target.labels.push({ value, x, y }); },
    clear() { target.fills.length = 0; target.strokes.length = 0; target.labels.length = 0; },
  };
  return new Proxy(target, { get: (object, key) => key in object ? object[key] : noop, set: (object, key, value) => (object[key] = value, true) });
}

for (const tactic of ['team', 'betrayal']) test(`the live ${tactic} calls its ally above the painted head and retains ordinary shadows without ground relationship marks`, () => {
  const seed = Array.from({ length: 64 }, (_, seed) => seed).find(seed => arenaRounds(order, 44000, 7, seed)[0].tactic === tactic);
  assert.ok(Number.isInteger(seed), 'a normal numeric-id draw selects this alliance');
  const planned = arenaRounds(order, 44000, 7, seed)[0];
  const props = { candidates: order.map(id => ({ id, name: id, color: '#ffad72' })), order, duration: 44000, arenaRushRoll: 7, arenaEscapeSeed: seed, paused: false, preview: false };
  const sim = { key: '', elapsed: 0, epoch: 0, camera: createArenaCamera(), bodies: new Map(), contacts: new Map(), exits: new Map(), minis: new Map() }, ctx = context();
  const caller = tactic === 'team' ? planned.aggressor : planned.victim;
  let request = false, response = false, linked = false, attacking = false, walkingCall = false, failed = false, shadows = 0;
  for (let elapsed = 0; elapsed < planned.impact + 300; elapsed += 16) {
    ctx.clear(); render(ctx, props, elapsed, elapsed, sim, 16, false);
    const actual = sim.contacts.get(planned.id)?.round;
    if (!actual) continue;
    const action = arenaAction(actual, elapsed), actors = capturedActors(), words = capturedWords();
    if (tactic === 'betrayal' && action.stage === 'betrayal') {
      assert.equal(words.get(caller), '실패다!');
      const head = actors.get(caller).animation.contactPoints.head;
      assert.ok(ctx.labels.some(label => label.value === '실패다!' && Math.abs(label.x - head.x) < .001 && label.y <= head.y - 21));
      failed = true;
    }
    for (const [id, word] of words) {
      if (!social.has(word)) continue;
      assert.ok(['approach', 'link'].includes(action.stage), 'alliance conversation finishes before the technical attack');
      const actor = actors.get(id), head = actor.animation.contactPoints.head;
      const label = ctx.labels.find(label => label.value === word && Math.abs(label.x - head.x) < .001);
      assert.ok(label && label.y <= head.y - 21, `the actual ${word} is painted above its speaker's head`);
      walkingCall ||= actor.pose === 'walk';
      if (word === (tactic === 'team' ? '이리 와!' : '도와줘!')) { assert.equal(id, caller); request = true; }
      if (word === '갈게!') { assert.equal(id, planned.helper); response = true; }
      if (word === '같이 하자!') { assert.equal(id, caller); linked = true; }
    }
    if (action.stage === 'joint-attack' && [...words.values()].includes('던지기!')) attacking = true;
    assert.ok(ctx.strokes.every(stroke => !['#fff0b2', '#84ded1', '#fa8c7a'].includes(stroke.style)), 'no alliance line, arrow or broken-link marker is stroked');
    assert.ok(ctx.strokes.every(stroke => !stroke.path.some(part => part.kind === 'ellipse' && part.args[2] === 31 && part.args[3] === 8)), 'the colored ground rings are absent');
    shadows += ctx.fills.filter(fill => fill.style === '#25302d40' && fill.path.some(part => part.kind === 'ellipse')).length;
  }
  assert.ok(request && response && linked && attacking && walkingCall, JSON.stringify({ tactic, seed, request, response, linked, attacking, walkingCall }));
  if (tactic === 'betrayal') assert.ok(failed, 'breaking the alliance visibly calls its failure');
  assert.ok(shadows > 5, 'the fighters keep their normal floor shadows');
});
