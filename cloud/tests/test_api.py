from fastapi.testclient import TestClient

from app.advanced_main import app

client = TestClient(app)


def payload(question: str, context=None):
    return {
        "question": question,
        "workspace": "demo",
        "company": {"name": "Test Enterprise", "currency": "GHS", "country": "Ghana"},
        "context": context,
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


def ask(question: str, context=None):
    return client.post("/v1/mobile/ask", json=payload(question, context=context))


def test_health_is_honest_about_provider_and_business_engine():
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["service"] == "atlas-cloud-intelligence"
    assert data["business_engine"] == "integrated-v2"
    assert isinstance(data["provider_ready"], bool)


def test_net_assets_are_computed_from_ledger():
    data = ask("What are my total net assets?").json()
    assert data["source"] == "ledger"
    assert "50,000.00" in data["answer"]


def test_customer_debt_count_uses_business_data():
    data = ask("How many customers are owing us?").json()
    assert data["source"] == "business_data"
    assert "2 customer" in data["answer"]
    assert "7,700.00" in data["answer"]


def test_low_stock_uses_reorder_level():
    data = ask("Which products are low in stock?").json()
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


def test_mango_purchase_is_understood_as_business_feeding_expense():
    data = ask("I purchased mango for 50 cash").json()
    p = data["posting_proposal"]
    assert p is not None
    assert p["lines"][0]["account"] == "Staff Welfare / Feeding Expense"
    assert p["lines"][0]["debit"] == 50
    assert p["lines"][1]["account"] == "Cash"


def test_customer_debt_repayment_is_not_new_revenue():
    data = ask("ABC Ltd, a customer who owes us, paid 4,500 into the bank").json()
    p = data["posting_proposal"]
    assert data["operation_code"] == "customer_receipt"
    assert p is not None
    assert p["lines"][0]["account"] == "Bank"
    assert p["lines"][0]["debit"] == 4500
    assert p["lines"][1]["account"] == "Accounts Receivable"
    assert p["lines"][1]["credit"] == 4500
    assert "Sales Revenue" not in [x["account"] for x in p["lines"]]


def test_customer_receipt_asks_customer_then_retains_state():
    first = ask("A customer owing us repaid his debt through bank").json()
    assert first["operation_code"] == "customer_receipt"
    assert first["posting_proposal"] is None
    assert "customer" in first["clarification"].lower()
    state = first["conversation_state"]
    second = ask("ABC Ltd", context={"cloud_state": state}).json()
    assert second["operation_code"] == "customer_receipt"
    assert second["posting_proposal"] is None
    assert "how much" in second["clarification"].lower()


def test_supplier_payment_reduces_payable():
    data = ask("We paid Akoma Appliances 2,000 from bank to settle part of what we owe them").json()
    p = data["posting_proposal"]
    assert data["operation_code"] == "supplier_payment"
    assert p["lines"][0]["account"] == "Accounts Payable"
    assert p["lines"][0]["debit"] == 2000
    assert p["lines"][1]["account"] == "Bank"
    assert p["lines"][1]["credit"] == 2000


def test_internal_cash_to_bank_transfer_is_not_income():
    data = ask("We banked 2,000 cash").json()
    p = data["posting_proposal"]
    assert data["operation_code"] == "internal_transfer"
    assert p["lines"][0]["account"] == "Bank"
    assert p["lines"][1]["account"] == "Cash"
    assert "Revenue" not in [x["account"] for x in p["lines"]]


def test_owner_capital_is_not_revenue():
    data = ask("The owner introduced 10,000 capital into the bank").json()
    p = data["posting_proposal"]
    assert data["operation_code"] == "capital_contribution"
    assert p["lines"][0]["account"] == "Bank"
    assert "Capital" in p["lines"][1]["account"]


def test_loan_receipt_is_not_revenue():
    data = ask("We borrowed 20,000 from the bank and it entered our bank account").json()
    p = data["posting_proposal"]
    assert data["operation_code"] == "loan_received"
    assert p["lines"][0]["account"] == "Bank"
    assert p["lines"][1]["account"] == "Loan Payable"


def test_loan_repayment_asks_for_principal_interest_split():
    data = ask("We repaid 2,500 of our bank loan from bank").json()
    assert data["operation_code"] == "loan_repayment"
    assert data["posting_proposal"] is None
    assert "principal" in data["clarification"].lower()
    assert "interest" in data["clarification"].lower()


def test_bad_debt_writeoff_requires_customer_and_amount():
    data = ask("Write off ABC Ltd bad debt").json()
    assert data["operation_code"] == "bad_debt_writeoff"
    assert data["posting_proposal"] is None
    assert "how much" in data["clarification"].lower()


def test_bank_charge_posts_expense_and_bank():
    data = ask("Bank charges of 75 were deducted").json()
    p = data["posting_proposal"]
    assert p["lines"][0]["account"] == "Bank Charges Expense"
    assert p["lines"][1]["account"] == "Bank"


def test_report_request_returns_client_action():
    data = ask("Generate my statement of financial position").json()
    assert data["client_action"]["type"] == "show_report"
    assert data["client_action"]["value"] == "balance"


def test_unposted_basket_is_visible():
    data = ask("How many unposted transactions do I have?").json()
    assert "1 transaction" in data["answer"]


def test_current_exchange_rate_is_not_guessed_when_web_disabled():
    data = ask("What is the current USD to Ghana cedi exchange rate today?").json()
    assert data["source"] == "unavailable"
    assert "web search" in data["answer"].lower()


def test_unknown_question_does_not_hallucinate_without_provider():
    data = ask("Tell me something only our managing director would know").json()
    assert data["source"] == "unavailable"
    assert "will not guess" in data["answer"].lower()
