import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/sports.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createSportsOrder } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const participants = Array.from({ length: 10 }, (_, index) => ({ id: `player-${index}`, name: `선수 ${index}`, color: '#f9d56e' }));

test('every possible draw path gives a distinct ranking with equal chances at each position', () => {
  const results = [];
  function visit(choices, limit) {
    if (limit === 1) {
      let offset = 0;
      results.push(createSportsOrder(participants.slice(0, 5), () => choices[offset++]));
      return;
    }
    for (let choice = 0; choice < limit; choice++) visit([...choices, choice], limit - 1);
  }
  visit([], 5);
  assert.equal(results.length, 120);
  assert.equal(new Set(results.map(order => order.join(','))).size, 120);
  for (let rank = 0; rank < 5; rank++) {
    for (const player of participants.slice(0, 5)) assert.equal(results.filter(order => order[rank] === player.id).length, 24);
  }
});

test('2–10 participants each appear once and input order is left unchanged', () => {
  for (let size = 2; size <= 10; size++) {
    const list = participants.slice(0, size);
    const before = list.map(player => player.id);
    const order = createSportsOrder(list);
    assert.deepEqual([...order].sort(), [...before].sort());
    assert.deepEqual(list.map(player => player.id), before);
  }
  assert.throws(() => createSportsOrder(participants.slice(0, 1)), RangeError);
  assert.throws(() => createSportsOrder([participants[0], participants[0]]), RangeError);
});

test('the production shuffle rejects the extra random range instead of favoring input positions', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const samples = [0xffffffff, 0, 1];
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: values => { values[0] = samples.shift(); return values; } } });
  try {
    assert.deepEqual(createSportsOrder(participants.slice(0, 3)), ['player-2', 'player-1', 'player-0']);
    assert.equal(samples.length, 0);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete globalThis.crypto;
  }
});
