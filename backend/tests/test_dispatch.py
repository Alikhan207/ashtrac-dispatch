"""
Tests for the adaptive dispatch loop, using a fake CALL-E client so the
core logic (adapt-on-no, unknown handling, stop-on-confirm) can be verified
without spending real call credits or depending on network access.

Run with:
    python -m pytest tests/test_dispatch.py -v
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import pytest

from ashtrac_dispatch.dispatch import dispatch


class FakeCalls:
    """
    Mimics the shape of client.calls used by dispatch.py. `responses` maps
    a recipient phone number to the canned terminal call dict that should
    be returned for a call to that number.
    """

    def __init__(self, responses: dict[str, dict]):
        self.responses = responses
        self.calls_made: list[str] = []

    def create_and_wait(self, *, recipients, **kwargs):
        phone = recipients[0]["phones"][0]
        self.calls_made.append(phone)
        return self.responses.get(
            phone,
            {"id": "call_missing", "status": "failed", "structured_result": None},
        )


class FakeClient:
    def __init__(self, responses: dict[str, dict]):
        self.calls = FakeCalls(responses)


@pytest.fixture
def providers_file(tmp_path: Path) -> str:
    data = [
        {"id": "p1", "name": "Provider One", "category": "home_repair", "phone": "+911111111111"},
        {"id": "p2", "name": "Provider Two", "category": "home_repair", "phone": "+912222222222"},
        {"id": "p3", "name": "Provider Three", "category": "home_repair", "phone": "+913333333333"},
    ]
    path = tmp_path / "providers.json"
    path.write_text(json.dumps(data))
    return str(path)


def test_adapts_to_next_provider_on_no(providers_file):
    client = FakeClient({
        "+911111111111": {
            "id": "call_1", "status": "completed",
            "structured_result": {"availability": "no", "eta": "", "price": "", "evidence": "fully booked"},
        },
        "+912222222222": {
            "id": "call_2", "status": "completed",
            "structured_result": {"availability": "yes", "eta": "4-6 PM", "price": "500", "evidence": "confirmed"},
        },
    })

    result = dispatch(
        client=client,
        need_text="The plaster on my wall is falling off",
        providers_path=providers_file,
        request_id="test-1",
    )

    assert result.confirmed
    assert result.winner.provider.id == "p2"
    # Provider 3 should never have been called -- we stop at first confirm.
    assert client.calls.calls_made == ["+911111111111", "+912222222222"]


def test_null_structured_result_treated_as_unknown_not_failure(providers_file):
    client = FakeClient({
        "+911111111111": {"id": "call_1", "status": "completed", "structured_result": None},
        "+912222222222": {
            "id": "call_2", "status": "completed",
            "structured_result": {"availability": "yes", "eta": "tomorrow", "price": "300", "evidence": "ok"},
        },
    })

    result = dispatch(
        client=client,
        need_text="need an electrician",
        providers_path=providers_file,
        request_id="test-2",
    )

    assert result.attempts[0].availability == "unknown"
    assert result.confirmed
    assert result.winner.provider.id == "p2"


def test_no_provider_confirms(providers_file):
    client = FakeClient({
        "+911111111111": {"id": "c1", "status": "completed", "structured_result": {"availability": "no", "eta": "", "price": "", "evidence": ""}},
        "+912222222222": {"id": "c2", "status": "completed", "structured_result": {"availability": "no", "eta": "", "price": "", "evidence": ""}},
        "+913333333333": {"id": "c3", "status": "completed", "structured_result": {"availability": "no", "eta": "", "price": "", "evidence": ""}},
    })

    result = dispatch(
        client=client,
        need_text="need a plumber",
        providers_path=providers_file,
        request_id="test-3",
    )

    assert not result.confirmed
    assert len(result.attempts) == 3
