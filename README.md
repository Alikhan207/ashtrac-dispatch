# Ashtrac Dispatch

An AI dispatch agent built on CALL-E: calls real service providers about an
urgent need, adapts when one says no, and stops at the first confirmed yes
with a price and ETA.

**Need → Find → Call → Check → Adapt → Confirm**

This repo has two halves that talk to each other over HTTP:

```
backend/    Python FastAPI service — places real CALL-E calls
frontend/   React + Vite UI (built in Lovable) — polls the backend, renders the live loop
```

## Quick start (run both, in two terminals)

**Terminal 1 — backend:**
```bash
cd backend
pip install -r requirements.txt
cp providers.example.json providers.json   # fill in real, authorized phone numbers
export CALLE_API_KEY="iams_live_..."
uvicorn ashtrac_dispatch.api:app --reload --port 8000
```

**Terminal 2 — frontend:**
```bash
cd frontend
npm install
echo "VITE_API_BASE_URL=http://localhost:8000" > .env
npm run dev
```
If `npm run dev` fails to bind with `EAFNOSUPPORT`, edit `vite.config.ts` and
change `host: "::"` to `host: "localhost"`.

Then open the printed local URL, submit a real need, and watch the live
dispatch loop.

## Status

- ✅ Backend: 6/6 tests passing (integration + unit tests in `backend/tests/`)
- ✅ Backend: Real HTTP request cycle verified (POST → background thread → GET polling)
- ✅ CALL-E Integration: Authenticated and placing calls via the CALL-E Python SDK
- ✅ Frontend: `npm run build` succeeds with zero errors
- ✅ End-to-End: Full adaptive loop (Need → Find → Call → Check → Adapt → Confirm) verified live in browser

## Full details

See `backend/README.md` for the dispatch loop's design rationale (why the
Calls API over Goal Runs, why sequential waves, why `unknown` is a
first-class outcome) and the API contract.
