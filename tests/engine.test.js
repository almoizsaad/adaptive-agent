import test from 'node:test';
import assert from 'node:assert/strict';
import { run, SCENARIOS, MAX_REPLANS } from '../lib/engine.js';
const collect = async (scenario, mode) => { const out = []; for await (const e of run({ scenario: SCENARIOS[scenario], mode })) out.push(e); return out; };
const last = (a) => a[a.length - 1];

test('outage: adaptive switches source and succeeds; static fails silently', async () => {
  const a = await collect('outage', 'adaptive'), s = await collect('outage', 'static');
  assert.equal(last(a).status, 'success');
  assert.equal(a.find((e) => e.type === 'replan_triggered').plan.source, 'backup');
  assert.equal(last(s).status, 'failed'); assert.equal(last(s).reported, 'success');
});
test('constraint: adaptive downgrades option; static fails', async () => {
  const a = await collect('constraint', 'adaptive'), s = await collect('constraint', 'static');
  assert.equal(last(a).status, 'success');
  assert.equal(a.find((e) => e.type === 'replan_triggered').plan.option, 'economy');
  assert.equal(last(s).status, 'failed');
});
test('adversarial: low confidence rejected, replans capped, human approval requested', async () => {
  const a = await collect('adversarial', 'adaptive');
  assert.ok(a.some((e) => e.type === 'signal_rejected'));
  assert.ok(a.some((e) => e.type === 'needs_approval'));
  assert.equal(last(a).status, 'halted');
  assert.equal(a.filter((e) => e.type === 'replan_triggered').length, MAX_REPLANS);
});
test('every replan carries changed_mind_because', async () => {
  for (const sc of Object.keys(SCENARIOS)) for (const e of await collect(sc, 'adaptive'))
    if (e.type === 'replan_triggered') assert.match(e.changed_mind_because, /^changed my mind because/);
});
test('live injected signal is picked up at next step boundary', async () => {
  const queue = []; const out = [];
  for await (const e of run({ scenario: { signals: [] }, mode: 'adaptive', queue })) {
    out.push(e); if (e.type === 'step_ok' && e.msg === 'fetch_rate') queue.push({ patch: { budget: 600 }, confidence: 0.9, real: true, text: 'live budget cut' });
  }
  assert.ok(out.some((e) => e.type === 'replan_triggered')); assert.equal(last(out).status, 'success');
});
