import { LIVE_SIGNALS } from '../../../lib/engine.js';
export async function POST(req) {
  const { runId, kind } = await req.json();
  const q = (globalThis.__runs || new Map()).get(runId), sig = LIVE_SIGNALS[kind];
  if (!q || !sig) return Response.json({ ok: false }, { status: 404 });
  q.adaptive.push({ ...sig }); q.static.push({ ...sig });   // same real-world change for both agents
  return Response.json({ ok: true });
}
