from fastapi.testclient import TestClient

from app.advanced_main import app

client = TestClient(app)


def payload(question: str):
    return {
        "question": question,
        "workspace": "demo",
        "company": {"name": "Atlas Demo Enterprise", "currency": "GHS", "country": "Ghana"},
        "ledgerSummary": {
            "cash": 12000,
            "assets": 75000,
            "liabilities": 25000,
            "revenue": 42000,
            "expenses": 28000,
            "profit": 14000,
        },
        "postingBasket": [],
        "businessData": {
            "customers": [
                {"id": "C001", "name": "ABC Ltd", "balance": 4500, "overdue": 4500, "daysOverdue": 18, "lastInvoice": "2026-09-08"},
                {"id": "C002", "name": "Kofi Traders", "balance": 3200, "overdue": 0, "daysOverdue": 0, "lastInvoice": "2026-09-20"},
                {"id": "C003", "name": "Grace Mart", "balance": 0, "overdue": 0},
            ],
            "products": [
                {"id": "P001", "sku": "FAN18", "name": "Standing Fan 18-inch", "stock": 12, "reorder": 10, "cost": 350, "price": 520, "supplier": "Akoma Appliances", "lastPurchase": "2026-09-18", "lastPurchaseQty": 20, "lastPurchaseUnitCost": 345, "sales30d": 28},
                {"id": "P002", "sku": "BLD15", "name": "Blender 1.5L", "stock": 8, "reorder": 10, "cost": 260, "price": 390, "supplier": "Akoma Appliances", "lastPurchase": "2026-09-12", "lastPurchaseQty": 15, "lastPurchaseUnitCost": 255, "sales30d": 19},
                {"id": "P003", "sku": "KET20", "name": "Electric Kettle 2L", "stock": 25, "reorder": 8, "cost": 180, "price": 275, "supplier": "Nhyira Wholesale", "lastPurchase": "2026-09-21", "lastPurchaseQty": 30, "lastPurchaseUnitCost": 175, "sales30d": 16},
            ],
            "employees": [
                {"id": "E001", "name": "Ama Mensah", "role": "HR Manager", "department": "Human Resources", "status": "Active", "joined": "2024-03-01", "monthlySalary": 6200},
                {"id": "E002", "name": "Kojo Asante", "role": "Accountant", "department": "Finance", "status": "Active", "joined": "2025-01-15", "monthlySalary": 5800},
                {"id": "E003", "name": "Esi Owusu", "role": "Sales Manager", "department": "Sales", "status": "Active", "joined": "2023-10-10", "monthlySalary": 6500},
            ],
            "suppliers": [
                {"id": "S001", "name": "Akoma Appliances", "balance": 5200, "lastPurchase": "2026-09-18", "purchases90d": 22400},
                {"id": "S002", "name": "Nhyira Wholesale", "balance": 3500, "lastPurchase": "2026-09-21", "purchases90d": 16800},
            ],
            "meetings": [
                {"id": "M001", "title": "Weekly Operations Meeting", "start": "2026-09-28T09:00:00Z", "location": "Main Office", "attendees": ["Ama Mensah", "Kojo Asante"]},
                {"id": "M002", "title": "Supplier Review", "start": "2026-09-30T14:00:00Z", "location": "Conference Room", "attendees": ["Kojo Asante", "Esi Owusu"]},
            ],
        },
    }


def ask(question: str):
    r = client.post("/v1/mobile/ask", json=payload(question))
    assert r.status_code == 200
    return r.json()


def test_named_customer_balance_lookup():
    data = ask("How much does Kofi Traders owe us?")
    assert data["source"] == "business_data"
    assert "Kofi Traders" in data["answer"]
    assert "3,200.00" in data["answer"]


def test_total_supplier_payables():
    data = ask("How much do we owe suppliers in total?")
    assert data["source"] == "business_data"
    assert "8,700.00" in data["answer"]


def test_product_supplier_and_margin_queries():
    supplier = ask("Who supplies the Blender 1.5L?")
    margin = ask("What is the gross margin per unit on Blender 1.5L?")
    assert "Akoma Appliances" in supplier["answer"]
    assert "130.00" in margin["answer"]
    assert "33.3%" in margin["answer"]


def test_highest_stock_product():
    data = ask("Which product has the most stock?")
    assert "Electric Kettle 2L" in data["answer"]
    assert "25" in data["answer"]


def test_named_employee_role_and_salary():
    role = ask("What role does Kojo Asante have?")
    salary = ask("What is Kojo Asante's salary?")
    assert "Accountant" in role["answer"]
    assert "5,800.00" in salary["answer"]


def test_monthly_payroll_total():
    data = ask("What is our monthly payroll total?")
    assert "18,500.00" in data["answer"]


def test_named_meeting_details():
    attendees = ask("Who will attend Supplier Review?")
    where = ask("Where is Supplier Review?")
    assert "Kojo Asante" in attendees["answer"]
    assert "Esi Owusu" in attendees["answer"]
    assert "Conference Room" in where["answer"]


def test_business_snapshot_combines_master_data():
    data = ask("Give me a quick overview of our business")
    assert "2 owing" in data["answer"]
    assert "45 units" in data["answer"]
    assert "3 active employee" in data["answer"]
    assert "8,700.00" in data["answer"]
