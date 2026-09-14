# Ashtrac Dispatch

An AI dispatch agent built on [CALL-E](https://docs.heycall-e.com/): it calls
real service providers about a stated need, adapts to the next provider when
one says no, and stops at the first confirmed "yes" with a price and ETA.

**Need → Find → Call → Check → Adapt → Compare → Confirm**

This is real, tested code against the actual `calle-ai==0.7.0` SDK -- not a
mockup. `tests/test_dispatch.py` verifies the adaptive loop logic with a fake
client (no call credits spent); the CLI places real calls when you're ready.

## What's here

```
ashtrac_dispatch/
  __init__.py       -- public API
  schemas.py         -- the CALL-E result_schema for a provider call
  providers.py        -- provider shortlist loading + category classification
  dispatch.py         -- the core adaptive loop (this is the heart of the project)
  cli.py               -- command-line entry point
tests/
  test_dispatch.py      -- unit tests using a fake CALL-E client
providers.example.json  -- template for your real provider shortlist
requirements.txt
.env.example
```

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Get a CALL-E API key from https://dashboard.heycall-e.com/account/api-keys
   (new accounts get 20 free calls under the hackathon rules), and set it:
   ```bash
   export CALLE_API_KEY="iams_live_..."
   ```

3. Copy the provider template and fill in **real phone numbers you own or
   are authorized to call** -- CALL-E's terms require this, and it's also
   just the right thing to do. For your demo, the safest option is numbers
   you or your teammate control (e.g. your own phone as "Provider A", your
   teammate's as "Provider B"), so the demo is reliable and nobody's
   time is used without consent:
   ```bash
   cp providers.example.json providers.json
   # edit providers.json with real E.164 numbers, e.g. "+919876543210"
   ```

## Run the tests (no real calls, no credits spent)

```bash
python -m pytest tests/test_dispatch.py -v
```

This proves the adaptive loop actually works -- adapts on "no", treats a
`null` structured result as "unknown" rather than silently failing, and
stops calling once a provider confirms -- independent of the network or
your call budget.

## Run the real demo

```bash
python -m ashtrac_dispatch.cli --need "The plaster on my wall is falling off and my usual contact isn't answering"
```

This will:
1. Classify the need into a category (see `CATEGORY_KEYWORDS` in `providers.py`)
2. Pull a shortlist from `providers.json`
3. Call the first provider via CALL-E, in a real phone call, asking about
   availability, ETA, and price
4. If they say no (or the call is ambiguous/unanswered), automatically call
   the next provider -- this is the moment worth recording for your demo video
5. Stop at the first confirmed "yes" and print the result

Useful flags: `--category home_repair` to skip classification,
`--max-providers 2` to limit how many you call, `-v` for debug logs.

## Why it's built this way (for your "How we built it" writeup)

- **One-shot Calls API, not Goal Runs.** Goal Runs are for a fixed,
  pre-published script run against different phone numbers. Every provider
  call here needs task text specific to *this* user's situation, so the
  Calls API (`client.calls.create_and_wait`) is the correct fit, per the
  docs' own guidance on when to use each.
- **Sequential waves, not parallel dispatch.** The Calls API has no
  "cancel in flight" operation. If we called every provider at once and
  took the first "yes", we could pay for calls that are no longer needed
  once one provider confirms. So `dispatch()` calls one provider, waits for
  its terminal result, and only calls the next if the first wasn't a
  confirmed yes. This is also *exactly* what produces the "Provider 1 says
  no → Ashtrac immediately calls Provider 2" moment for the demo.
- **`unknown` is a first-class outcome, not an error.** `structured_result`
  comes back `null` whenever CALL-E can't extract a schema-valid result
  (no answer, ambiguous response). The code treats `null` the same as an
  explicit `"unknown"` -- never as a "no" and never as a crash -- so a bad
  call doesn't wrongly rule out a provider or silently break the loop.
- **Idempotency keys per (request, provider).** Every call is created with
  `ashtrac:{request_id}:{provider_id}` as its idempotency key, so retrying
  a request during a flaky demo can't accidentally place a duplicate call
  to the same provider.

## Running the API (for the Lovable/React frontend)

A FastAPI backend (`ashtrac_dispatch/api.py`) wraps `call_provider()` --
the same function the CLI and the tests use -- so there is exactly one
implementation of "how we talk to CALL-E", not a second copy for the API.

```bash
export CALLE_API_KEY="iams_live_..."
uvicorn ashtrac_dispatch.api:app --reload --port 8000
```

Endpoints (this is the exact contract the frontend's `src/lib/dispatch/api.ts`
already expects -- no frontend changes needed):

- `POST /api/dispatch` `{"need_text": "..."}` -> `{"request_id": "..."}`
- `GET /api/dispatch/{request_id}` -> live status, polled by the frontend
  every ~2.5s; `attempts[i].status` is `"queued" | "calling" | "completed"`,
  and `winner` is `null` until a provider confirms.
- `GET /api/health` -> `{"ok": true}`

Point the frontend at it by setting, in the frontend project:
```
VITE_API_BASE_URL=http://localhost:8000
```
(Without this env var, the frontend runs in its own built-in simulation
mode -- useful for UI development, but it isn't placing real calls.)

Run `python -m pytest tests/ -v` to check both the dispatch loop and the
API contract (6 tests total) before wiring the real frontend to it --
`tests/test_api.py` verifies the exact HTTP shape the frontend consumes,
using a fake CALL-E client so it costs no call credits.

## Extending this after the hackathon

- Replace `providers.json` with a real business-directory lookup in
  `providers.py` (`shortlist_for_category`).
- Replace the keyword `classify_need` with an LLM call if you want broader
  category coverage -- keep it as ordinary application logic outside the
  CALL-E call itself.
- Add a second CALL-E call to the winning provider to explicitly confirm
  the booking, using a distinct `result_schema` for confirmation status
  (the "Appointment confirmation" pattern in the CALL-E docs is a good
  reference).
- Swap the CLI for a small web backend (FastAPI/Flask) that calls
  `ashtrac_dispatch.dispatch()` from an HTTP handler instead of argparse.

## A note on the provider numbers

Do not point this at real businesses' numbers for demo purposes without
their consent -- CALL-E's own docs require you to only call numbers you own
or are authorized to call, and cold-calling a real business mid-demo is
both unreliable and not something to do to a stranger without asking. Use
numbers you and your team control for the video and any live judging test.
