import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app import advanced_main as engine
from app.accounting_agent import MASTER_INSTRUCTIONS, SPEC_SECTION_COUNT, review_only_proposal
from app.entry import app


client = TestClient(app)


def proposal(*, debit=125.25, credit=125.25, confirmation=False):
    return {
        "memo": "Proposed expense",
        "lines": [
            {"account": "Expense", "debit": debit, "credit": 0},
            {"account": "Bank", "debit": 0, "credit": credit},
        ],
        "requires_confirmation": confirmation,
    }


@pytest.fixture
def provider(monkeypatch):
    """Exercise the actual API/provider adapter without a live model or secrets."""
    for key, value in {
        "provider_base_url": "https://provider.example/v1",
        "provider_api_key": "test-only-key",
        "provider_model": "test-model",
        "shared_mobile_token": "",
        "enable_web_search": False,
    }.items():
        monkeypatch.setattr(engine.settings, key, value)
    state = {"requests": [], "text": "", "web": False}
    original_client = httpx.AsyncClient

    def respond(request):
        state["requests"].append(json.loads(request.content))
        output = [{"type": "web_search_call", "action": {"sources": []}}] if state["web"] else []
        return httpx.Response(200, json={"output_text": state["text"], "output": output})

    monkeypatch.setattr(engine.httpx, "AsyncClient", lambda **kw: original_client(transport=httpx.MockTransport(respond), **kw))

    def configure(response, *, web=False):
        state["text"] = response if isinstance(response, str) else json.dumps(response)
        state["web"] = web
        monkeypatch.setattr(engine.settings, "enable_web_search", web)
        return state

    return configure


def model_output(journal=None, **overrides):
    return {
        "answer": "Draft for review; totals agree.",
        "confidence": "medium",
        "clarification": None,
        "operation_code": "accounting_draft",
        "posting_proposal": journal,
        "client_action": None,
        "assumptions": [],
        "warnings": [],
        **overrides,
    }


def ask_model(*, web=False):
    question = "What is the current Ghana corporate income tax rate?" if web else "Analyse the lease modification described in my note."
    return client.post("/v1/mobile/ask", json={"question": question, "company": {"currency": "GHS", "country": "Ghana"}})


@pytest.mark.parametrize("web", [False, True])
def test_both_provider_paths_receive_full_spec_and_confirmation_is_enforced(provider, web):
    state = provider(model_output(proposal(), execute=True), web=web)
    response = ask_model(web=web)
    assert response.status_code == 200
    data = response.json()
    assert data["posting_proposal"]["requires_confirmation"] is True
    assert data["execute"] is False
    assert data["web_used"] is web
    assert data["source"] == ("web" if web else "model")
    instructions = state["requests"][0]["instructions"]
    assert MASTER_INSTRUCTIONS.strip() in instructions
    assert SPEC_SECTION_COUNT == 80
    assert "advisory test context" in instructions
    assert "strict JSON response schema" in instructions
    assert "at least two lines" in instructions
    assert state["requests"][0]["text"]["format"]["strict"] is True


@pytest.mark.parametrize("web", [False, True])
@pytest.mark.parametrize("journal", [
    proposal(debit=100, credit=99.99),
    proposal(debit=-100, credit=-100),
    proposal(debit=0, credit=0),
    {"memo": "One-sided", "lines": [{"account": "Bank", "debit": 100, "credit": 0}]},
    {"memo": "Missing account", "lines": [{"account": "", "debit": 100, "credit": 0}, {"account": "Bank", "debit": 0, "credit": 100}]},
    {"memo": "Both sides", "lines": [{"account": "Bank", "debit": 100, "credit": 100}, {"account": "Expense", "debit": 50, "credit": 50}]},
    proposal(debit=True, credit=True),
    proposal(debit="125.25", credit="125.25"),
])
def test_invalid_model_journals_are_withheld_without_api_error(provider, web, journal):
    provider(model_output(journal), web=web)
    response = ask_model(web=web)
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "unavailable"
    assert data["operation_code"] == "accounting_response_invalid"
    assert data["posting_proposal"] is None
    assert data["client_action"] is None
    assert data["execute"] is False


@pytest.mark.parametrize("value", [float("nan"), float("inf"), -float("inf")])
def test_non_finite_journal_values_are_rejected(value):
    with pytest.raises(ValueError):
        review_only_proposal(proposal(debit=value, credit=value))


def test_decimal_journal_balance_does_not_use_binary_float_sums():
    journal = {"memo": "Split expense", "lines": [
        {"account": "Expense A", "debit": 0.1, "credit": 0},
        {"account": "Expense B", "debit": 0.2, "credit": 0},
        {"account": "Bank", "debit": 0, "credit": 0.3},
    ]}
    assert review_only_proposal(journal)["requires_confirmation"] is True


@pytest.mark.parametrize("web", [False, True])
@pytest.mark.parametrize("output", ["I have posted this journal.", [], {"answer": "Draft", "warnings": None}])
def test_malformed_model_outputs_are_withheld(provider, web, output):
    provider(output, web=web)
    data = ask_model(web=web).json()
    assert data["source"] == "unavailable"
    assert data["posting_proposal"] is None
    assert data["execute"] is False


@pytest.mark.parametrize("action", [
    {"type": "show_report", "value": "cashflow", "label": "Invented report"},
    {"type": "execute_payment", "value": "100", "label": "Pay"},
])
def test_unavailable_report_and_execution_actions_are_removed(provider, action):
    provider(model_output(client_action=action))
    data = ask_model().json()
    assert data["client_action"] is None
    assert data["warnings"]
    assert data["execute"] is False


def test_existing_report_action_remains_supported(provider):
    provider(model_output(client_action={"type": "show_report", "value": "trial", "label": "Open Trial Balance"}))
    assert ask_model().json()["client_action"]["value"] == "trial"


def test_current_web_compatibility_path_cannot_claim_search_without_tool_evidence(provider, monkeypatch):
    provider(model_output())
    monkeypatch.setattr(engine.settings, "enable_web_search", True)
    data = ask_model(web=True).json()
    assert data["source"] == "unavailable"
    assert data["operation_code"] == "current_web_unverified"
    assert data["web_used"] is False


def test_capability_answer_works_without_provider_and_identifies_missing_tools(monkeypatch):
    monkeypatch.setattr(engine.settings, "provider_model", "")
    monkeypatch.setattr(engine.settings, "shared_mobile_token", "")
    data = client.post("/v1/mobile/ask", json={"question": "What can Atlas Accounting Agent do?"}).json()
    assert data["operation_code"] == "accounting_capabilities"
    assert "need both sets of transaction records" in data["answer"]
    assert "cannot directly" in data["answer"]
    assert data["execute"] is False
    assert client.get("/health").json()["accounting_agent"] == {
        "name": "Atlas Accounting Agent", "spec_version": "2026-10-02", "sections": 80,
    }
