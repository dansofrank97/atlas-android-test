from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def payload(question: str):
    return {
        "question": question,
        "workspace": "demo",
        "company": {"name": "Test Enterprise", "currency": "GHS", "country": "Ghana"},
        "ledgerSummary": {
            "cash": 12000,
            "assets": 75000,
            "liabilities": 25000,
            "revenue": 42000,
            "expenses": 28000,
            "profit": 14000,
        },
        "postingBasket": [
            {
                "memo": "Fuel",
                "lines": [
                    {"account": "Fuel Expense", "debit": 300, "credit": 0},
                    {"account": "Cash", "debit": 0, "credit": 300},
                ],
            }
        ],
        "businessData": {
            "customers": [
                {"name": "ABC Ltd", "balance": 4500, "overdue": 4500},
                {"name": "Kofi Traders", "balance": 3200, "overdue": 0},
                {"name": "Grace Mart", "balance": 0, "overdue": 0},
            ],
            "products": [
                {"name": "Standing Fan", "stock": 12, "reorder": 10, "cost": 350},
                {"name": "Blender", "stock": 8, "reorder": 10, "cost": 260},
            ],
            "employees": [
                {"name": "Ama Mensah", "role": "HR Manager", "department": "Human Resources", "status": "Active"},
                {"name": "Kojo Asante", "role": "Accountant", "department": "Finance", "status": "Active"},
            ],
            "suppliers": [{"name": "Akoma Appliances", "balance": 5200}],
            "meetings": [
                {
                    "title": "Weekly Operations Meeting",
                    "start": "2026-09-28T09:00:00Z",
                    "location": "Main Office",
                    "attendees": ["Ama Mensah", "Kojo Asante"],
                }
            ],
        },
    }


def ask(question: str):
    return client.post("/v1/mobile/ask", json=payload(question))


def test_health_is_honest_about_provider_state():
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["service"] == "atlas-cloud-intelligence"
    assert isinstance(data["provider_ready"], bool)


def test_net_assets_are_computed_from_ledger():
    r = ask("What are my total net assets?")
    assert r.status_code == 200
    data = r.json()
    assert data["source"] == "ledger"
    assert "50,000.00" in data["answer"]


def test_customer_debt_count_uses_business_data():
    r = ask("How many customers are owing us?")
    data = r.json()
    assert data["source"] == "business_data"
    assert "2 customer" in data["answer"]
    assert "7,700.00" in data["answer"]


def test_low_stock_uses_reorder_level():
    r = ask("Which products are low in stock?")
    data = r.json()
    assert "Blender" in data["answer"]
    assert "Standing Fan" not in data["answer"]


def test_employee_count_and_hr_lookup():
    count = ask("How many employees do we have?").json()
    hr = ask("Who is our HR manager?").json()
    assert "2 active employee" in count["answer"]
    assert "Ama Mensah" in hr["answer"]


def test_next_meeting_answer_is_grounded():
    data = ask("When is our next meeting?").json()
    assert "Weekly Operations Meeting" in data["answer"]
    assert "Main Office" in data["answer"]


def test_purchase_without_payment_asks_clarification():
    data = ask("I bought furniture 15,000").json()
    assert data["source"] == "rules"
    assert data["clarification"] is not None
    assert "cash" in data["clarification"].lower()
    assert data["posting_proposal"] is None


def test_purchase_with_payment_returns_reviewable_proposal_only():
    data = ask("I bought furniture 15,000 cash").json()
    proposal = data["posting_proposal"]
    assert proposal is not None
    assert proposal["requires_confirmation"] is True
    assert proposal["lines"][0]["account"] == "Furniture"
    assert proposal["lines"][0]["debit"] == 15000
    assert proposal["lines"][1]["account"] == "Cash"
    assert proposal["lines"][1]["credit"] == 15000
    assert data["execute"] is False


def test_unposted_basket_is_visible():
    data = ask("How many unposted transactions do I have?").json()
    assert "1 transaction" in data["answer"]


def test_unknown_question_does_not_hallucinate_without_provider():
    data = ask("Tell me something only our managing director would know").json()
    assert data["source"] == "unavailable"
    assert "will not guess" in data["answer"].lower()
