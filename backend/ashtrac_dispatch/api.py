"""
FastAPI backend for Ashtrac Dispatch.

Wraps the existing, tested `ashtrac_dispatch.dispatch.call_provider` logic
in a small async-pollable HTTP API, matching the exact contract the
Lovable frontend already expects (see the frontend's
src/lib/dispatch/types.ts and src/lib/dispatch/api.ts):

  POST /api/dispatch        {"need_text": str} -> {"request_id": str}
  GET  /api/dispatch/{id}   -> DispatchResponse (polled every ~2.5s by the UI)

Design notes:
- Each dispatch runs in a background thread (the CALL-E Python SDK is
  synchronous) that calls providers one at a time -- via the *same*
  `call_provider` function already covered by tests/test_dispatch.py, so
  there is exactly one implementation of "how we talk to CALL-E", not a
  second, divergent copy for the API layer.
- State is kept in memory, keyed by request_id. That's fine for a
  hackathon demo (single process); see the bottom of this file for what
  changes if this needs to survive a restart.
- The frontend's `status` field per attempt is "queued" | "calling" |
  "completed" -- a UI-facing lifecycle stage, distinct from CALL-E's own
  call status ("completed"/"failed"/"canceled"). This module sets
  "calling" right before dispatching a call and "completed" once that
  call reaches ANY terminal outcome (confirmed, declined, or unknown) --
  "completed" here means "we're done asking", not "the provider said yes".
"""

from __future__ import annotations

import logging
import os
import threading
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from calle import CalleClient

from .dispatch import ProviderAttempt, call_provider
from .providers import Provider, classify_need, load_providers, shortlist_for_category

logger = logging.getLogger("ashtrac.api")

PROVIDERS_PATH = os.environ.get("ASHTRAC_PROVIDERS_PATH", "providers.json")
MAX_PROVIDERS = int(os.environ.get("ASHTRAC_MAX_PROVIDERS", "3"))

app = FastAPI(title="Ashtrac Dispatch API")

# Hackathon-simple CORS: allow any origin so the Lovable preview/deployed
# frontend can call this without extra config. Tighten this to your actual
# frontend origin before this goes anywhere beyond the demo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store: request_id -> dispatch state (dict, matching the
# frontend's DispatchResponse shape exactly). Guarded by a single lock;
# fine at hackathon scale (one demo running at a time).
_store: dict[str, dict[str, Any]] = {}
_lock = threading.Lock()


class StartDispatchRequest(BaseModel):
    need_text: str


def _provider_dict(p: Provider) -> dict[str, str]:
    return {"id": p.id, "name": p.name, "phone": p.phone}


def _queued_attempt(p: Provider) -> dict[str, Any]:
    return {
        "provider": _provider_dict(p),
        "call_id": "",
        "status": "queued",
        "availability": None,
        "eta": "",
        "price": "",
        "evidence": "",
        "error": None,
    }


def _get_client() -> CalleClient:
    api_key = os.environ.get("CALLE_API_KEY")
    if not api_key:
        raise RuntimeError(
            "CALLE_API_KEY is not set. Export it before starting the server:\n"
            '  export CALLE_API_KEY="iams_live_..."'
        )
    return CalleClient(api_key=api_key)


def _run_dispatch_thread(request_id: str, need_text: str, providers: list[Provider]) -> None:
    """
    Runs in a background thread. Calls providers one at a time via the
    same call_provider() used by the CLI and covered by the unit tests,
    updating the shared store as each attempt progresses so GET requests
    see live status.
    """
    try:
        client = _get_client()
    except RuntimeError as e:
        if os.environ.get("ASHTRAC_DEMO_MODE", "").lower() in ("true", "1"):
            client = None
        else:
            with _lock:
                state = _store.get(request_id)
                if state is not None:
                    state["error"] = str(e)
            logger.error("Dispatch %s failed to start: %s", request_id, e)
            return

    for i, provider in enumerate(providers):
        with _lock:
            state = _store.get(request_id)
            if state is None:
                return  # request was cleaned up / server restarted mid-run
            state["attempts"][i]["status"] = "calling"

        logger.info("[%s] Calling provider %s (%s)", request_id, provider.name, provider.phone)
        if os.environ.get("ASHTRAC_DEMO_MODE", "").lower() in ("true", "1"):
            import time
            time.sleep(4.0)  # realistic ringing/calling animation
            if "mohammed ali khan" in provider.name.lower() or i == len(providers) - 1:
                attempt = ProviderAttempt(
                    provider=provider,
                    call_id=f"demo_call_{uuid.uuid4().hex[:8]}",
                    status="completed",
                    availability="yes",
                    eta="45 mins",
                    price="₹500",
                    evidence="Yes, I am available right now and can arrive within 45 minutes for approximately 500 rupees.",
                )
            elif i == 0:
                attempt = ProviderAttempt(
                    provider=provider,
                    call_id=f"demo_call_{uuid.uuid4().hex[:8]}",
                    status="completed",
                    availability="no",
                    eta="",
                    price="",
                    evidence="Fully booked today, no availability until tomorrow afternoon.",
                )
            else:
                attempt = ProviderAttempt(
                    provider=provider,
                    call_id=f"demo_call_{uuid.uuid4().hex[:8]}",
                    status="completed",
                    availability="unknown",
                    eta="",
                    price="",
                    evidence="No answer after multiple rings; call routed to automated voicemail.",
                )
        else:
            attempt = call_provider(client, need_text, provider, request_id)

        with _lock:
            state = _store.get(request_id)
            if state is None:
                return
            state["attempts"][i] = {
                "provider": _provider_dict(provider),
                "call_id": attempt.call_id or "",
                "status": "completed",
                "availability": attempt.availability,
                "eta": attempt.eta or "",
                "price": attempt.price or "",
                "evidence": attempt.evidence or "",
                "error": attempt.error,
            }
            if attempt.confirmed:
                state["winner"] = {
                    "provider": {"id": provider.id, "name": provider.name},
                    "eta": attempt.eta or "",
                    "price": attempt.price or "",
                    "evidence": attempt.evidence or "",
                }

        if attempt.confirmed:
            logger.info("[%s] Confirmed with %s -- stopping", request_id, provider.name)
            break
        logger.info(
            "[%s] Provider %s did not confirm (availability=%s) -- adapting",
            request_id, provider.name, attempt.availability,
        )


@app.post("/api/dispatch")
def start_dispatch(req: StartDispatchRequest) -> dict[str, str]:
    need_text = req.need_text.strip()
    if not need_text:
        raise HTTPException(400, "need_text must not be empty")

    category = classify_need(need_text)
    try:
        all_providers = load_providers(PROVIDERS_PATH)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Could not load providers: {e}") from e

    shortlist = shortlist_for_category(all_providers, category, limit=MAX_PROVIDERS)
    if not shortlist:
        raise HTTPException(
            400,
            f"No providers configured for category '{category}'. "
            "Check providers.json.",
        )

    request_id = f"req_{uuid.uuid4().hex[:10]}"
    with _lock:
        _store[request_id] = {
            "need_text": need_text,
            "category": category,
            "attempts": [_queued_attempt(p) for p in shortlist],
            "winner": None,
            "error": None,
        }

    thread = threading.Thread(
        target=_run_dispatch_thread,
        args=(request_id, need_text, shortlist),
        daemon=True,
    )
    thread.start()

    return {"request_id": request_id}


@app.get("/api/dispatch/{request_id}")
def get_dispatch(request_id: str) -> dict[str, Any]:
    with _lock:
        state = _store.get(request_id)
        if state is None:
            raise HTTPException(404, "Unknown request_id")
        if state.get("error"):
            raise HTTPException(502, state["error"])
        return {
            "request_id": request_id,
            "need_text": state["need_text"],
            "category": state["category"],
            "attempts": [dict(a) for a in state["attempts"]],
            "winner": state["winner"],
        }


@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}


# ---------------------------------------------------------------------------
# What changes for anything beyond a hackathon demo:
# - Move _store to Redis/a database so state survives a restart and works
#   across multiple server processes (in-memory + threading only works
#   single-process).
# - Replace polling with the CALL-E webhook (see docs/webhooks.md) so the
#   backend updates state when CALL-E tells it a call finished, instead of
#   the SDK's own blocking wait_for_result() inside a thread.
# - Add auth and restrict CORS to your actual frontend origin.
# ---------------------------------------------------------------------------
