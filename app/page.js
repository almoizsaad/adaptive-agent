'use client';
import { useRef, useState } from 'react';
const COLORS = { replan_triggered: '#f5a524', assumption_violated: '#f31260', signal_rejected: '#9aa0a6', needs_approval: '#7828c8', step_failed_silent: '#f31260', step_failed: '#f31260', done: '#17c964', halted: '#7828c8', signal: '#338ef7' };
export default function Page() {
  const [events, setEvents] = useState([]); const [runId, setRunId] = useState(null); const [busy, setBusy] = useState(false);
  const es = useRef(null);
  const start = (scenario) => {
    es.current?.close(); setEvents([]); setBusy(true);
    es.current = new EventSource(`/api/run?scenario=${scenario}`);
    es.current.onmessage = (m) => { const e = JSON.parse(m.data);
      if (e.type === 'start') setRunId(e.runId);
      else if (e.type === 'end') { es.current.close(); setBusy(false); }
      else setEvents((x) => [...x, e]); };
    es.current.onerror = () => { es.current.close(); setBusy(false); };
  };
  const inject = (kind) => fetch('/api/signal', { method: 'POST', body: JSON.stringify({ runId, kind }) });
  const col = (mode, title) => (
    <div style={{ flex: 1, minWidth: 320, background: '#181b22', borderRadius: 12, padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {events.filter((e) => e.mode === mode).map((e, k) => (
        <div key={k} style={{ borderInlineStart: `3px solid ${COLORS[e.type] || '#444'}`, padding: '4px 10px', margin: '6px 0', direction: 'ltr', textAlign: 'left', fontSize: 14 }}>
          <b style={{ color: COLORS[e.type] || '#aaa' }}>{e.type}</b> <span style={{ opacity: .6 }}>t{e.tick}</span><br />{e.msg}
        </div>))}
    </div>);
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <h1>وكيل متكيّف مع سجل الافتراضات</h1>
      <p style={{ opacity: .7 }}>نفس السيناريو يعمل على وكيلين في آن واحد: متكيّف (يتحقق من الافتراضات) وثابت (بلا تحقق).</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button disabled={busy} onClick={() => start('outage')}>انقطاع الخدمة</button>
        <button disabled={busy} onClick={() => start('constraint')}>تغيّر الشرط</button>
        <button disabled={busy} onClick={() => start('adversarial')}>اختبار الفشل (إشارات عدائية)</button>
        <button disabled={!busy} onClick={() => inject('outage')}>غيّر الواقع: أسقط الـ API</button>
        <button disabled={!busy} onClick={() => inject('budget')}>غيّر الواقع: اخفض الميزانية</button>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>{col('adaptive', 'الوكيل المتكيّف')}{col('static', 'الوكيل الثابت (baseline)')}</div>
    </main>);
}
