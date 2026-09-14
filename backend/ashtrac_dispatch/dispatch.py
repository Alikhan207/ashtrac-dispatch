"""
Ashtrac Dispatch -- the adaptive calling loop.

Need -> Find -> Call -> Check -> Adapt -> Compare -> Confirm

This module calls CALL-E's one-shot Calls API (not Goal Runs) because each
provider call needs task text specific to *this* user's situation, rather
than a fixed, pre-published script.

Sequencing matters here, not just correctness: the Calls API has no
"cancel in flight" operation (see docs, "Errors" / "Parallel and
quorum-based dispatch"), so this deliberately dispatches providers in
waves -- call one, wait for its terminal result, and only call the next
if the first was not a confirmed "yes". That's what produces the
"Provider 1 says no -> immediately calls Provider 2" behavior, and it
avoids leaving calls in flight that are no longer needed once a provider
confirms.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from calle import CalleClient

from .providers import Provider, classify_need, load_providers, shortlist_for_category
from .schemas import PROVIDER_CALL_RESULT_SCHEMA

logger = logging.getLogger("ashtrac.dispatch")


@dataclass
class ProviderAttempt:
    provider: Provider
    call_id: str | None = None
    status: str | None = None
    availability: str | None = None
    eta: str | None = None
    price: str | None = None
    evidence: str | None = None
    error: str | None = None

    @property
    def confirmed(self) -> bool:
        return self.availability == "yes"


@dataclass
class DispatchResult:
    need_text: str
    category: str
    attempts: list[ProviderAttempt] = field(default_factory=list)
    winner: ProviderAttempt | None = None

    @property
    def confirmed(self) -> bool:
        return self.winner is not None


def build_task_text(need_text: str, provider: Provider) -> str:
    """
    The natural-language instruction sent to CALL-E for this call. Kept
    specific and outcome-oriented per the docs' guidance on `task` inputs.
    """
    return (
        f"You are calling {provider.name} on behalf of a customer with an "
        f"urgent need. Explain the situation clearly and politely: "
        f"\"{need_text}\". Ask whether they can help, and if so, ask for "
        f"their earliest availability (ETA) and an approximate price. "
        f"If they cannot help or are fully booked, thank them and end the "
        f"call politely -- do not push."
    )


def call_provider(
    client: CalleClient,
    need_text: str,
    provider: Provider,
    request_id: str,
    timeout_seconds: float = 300.0,
) -> ProviderAttempt:
    """
    Places one real CALL-E call to one provider and waits for the
    terminal, structured result.
    """
    attempt = ProviderAttempt(provider=provider)
    idempotency_key = f"ashtrac:{request_id}:{provider.id}"

    try:
        call = client.calls.create_and_wait(
            task=build_task_text(need_text, provider),
            recipients=[{"phones": [provider.phone]}],
            result_schema=PROVIDER_CALL_RESULT_SCHEMA,
            metadata={
                "request_id": request_id,
                "provider_id": provider.id,
                "app": "ashtrac-dispatch",
            },
            idempotency_key=idempotency_key,
            timeout_seconds=timeout_seconds,
        )
    except Exception as e:  # noqa: BLE001 -- surfaced to caller via attempt.error
        logger.warning("Call to provider %s failed: %s", provider.id, e)
        attempt.error = str(e)
        attempt.status = "failed"
        return attempt

    attempt.call_id = call.get("id") if isinstance(call, dict) else getattr(call, "id", None)
    attempt.status = call.get("status") if isinstance(call, dict) else getattr(call, "status", None)

    structured_result = (
        call.get("structured_result") if isinstance(call, dict) else getattr(call, "structured_result", None)
    )

    if structured_result is None:
        # CALL-E could not produce a schema-valid result from the call
        # evidence (e.g. no answer, garbled evidence). Treat as unknown,
        # never as a silent "no" -- see docs, "Structured results".
        attempt.availability = "unknown"
        logger.info(
            "Provider %s: no schema-valid structured result (status=%s)",
            provider.id, attempt.status,
        )
        return attempt

    attempt.availability = structured_result.get("availability", "unknown")
    attempt.eta = structured_result.get("eta", "")
    attempt.price = structured_result.get("price", "")
    attempt.evidence = structured_result.get("evidence", "")
    return attempt


def dispatch(
    client: CalleClient,
    need_text: str,
    providers_path: str,
    request_id: str,
    max_providers: int = 3,
    category_override: str | None = None,
) -> DispatchResult:
    """
    Runs the full adaptive loop for one user need:
    classify -> shortlist -> call in waves -> stop at first confirmed yes.
    """
    category = category_override or classify_need(need_text)
    all_providers = load_providers(providers_path)
    shortlist = shortlist_for_category(all_providers, category, limit=max_providers)

    result = DispatchResult(need_text=need_text, category=category)

    if not shortlist:
        logger.warning("No providers found for category '%s'", category)
        return result

    for provider in shortlist:
        logger.info("Dispatching to provider %s (%s)", provider.name, provider.phone)
        attempt = call_provider(client, need_text, provider, request_id)
        result.attempts.append(attempt)

        if attempt.confirmed:
            result.winner = attempt
            logger.info(
                "Confirmed: %s -- ETA %s, price %s",
                provider.name, attempt.eta, attempt.price,
            )
            break  # This is the "adapt" step in reverse: stop once we
                   # have a real yes, instead of calling everyone.
        else:
            logger.info(
                "Provider %s did not confirm (availability=%s) -- "
                "adapting to next provider",
                provider.name, attempt.availability,
            )

    return result


def summarize(result: DispatchResult) -> str:
    lines = [f"Need: {result.need_text}", f"Category: {result.category}", ""]
    for i, attempt in enumerate(result.attempts, start=1):
        lines.append(
            f"  {i}. {attempt.provider.name}: availability={attempt.availability} "
            f"eta={attempt.eta!r} price={attempt.price!r} "
            f"status={attempt.status} error={attempt.error}"
        )
    lines.append("")
    if result.winner:
        w = result.winner
        lines.append(f"CONFIRMED with {w.provider.name}: ETA {w.eta}, price {w.price}")
    else:
        lines.append("No provider confirmed availability.")
    return "\n".join(lines)
