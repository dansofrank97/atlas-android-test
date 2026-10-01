from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any


def _norm(engine: Any, value: Any) -> str:
    return engine.norm(str(value or ""))


def _num(engine: Any, value: Any) -> float:
    return engine.number(value)


def _money(engine: Any, req: Any, value: Any) -> str:
    return engine.money(value, req.company.currency)


def _active(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        x for x in records
        if str(x.get("status", "Active")).strip().lower() in {"active", "current", "employed", ""}
    ]


def _record_name(record: dict[str, Any]) -> str:
    return str(
        record.get("name")
        or record.get("title")
        or record.get("customer")
        or record.get("supplier")
        or record.get("employee")
        or ""
    ).strip()


def _find_record(
    engine: Any,
    records: list[dict[str, Any]],
    text: str,
    *,
    identifiers: tuple[str, ...] = ("id", "sku", "code"),
) -> dict[str, Any] | None:
    q = _norm(engine, text)
    direct: list[dict[str, Any]] = []
    for record in records:
        name = _record_name(record)
        if name and _norm(engine, name) in q:
            direct.append(record)
            continue
        for key in identifiers:
            ident = str(record.get(key) or "").strip()
            if ident and re.search(rf"\b{re.escape(_norm(engine, ident))}\b", q):
                direct.append(record)
                break
    if len(direct) == 1:
        return direct[0]

    token_hits: list[dict[str, Any]] = []
    q_tokens = set(q.split())
    generic = {
        "limited", "ltd", "company", "enterprise", "enterprises", "traders",
        "stores", "store", "mart", "ventures", "services", "service",
        "meeting", "review", "monthly", "weekly", "manager",
    }
    for record in records:
        words = [
            w for w in _norm(engine, _record_name(record)).split()
            if len(w) >= 4 and w not in generic
        ]
        if words and any(w in q_tokens for w in words):
            token_hits.append(record)
    return token_hits[0] if len(token_hits) == 1 else None


def _dt(value: Any) -> datetime | None:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        parsed = datetime.fromisoformat(raw)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _fmt_dt(value: Any) -> str:
    parsed = _dt(value)
    if parsed is None:
        return str(value or "time not supplied")
    return parsed.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _answer(engine: Any, text: str, *, confidence: str = "high", operation: str = "business_query"):
    return engine.AskResponse(
        answer=text,
        source="business_data",
        confidence=confidence,
        operation_code=operation,
    )


def _company_query(engine: Any, req: Any):
    q = _norm(engine, req.question)
    company = req.company

    if re.search(r"\b(what|which).*(company|business).*(name|called)|\bname of (our|my) (company|business)\b", q):
        return _answer(engine, f"The company name supplied to Atlas is {company.name}.")
    if re.search(r"\b(what|which).*(currency|reporting currency)|\bcurrency do we use\b", q):
        return _answer(engine, f"{company.name} is currently configured to use {company.currency}.")
    if re.search(r"\b(what|which).*(country|jurisdiction)|\bwhere is (our|my) (company|business)\b", q):
        return _answer(engine, f"{company.name} is currently configured for {company.country}.")
    if re.search(r"\breporting basis\b|\baccounting basis\b", q):
        basis = company.reportingBasis
        if basis:
            return _answer(engine, f"The supplied reporting basis for {company.name} is {basis}.")
        return _answer(engine, "No reporting basis is currently supplied in the company profile.", confidence="medium")
    return None


def _customer_query(engine: Any, req: Any):
    q = _norm(engine, req.question)
    customers = req.businessData.customers
    if not customers:
        return None

    owing = [x for x in customers if _num(engine, x.get("balance")) > 0]
    overdue = [x for x in customers if _num(engine, x.get("overdue")) > 0]
    named = _find_record(engine, customers, req.question)

    if re.search(r"\b(who|which customer).*(owes|owing).*(most|highest|largest)|\b(biggest|largest|top) debtor\b", q):
        if not owing:
            return _answer(engine, "No customer with a positive outstanding balance is present in the supplied records.")
        row = max(owing, key=lambda x: _num(engine, x.get("balance")))
        return _answer(engine, f"{_record_name(row)} has the largest supplied customer balance at {_money(engine, req, row.get('balance'))}.")

    if re.search(r"\b(total|how much).*(customers?|clients?|debtors?).*(owe|owing)|\b(total|how much).*(receivables?|customer balances?)\b", q):
        total = sum(_num(engine, x.get("balance")) for x in owing)
        return _answer(engine, f"Customers currently owe the business {_money(engine, req, total)} across {len(owing)} outstanding customer account(s).")

    if re.search(r"\bhow many.*(overdue|past due).*(customers?|accounts?)|\bnumber of overdue\b", q):
        total = sum(_num(engine, x.get("overdue")) for x in overdue)
        return _answer(engine, f"{len(overdue)} customer account(s) have overdue balances totalling {_money(engine, req, total)}.")

    if re.search(r"\b(list|show|which|who).*(overdue|past due).*(customers?|accounts?)|\boverdue customers?\b", q):
        if not overdue:
            return _answer(engine, "No overdue customer balance is present in the supplied records.")
        ordered = sorted(overdue, key=lambda x: _num(engine, x.get("overdue")), reverse=True)
        parts = []
        for row in ordered:
            text = f"{_record_name(row)} — {_money(engine, req, row.get('overdue'))} overdue"
            if row.get("daysOverdue") is not None:
                text += f" ({row.get('daysOverdue')} days)"
            parts.append(text)
        return _answer(engine, "Overdue customers: " + "; ".join(parts) + ".")

    if named:
        name = _record_name(named)
        balance = _num(engine, named.get("balance"))
        if re.search(r"\b(how much|what).*(owe|owing|balance)|\b(balance|amount owed)\b", q):
            overdue_amt = _num(engine, named.get("overdue"))
            text = f"{name}'s supplied outstanding balance is {_money(engine, req, balance)}"
            if overdue_amt > 0:
                text += f", of which {_money(engine, req, overdue_amt)} is overdue"
            return _answer(engine, text + ".")
        if re.search(r"\b(overdue|past due|late)\b", q):
            overdue_amt = _num(engine, named.get("overdue"))
            if overdue_amt > 0:
                extra = f" and is {named.get('daysOverdue')} days overdue" if named.get("daysOverdue") is not None else ""
                return _answer(engine, f"{name} has {_money(engine, req, overdue_amt)} overdue{extra}.")
            return _answer(engine, f"{name} has no overdue amount in the supplied customer record.")
        if re.search(r"\blast.*invoice|invoice date|when.*invoice\b", q):
            if named.get("lastInvoice"):
                return _answer(engine, f"The last supplied invoice date for {name} is {named.get('lastInvoice')}.")
            return _answer(engine, f"No last-invoice date is supplied for {name}.", confidence="medium")
        if re.search(r"\b(tell me about|customer details?|show customer|customer record)\b", q):
            details = [f"balance {_money(engine, req, balance)}"]
            if named.get("overdue") is not None:
                details.append(f"overdue {_money(engine, req, named.get('overdue'))}")
            if named.get("lastInvoice"):
                details.append(f"last invoice {named.get('lastInvoice')}")
            return _answer(engine, f"{name}: " + "; ".join(details) + ".")
    return None


def _supplier_query(engine: Any, req: Any):
    q = _norm(engine, req.question)
    suppliers = req.businessData.suppliers
    if not suppliers:
        return None

    owed = [x for x in suppliers if _num(engine, x.get("balance")) > 0]
    named = _find_record(engine, suppliers, req.question)

    if re.search(r"\b(total|how much).*(owe|owing).*(suppliers?|vendors?|creditors?)|\b(total|how much).*(payables?|supplier balances?)\b", q):
        total = sum(_num(engine, x.get("balance")) for x in owed)
        return _answer(engine, f"The business currently owes suppliers {_money(engine, req, total)} across {len(owed)} positive payable balance(s).")

    if re.search(r"\b(who|which supplier|which vendor).*(owe|owing).*(most|highest|largest)|\b(biggest|largest|top) creditor\b", q):
        if not owed:
            return _answer(engine, "No positive supplier payable balance is present in the supplied records.")
        row = max(owed, key=lambda x: _num(engine, x.get("balance")))
        return _answer(engine, f"{_record_name(row)} has the largest supplied payable balance at {_money(engine, req, row.get('balance'))}.")

    if named:
        name = _record_name(named)
        if re.search(r"\b(how much|what).*(owe|owing|balance)|\b(balance|payable)\b", q):
            return _answer(engine, f"The supplied balance payable to {name} is {_money(engine, req, named.get('balance'))}.")
        if re.search(r"\blast.*purchase|when.*purchase|latest purchase\b", q):
            if named.get("lastPurchase"):
                text = f"The last supplied purchase date from {name} is {named.get('lastPurchase')}."
                if named.get("purchases90d") is not None:
                    text += f" Purchases over the supplied 90-day window are {_money(engine, req, named.get('purchases90d'))}."
                return _answer(engine, text)
            return _answer(engine, f"No last-purchase date is supplied for {name}.", confidence="medium")
        if re.search(r"\b(tell me about|supplier details?|vendor details?|supplier record)\b", q):
            details = [f"balance {_money(engine, req, named.get('balance'))}"]
            if named.get("lastPurchase"):
                details.append(f"last purchase {named.get('lastPurchase')}")
            if named.get("purchases90d") is not None:
                details.append(f"90-day purchases {_money(engine, req, named.get('purchases90d'))}")
            return _answer(engine, f"{name}: " + "; ".join(details) + ".")
    return None


def _product_query(engine: Any, req: Any):
    q = _norm(engine, req.question)
    products = req.businessData.products
    if not products:
        return None

    named = _find_record(engine, products, req.question)

    if not re.search(r"\b(low|below reorder|reorder|most|highest|least|lowest|out of stock|zero stock|no stock)\b", q) and re.search(r"\b(list|show|what|which).*(products?|items?|skus?).*(have|carry|stock|sell)|\bproduct list\b|\blist (all )?(products|items|skus)\b", q):
        names = []
        for row in products:
            label = _record_name(row)
            if row.get("sku"):
                label += f" [{row.get('sku')}]"
            names.append(label)
        return _answer(engine, "Products in the supplied product master: " + "; ".join(names) + ".")

    if re.search(r"\b(which|what).*(product|item).*(most|highest).*(stock|units)|\bmost stocked\b", q):
        row = max(products, key=lambda x: _num(engine, x.get("stock")))
        return _answer(engine, f"{_record_name(row)} has the highest supplied stock quantity at {_num(engine, row.get('stock')):,.0f} units.")

    if re.search(r"\b(which|what).*(product|item).*(least|lowest).*(stock|units)|\bleast stocked\b", q):
        row = min(products, key=lambda x: _num(engine, x.get("stock")))
        return _answer(engine, f"{_record_name(row)} has the lowest supplied stock quantity at {_num(engine, row.get('stock')):,.0f} units.")

    if re.search(r"\b(out of stock|zero stock|no stock)\b", q):
        rows = [x for x in products if _num(engine, x.get("stock")) <= 0]
        if not rows:
            return _answer(engine, "No supplied product currently has zero or negative stock.")
        return _answer(engine, "Out-of-stock products: " + "; ".join(_record_name(x) for x in rows) + ".")

    if re.search(r"\b(top|best|fastest).*(selling|seller)|\bmost sales\b", q):
        with_sales = [x for x in products if x.get("sales30d") is not None]
        if with_sales:
            row = max(with_sales, key=lambda x: _num(engine, x.get("sales30d")))
            return _answer(engine, f"{_record_name(row)} is the top supplied 30-day seller with {_num(engine, row.get('sales30d')):,.0f} units sold.")
        return None

    if re.search(r"\b(total|overall).*(retail|selling).*(stock|inventory).*(value)|\bretail value of (stock|inventory)\b", q):
        total = sum(_num(engine, x.get("stock")) * _num(engine, x.get("price")) for x in products)
        return _answer(engine, f"The estimated retail value of supplied stock is {_money(engine, req, total)}, using current supplied selling prices.")

    if named:
        name = _record_name(named)
        stock = _num(engine, named.get("stock"))
        reorder = _num(engine, named.get("reorder"))
        cost = _num(engine, named.get("cost"))
        price = _num(engine, named.get("price"))

        if re.search(r"\b(stock|units|quantity|how many)\b", q):
            text = f"{name} has {stock:,.0f} unit(s) on hand"
            if named.get("reorder") is not None:
                text += f"; reorder level is {reorder:,.0f}"
            return _answer(engine, text + ".")
        if re.search(r"\b(supplier|vendor|who supplies|bought from)\b", q):
            supplier = named.get("supplier")
            if supplier:
                return _answer(engine, f"The supplied vendor for {name} is {supplier}.")
            return _answer(engine, f"No supplier is supplied for {name}.", confidence="medium")
        if re.search(r"\b(last|latest).*(purchase|bought|buy)|\bwhen.*purchase\b", q):
            if named.get("lastPurchase"):
                text = f"The last supplied purchase of {name} was {named.get('lastPurchase')}"
                if named.get("lastPurchaseQty") is not None:
                    text += f": {_num(engine, named.get('lastPurchaseQty')):,.0f} unit(s)"
                if named.get("lastPurchaseUnitCost") is not None:
                    text += f" at {_money(engine, req, named.get('lastPurchaseUnitCost'))} each"
                if named.get("supplier"):
                    text += f" from {named.get('supplier')}"
                return _answer(engine, text + ".")
            return _answer(engine, f"No last-purchase data is supplied for {name}.", confidence="medium")
        if re.search(r"\b(price|selling price|sale price)\b", q) and "cost" not in q:
            if named.get("price") is not None:
                return _answer(engine, f"The supplied selling price of {name} is {_money(engine, req, price)} per unit.")
            return _answer(engine, f"No selling price is supplied for {name}.", confidence="medium")
        if re.search(r"\b(cost|unit cost|purchase cost)\b", q):
            if named.get("cost") is not None:
                return _answer(engine, f"The supplied unit cost of {name} is {_money(engine, req, cost)}.")
            return _answer(engine, f"No unit cost is supplied for {name}.", confidence="medium")
        if re.search(r"\b(margin|gross profit per unit|profit per unit)\b", q):
            if named.get("price") is not None and named.get("cost") is not None:
                margin = price - cost
                pct = (margin / price * 100) if price else 0.0
                return _answer(engine, f"Using the supplied price and cost, {name} has a gross margin of {_money(engine, req, margin)} per unit ({pct:.1f}% of selling price).")
            return _answer(engine, f"I need both a supplied selling price and unit cost to calculate {name}'s unit margin.", confidence="medium")
        if re.search(r"\b(stock value|inventory value|value of.*stock)\b", q):
            return _answer(engine, f"{name}'s supplied stock cost value is {_money(engine, req, stock * cost)}.")
        if re.search(r"\b(tell me about|product details?|item details?|product record)\b", q):
            details = [f"stock {stock:,.0f}"]
            if named.get("reorder") is not None:
                details.append(f"reorder {reorder:,.0f}")
            if named.get("cost") is not None:
                details.append(f"cost {_money(engine, req, cost)}")
            if named.get("price") is not None:
                details.append(f"selling price {_money(engine, req, price)}")
            if named.get("supplier"):
                details.append(f"supplier {named.get('supplier')}")
            return _answer(engine, f"{name}: " + "; ".join(details) + ".")
    return None


def _employee_query(engine: Any, req: Any):
    q = _norm(engine, req.question)
    employees = _active(req.businessData.employees)
    if not employees:
        return None

    named = _find_record(engine, employees, req.question)

    dept_match = re.search(r"\b(?:who|which employees?|which staff|list).*(?:work|works|staff|employees?).*\b(?:in|under)\s+([a-z][a-z &-]{2,40})\b", q)
    if dept_match:
        fragment = dept_match.group(1).strip()
        rows = [x for x in employees if fragment in _norm(engine, x.get("department"))]
        if rows:
            return _answer(engine, f"Employees in {fragment}: " + "; ".join(f"{_record_name(x)} ({x.get('role','role not supplied')})" for x in rows) + ".")

    if re.search(r"\bwho.*(accountant|finance manager|sales manager|storekeeper|driver|hr manager|human resources manager)\b", q):
        role_terms = {
            "accountant": "accountant",
            "finance manager": "finance manager",
            "sales manager": "sales manager",
            "storekeeper": "storekeeper",
            "driver": "driver",
            "hr manager": "hr manager",
            "human resources manager": "hr manager",
        }
        term = next((needle for phrase, needle in role_terms.items() if phrase in q), None)
        if term:
            rows = [x for x in employees if term in _norm(engine, x.get("role"))]
            if rows:
                return _answer(engine, "; ".join(f"{_record_name(x)} is {x.get('role','role not supplied')} in {x.get('department','department not supplied')}" for x in rows) + ".")

    if re.search(r"\b(total|monthly).*(payroll|salary|salaries|wages)|\bpayroll total\b", q):
        salary_rows = [x for x in employees if x.get("monthlySalary") is not None]
        if salary_rows:
            total = sum(_num(engine, x.get("monthlySalary")) for x in salary_rows)
            return _answer(engine, f"Supplied monthly base payroll for {len(salary_rows)} active employee(s) is {_money(engine, req, total)}, before deductions and employer on-costs.")

    if re.search(r"\b(longest serving|worked here longest|earliest joined)\b", q):
        rows = [(x, _dt(x.get("joined"))) for x in employees]
        rows = [(x, d) for x, d in rows if d is not None]
        if rows:
            row, joined = min(rows, key=lambda t: t[1])
            return _answer(engine, f"{_record_name(row)} is the longest-serving employee in the supplied records, with a join date of {joined.date().isoformat()}.")

    if re.search(r"\b(newest employee|most recent employee|joined most recently)\b", q):
        rows = [(x, _dt(x.get("joined"))) for x in employees]
        rows = [(x, d) for x, d in rows if d is not None]
        if rows:
            row, joined = max(rows, key=lambda t: t[1])
            return _answer(engine, f"{_record_name(row)} is the newest employee in the supplied records, with a join date of {joined.date().isoformat()}.")

    if named:
        name = _record_name(named)
        if re.search(r"\b(role|job|position|department|who is|tell me about|employee details?)\b", q):
            text = f"{name} is {named.get('role','role not supplied')} in {named.get('department','department not supplied')}"
            if named.get("joined"):
                text += f", joined {named.get('joined')}"
            return _answer(engine, text + ".")
        if re.search(r"\b(salary|pay|monthly salary)\b", q):
            if named.get("monthlySalary") is not None:
                return _answer(engine, f"The supplied monthly salary for {name} is {_money(engine, req, named.get('monthlySalary'))}.")
            return _answer(engine, f"No salary is supplied for {name}.", confidence="medium")
        if re.search(r"\b(joined|start date|when.*start|when.*join)\b", q):
            if named.get("joined"):
                return _answer(engine, f"{name}'s supplied join date is {named.get('joined')}.")
            return _answer(engine, f"No join date is supplied for {name}.", confidence="medium")

    for row in employees:
        dept = _norm(engine, row.get("department"))
        if dept and re.search(rf"\b{re.escape(dept)}\b", q) and re.search(r"\b(who|staff|employees?|works|work)\b", q):
            rows = [x for x in employees if _norm(engine, x.get("department")) == dept]
            return _answer(engine, f"{row.get('department')} staff: " + "; ".join(f"{_record_name(x)} ({x.get('role','role not supplied')})" for x in rows) + ".")
    return None


def _meeting_query(engine: Any, req: Any):
    q = _norm(engine, req.question)
    meetings = req.businessData.meetings
    if not meetings:
        return None

    named = _find_record(engine, meetings, req.question, identifiers=("id", "code"))
    parsed = [(x, _dt(x.get("start"))) for x in meetings]
    parsed = [(x, d) for x, d in parsed if d is not None]

    if re.search(r"\b(list|show|what).*(meetings?|appointments?)|\bupcoming meetings?\b|\bmeeting schedule\b", q):
        rows = sorted(parsed, key=lambda t: t[1]) if parsed else [(x, None) for x in meetings]
        text = "; ".join(f"{_record_name(x)} — {_fmt_dt(x.get('start'))}" + (f" at {x.get('location')}" if x.get("location") else "") for x, _ in rows)
        return _answer(engine, "Supplied meetings: " + text + ".")

    if re.search(r"\b(last|previous|most recent).*(meeting|appointment)\b|\bwhen did we last meet\b", q):
        now = datetime.now(timezone.utc)
        past = [(x, d) for x, d in parsed if d <= now]
        if not past:
            return _answer(engine, "No past meeting is present in the supplied meeting records.", confidence="medium")
        row, _ = max(past, key=lambda t: t[1])
        return _answer(engine, f"The most recent supplied past meeting is {_record_name(row)} at {_fmt_dt(row.get('start'))}" + (f" at {row.get('location')}" if row.get("location") else "") + ".")

    if named:
        title = _record_name(named)
        attendees = named.get("attendees") or []
        if isinstance(attendees, str):
            attendees = [attendees]
        if re.search(r"\b(who|attend|attendees?|participants?)\b", q):
            if attendees:
                return _answer(engine, f"Attendees for {title}: " + ", ".join(map(str, attendees)) + ".")
            return _answer(engine, f"No attendees are supplied for {title}.", confidence="medium")
        if re.search(r"\b(where|location|venue)\b", q):
            if named.get("location"):
                return _answer(engine, f"{title} is scheduled at {named.get('location')}.")
            return _answer(engine, f"No location is supplied for {title}.", confidence="medium")
        if re.search(r"\b(when|time|date|start)\b", q):
            return _answer(engine, f"{title} is scheduled for {_fmt_dt(named.get('start'))}.")
        if re.search(r"\b(tell me about|meeting details?|show meeting)\b", q):
            text = f"{title}: {_fmt_dt(named.get('start'))}"
            if named.get("location"):
                text += f"; location {named.get('location')}"
            if attendees:
                text += "; attendees " + ", ".join(map(str, attendees))
            return _answer(engine, text + ".")
    return None


def _snapshot_query(engine: Any, req: Any):
    q = _norm(engine, req.question)
    if not re.search(r"\b(business snapshot|company snapshot|business summary|quick overview|overview of (the|our|my) business)\b", q):
        return None
    d = req.businessData
    owing = [x for x in d.customers if _num(engine, x.get("balance")) > 0]
    owed = [x for x in d.suppliers if _num(engine, x.get("balance")) > 0]
    active = _active(d.employees)
    stock_units = sum(_num(engine, x.get("stock")) for x in d.products)
    ar = sum(_num(engine, x.get("balance")) for x in owing)
    ap = sum(_num(engine, x.get("balance")) for x in owed)
    return _answer(
        engine,
        f"{req.company.name}: {len(d.customers)} customer record(s), {len(owing)} owing {_money(engine, req, ar)}; "
        f"{len(d.products)} product/SKU record(s) with {stock_units:,.0f} units on hand; "
        f"{len(active)} active employee(s); {len(d.suppliers)} supplier record(s), with {_money(engine, req, ap)} payable; "
        f"{len(d.meetings)} supplied meeting(s)."
    )


def extended_business_answer(engine: Any, req: Any):
    for resolver in (
        _company_query,
        _snapshot_query,
        _customer_query,
        _supplier_query,
        _product_query,
        _employee_query,
        _meeting_query,
    ):
        result = resolver(engine, req)
        if result is not None:
            return result
    return None


def apply(engine: Any) -> None:
    original = engine.legacy.business_answer

    def business_answer(req):
        result = extended_business_answer(engine, req)
        if result is not None:
            return result
        return original(req)

    engine.legacy.business_answer = business_answer
