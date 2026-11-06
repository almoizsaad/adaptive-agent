# Adaptive Agent (Assumption Registry)
plan -> execute one step -> observe -> validate against explicit assumptions -> replan only on real contradiction.
- `lib/engine.js`: engine (assumptions, validator, replan, guardrails: confidence threshold, MAX_REPLANS, human approval)
- `/api/run`: SSE stream running adaptive + static baseline side by side; `/api/signal` injects live changes
- `npm test` runs scenario tests; `npm run dev` runs the demo
Out of scope: LLM planner (planning is deterministic code so it is inspectable); live-signal queue is in-memory (use Redis/Neon for multi-instance).
