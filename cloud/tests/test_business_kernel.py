from fastapi.testclient import TestClient

from app.entry import app
from app import advanced_main as engine

client = TestClient(app)


def payload(question: str, context=None):
    return {
        "question": question,
        "workspace": "kernel-test",
        "company": {"name": "Kernel Test Co", "currency": "GHS", "country": "Ghana"},
        "context": context,
        "ledgerSummary": {"cash": 10000, "assets": 50000, "liabilities": 12000, "revenue": 30000, "expenses": 18000, "profit": 12000},
        "postingBasket": [],
        "businessData": {
            "customers": [{"name": "ABC Ltd", "balance": 4500, "overdue": 1000}],
            "products": [{"name": "Fan", "stock": 10, "reorder": 5, "cost": 200}],
            "employees": [],
            "suppliers": [{"name": "Akoma Supplies", "balance": 3000}],
            "meetings": [],
        },
    }


def ask(question: str, context=None):
    return client.post("/v1/mobile/ask", json=payload(question, context=context)).json()


def test_plain_language_customer_debt_repayment_is_understood():
    data = ask("The customer ABC Ltd who owes us paid 1,500 into our bank")
    assert data["operation_code"] == "customer_receipt"
    assert data["posting_proposal"] is not None
    lines = data["posting_proposal"]["lines"]
    assert any(x["account"] == "Bank" and x["debit"] == 1500 for x in lines)
    assert any(x["account"] == "Accounts Receivable" and x["credit"] == 1500 for x in lines)


def test_customer_repayment_without_channel_asks_clarification():
    data = ask("ABC Ltd repaid 1,000 of what they owe us")
    assert data["operation_code"] == "customer_receipt"
    assert data["clarification"]
    assert "bank" in data["clarification"].lower()


def test_customer_advance_is_not_revenue():
    data = ask("A customer paid a deposit of 2,000 into our bank for an order we have not supplied yet")
    assert data["operation_code"] == "customer_advance"
    lines = data["posting_proposal"]["lines"]
    assert any("Customer Deposits" in x["account"] and x["credit"] == 2000 for x in lines)


def test_sales_return_asks_for_inventory_cost_context():
    data = ask("A customer returned goods worth 800 from a credit sale")
    assert data["operation_code"] == "sales_return"
    assert data["posting_proposal"] is not None
    assert any("Cost of Sales" in x for x in data["warnings"])


def test_inventory_shortage_posts_at_cost():
    data = ask("Our stock count found an inventory shortage of 600")
    assert data["operation_code"] == "inventory_shortage"
    assert data["posting_proposal"] is not None


def test_currency_pair_question_is_recognized_as_current_external():
    assert engine.current_external_question("What is the USD to GHS rate?") is True
    assert engine.current_external_question("How much is one dollar worth in Ghana cedis?") is True


def test_fixed_asset_disposal_requests_carrying_value_data():
    data = ask("We sold our old vehicle for 25,000")
    assert data["operation_code"] == "fixed_asset_disposal"
    assert data["clarification"]
    assert "accumulated depreciation" in data["clarification"].lower()
