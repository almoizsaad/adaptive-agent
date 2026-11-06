import { run, SCENARIOS } from '../../../lib/engine.js';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const runs = (globalThis.__runs ||= new Map());
export async function GET(req) {
  const name = new URL(req.url).searchParams.get('scenario') || 'outage';
  const scenario = SCENARIOS[name] || SCENARIOS.outage;
  const id = crypto.randomUUID(), queues = { adaptive: [], static: [] };
  runs.set(id, queues);
  const enc = new TextEncoder();
  const stream = new ReadableStream({ start(c) {
    const send = (o) => c.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
    (async () => {
      send({ type: 'start', runId: id });
      await Promise.all(['adaptive', 'static'].map(async (mode) => {
        for await (const e of run({ scenario, mode, queue: queues[mode], delay: 900 })) send(e);
      }));
      send({ type: 'end' }); runs.delete(id); c.close();
    })();
  } });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' } });
}
