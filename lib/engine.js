// Adaptive agent core: explicit, inspectable code (no hidden logic). Zero dependencies.
export const THRESHOLD = 0.6;   // min confidence for a signal to be able to trigger a replan
export const MAX_REPLANS = 2;   // governance: beyond this a human must approve
export const COST = { premium: 900, economy: 400 };
export const STEPS = ['fetch_rate', 'select_option', 'reserve', 'book'];
export const initialWorld = () => ({ up: { primary: true, backup: true }, budget: 1000 });
const merge = (w, p) => ({ ...w, ...p, up: { ...w.up, ...(p.up || {}) } });

// Assumption Registry: each assumption is checkable code, tied to the step it affects.
export const ASSUMPTIONS = [
  { id: 'A1', text: 'selected rates source is available', step: 0, holds: (b, p) => b.up[p.source] },
  { id: 'A2', text: 'budget covers the selected option', step: 1, holds: (b, p) => COST[p.option] <= b.budget },
];
export const buildPlan = (b) => {
  const source = b.up.primary ? 'primary' : b.up.backup ? 'backup' : null;
  const option = COST.premium <= b.budget ? 'premium' : COST.economy <= b.budget ? 'economy' : null;
  return source && option ? { source, option } : null;
};
const snapshot = (b, p, tick) => ASSUMPTIONS.map((a) => ({
  id: a.id, assumption: a.text, evidence: JSON.stringify({ up: b.up, budget: b.budget }),
  confidence: a.holds(b, p) ? 0.9 : 0.1, last_validated: tick }));

const OUTAGE = { patch: { up: { primary: false } }, confidence: 0.95, real: true, text: 'primary rates API went down' };
const BUDGET = { patch: { budget: 600 }, confidence: 0.9, real: true, text: 'budget was cut to 600' };
export const LIVE_SIGNALS = { outage: OUTAGE, budget: BUDGET };
export const SCENARIOS = {
  outage: { title: 'Service outage', signals: [{ ...OUTAGE, at: 0 }] },
  constraint: { title: 'Changed constraint', signals: [{ ...BUDGET, at: 2 }] },
  adversarial: { title: 'Failure test: hostile signals', signals: [
    { at: 1, patch: { budget: 0 }, confidence: 0.35, real: false, text: 'unverified claim: budget is 0' },
    { at: 2, patch: { up: { primary: false } }, confidence: 0.8, real: false, text: 'claim: primary down (false)' },
    { at: 4, patch: { up: { primary: true, backup: false } }, confidence: 0.8, real: false, text: 'claim: backup down (false)' },
    { at: 6, patch: { up: { primary: false, backup: true } }, confidence: 0.8, real: false, text: 'claim: flip-flop again (false)' } ] },
};

export async function* run({ scenario, mode, queue = [], delay = 0 }) {
  const sleep = () => (delay ? new Promise((r) => setTimeout(r, delay)) : null);
  let truth = initialWorld(), belief = initialWorld(), plan = buildPlan(belief);
  let replans = 0, ticks = 0, i = 0, failed = false;
  const pending = [...scenario.signals];
  const ev = (type, msg, extra = {}) => ({ mode, tick: ticks, type, msg, replans, ...extra });
  yield ev('plan', `plan: source=${plan.source}, option=${plan.option}`, { plan, assumptions: snapshot(belief, plan, ticks) });
  while (i < STEPS.length) {
    await sleep();
    const due = [...pending.filter((s) => s.at <= ticks), ...queue.splice(0)];
    due.forEach((s) => { const k = pending.indexOf(s); if (k >= 0) pending.splice(k, 1); });
    for (const s of due) {
      if (s.real) truth = merge(truth, s.patch);            // reality changes regardless of the agent
      yield ev('signal', s.text, { confidence: s.confidence });
      if (mode !== 'adaptive') continue;
      const next = merge(belief, s.patch);
      const violated = ASSUMPTIONS.filter((a) => a.holds(belief, plan) && !a.holds(next, plan));
      if (!violated.length) { belief = next; yield ev('assumption_ok', 'no assumption contradicted'); continue; }
      if (s.confidence < THRESHOLD) { yield ev('signal_rejected', `confidence ${s.confidence} < ${THRESHOLD}: ignored`); continue; }
      yield ev('assumption_violated', violated.map((a) => `${a.id}: ${a.text}`).join('; '), { violated: violated.map((a) => a.id) });
      const np = buildPlan(next);
      if (replans >= MAX_REPLANS || !np) {
        yield ev('needs_approval', replans >= MAX_REPLANS ? `replan limit (${MAX_REPLANS}) reached: human approval required` : 'no feasible plan: human approval required');
        yield ev('halted', 'halted safely', { status: 'halted' }); return;
      }
      belief = next; replans++;
      const because = `changed my mind because: ${s.text} (${violated.map((a) => a.id).join(',')})`;
      yield ev('replan_triggered', `${because} -> source=${np.source}, option=${np.option}`, { changed_mind_because: because, plan: np, assumptions: snapshot(belief, np, ticks) });
      plan = np; i = Math.min(...violated.map((a) => a.step));
    }
    const action = STEPS[i];
    const ok = action === 'fetch_rate' ? truth.up[plan.source] : action === 'book' ? COST[plan.option] <= truth.budget : true;
    ticks++;
    if (ok) yield ev('step_ok', action);
    else if (mode === 'adaptive') { yield ev('step_failed', `${action} failed`); yield ev('done', 'failed', { status: 'failed' }); return; }
    else { failed = true; yield ev('step_failed_silent', `${action} failed (not detected)`); }
    i++;
  }
  yield ev('done', mode === 'static' ? 'reports: completed' : 'completed', { status: failed ? 'failed' : 'success', reported: 'success' });
}
