# Atlas Cloud Intelligence Service

This is the server-side reasoning gateway for the Atlas Android test client.

## What it does

- exposes `POST /v1/mobile/ask`
- answers auditable ledger questions deterministically
- answers customer, stock, employee, supplier and meeting questions from the supplied authorized snapshot
- creates **review-only** posting proposals for supported accounting descriptions
- falls back to a configured Microsoft Foundry / Azure OpenAI Responses API model for broader reasoning
- can optionally enable the provider's `web_search` tool
- never executes journals, payments or other consequential actions from a model response
- keeps AI/provider credentials on the server, never inside the APK

## Run locally

```bash
cd cloud
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. uvicorn app.main:app --reload --port 8080
```

Health check:

```bash
curl http://localhost:8080/health
```

## Provider configuration

Copy `.env.example` values into your deployment environment. The provider boundary uses the Responses API:

- `ATLAS_AI_BASE_URL` should end at the provider's `/openai/v1` or compatible `/v1` base URL; Atlas appends `/responses`.
- `ATLAS_AI_MODEL` is the model/deployment name.
- `ATLAS_AI_API_KEY` stays server-side.
- `ATLAS_ENABLE_WEB_SEARCH=true` exposes the provider's hosted `web_search` tool for current external questions.

For production Azure deployment, prefer Entra/managed-identity authentication at the service/provider boundary rather than a long-lived API key. The current API-key setting is the portable first adapter.

## Security boundary

The mobile request snapshot is treated as **advisory test context**, not authoritative server data. A production Atlas deployment should load customers, employees, products, meetings and ledger records from authenticated server-side stores after resolving the user's workspace and permissions.

`ATLAS_MOBILE_SHARED_TOKEN` is only a development guard. Production should validate the user's OIDC/Entra token at Front Door/API Management or in the service and apply workspace/role authorization before querying data.

## Posting safety

The response may include `posting_proposal`, but always returns `execute=false`. The Android client can add that proposal to the Posting Basket; the user must still review and confirm before the local test ledger posts anything.

## Test

```bash
cd cloud
pip install -r requirements.txt
PYTHONPATH=. pytest -q
```
