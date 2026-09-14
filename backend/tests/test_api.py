"""
Integration test for the FastAPI dispatch backend -- verifies the HTTP
contract the Lovable frontend actually calls (POST /api/dispatch,
GET /api/dispatch/{id}) against a fake CALL-E client, with no real calls
placed and no network access required.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from ashtrac_dispatch import api as api_module
from ashtrac_dispatch.dispatch import ProviderAttempt


@pytest.fixture
def providers_file(tmp_path: Path, monkeypatch) -> str:
    data = [
        {"id": "p1", "name": "Provider One", "category": "home_repair", "phone": "+911111111111"},
        {"id": "p2", "name": "Provider Two", "category": "home_repair", "phone": "+912222222222"},
    ]
    path = tmp_path / "providers.json"
    path.write_text(json.dumps(data))
    monkeypatch.setenv("ASHTRAC_PROVIDERS_PATH", str(path))
    monkeypatch.setattr(api_module, "PROVIDERS_PATH", str(path))
    monkeypatch.setenv("CALLE_API_KEY", "fake-key-for-tests")
    return str(path)


@pytest.fixture
def fake_call_provider(monkeypatch):
    """
    Replaces call_provider with a canned, instant response so the test
    doesn't depend on real network calls or real timing: Provider One
    says no, Provider Two confirms.
    """
    responses = {
        "p1": ProviderAttempt(
            provider=None, call_id="call_1", status="completed",
            availability="no", eta="", price="", evidence="Fully booked",
        ),
        "p2": ProviderAttempt(
            provider=None, call_id="call_2", status="completed",
            availability="yes", eta="4-6 PM", price="500", evidence="Confirmed",
        ),
    }

    def fake(client, need_text, provider, request_id, timeout_seconds=120.0):
        result = responses[provider.id]
        result.provider = provider
        return result

    monkeypatch.setattr(api_module, "call_provider", fake)
    return responses


def test_dispatch_end_to_end_via_http(providers_file, fake_call_provider):
    client = TestClient(api_module.app)

    start = client.post("/api/dispatch", json={"need_text": "The plaster on my wall is falling off"})
    assert start.status_code == 200
    request_id = start.json()["request_id"]
    assert request_id

    # Poll until the background thread finishes (bounded loop, no real calls).
    deadline = time.monotonic() + 5.0
    result = None
    while time.monotonic() < deadline:
        resp = client.get(f"/api/dispatch/{request_id}")
        assert resp.status_code == 200
        result = resp.json()
        if result["winner"] is not None:
            break
        time.sleep(0.05)

    assert result is not None
    assert result["winner"]["provider"]["name"] == "Provider Two"
    assert result["winner"]["eta"] == "4-6 PM"
    assert result["category"] == "home_repair"
    assert len(result["attempts"]) == 2
    assert result["attempts"][0]["availability"] == "no"
    assert result["attempts"][1]["availability"] == "yes"


def test_unknown_request_id_returns_404(providers_file, fake_call_provider):
    client = TestClient(api_module.app)
    resp = client.get("/api/dispatch/does-not-exist")
    assert resp.status_code == 404


def test_empty_need_text_rejected(providers_file, fake_call_provider):
    client = TestClient(api_module.app)
    resp = client.post("/api/dispatch", json={"need_text": "   "})
    assert resp.status_code == 400
