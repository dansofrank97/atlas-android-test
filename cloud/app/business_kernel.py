from __future__ import annotations

import json
import re
from typing import Any

import httpx


BUSINESS_KNOWLEDGE = r"""
ATLAS BUSINESS KERNEL — DOMAIN MAP

Atlas reasons from economic substance and the complete business cycle. This map is a routing and reasoning aid, not a substitute for entity-specific facts or professional judgment.

ACCOUNTING / FINANCE DOMAINS
- Cash and treasury: cash, bank, MoMo/wallets, petty cash, merchant/card settlements, deposits, withdrawals, internal transfers, bank charges, bank interest, overdrafts, cash forecasts, bank reconciliation.
- Revenue / receivables: quotes, orders, delivery, invoicing, cash sales, credit sales, deposits, deferred/unearned revenue, collections, partial/full settlements, discounts, credit notes, sales returns, refunds, bad debts, impairment/expected credit loss, customer advances and overpayments.
- Procurement / payables: requisitions, purchase orders, goods receipt, supplier invoices, cash/credit purchases, supplier deposits, payments, partial/full settlement, supplier credits, purchase returns, discounts and withholding.
- Inventory / production: raw materials, WIP, finished goods, goods for resale, landed cost, stock issues, production consumption, cost of sales, counts, shortages/surpluses, damage, expiry, obsolescence, write-downs/write-offs and reorder decisions.
- PPE / capex: acquisition, directly attributable costs, repair vs capital expenditure, depreciation, componentisation, revaluation where applicable, impairment, disposal, retirement and gain/loss on disposal.
- Intangibles: acquisition, development vs research, amortisation, impairment and disposal.
- Payroll / HR accounting: gross pay, overtime, allowances, deductions, pensions/social security, payroll taxes, employer contributions, payroll liabilities, net pay, advances, leave and termination benefits.
- Financing: loans, overdrafts, principal, interest, fees, accrued interest, refinancing, owner/shareholder contributions, share capital, drawings, dividends/distributions and retained earnings.
- Adjustments / close: accruals, prepayments, deferred income, provisions, contingencies, depreciation, amortisation, impairment, FX remeasurement, inventory adjustments, suspense clearing and period close.
- Tax / statutory: VAT/GST/sales tax, withholding, payroll taxes, income tax and other statutory liabilities. Never assume a current rate; identify jurisdiction/date and retrieve authoritative current information.
- Foreign currency: transaction currency, functional currency, spot rate/date, settlement, monetary-item retranslation and exchange differences.
- Leases, financial instruments, investments, intercompany/related parties, business combinations, consolidation, grants and other specialist areas.

BUSINESS OPERATING DOMAINS
- Sales and marketing: leads, pipeline, conversion, pricing, promotions, channels, segmentation, customer acquisition, retention, churn, CLV, sales mix and margin.
- Operations: capacity, throughput, service level, lead time, quality, procurement, inventory turns, stock-outs, supplier performance, logistics and controls.
- HR: workforce planning, recruitment, onboarding, roles, attendance, leave, performance, compensation, training, succession, discipline and separation.
- Strategy: goals, market/competitive analysis, business model, capital allocation, unit economics, break-even, scenarios, risk and opportunity.
- Governance and internal control: approvals, maker-checker, segregation of duties, access, audit trail, reconciliations, exceptions, fraud controls and records retention.
- Reporting and analysis: trial balance, income statement, statement of financial position, cash flows, equity changes, budgets, forecasts, KPIs, variance, working capital and management commentary.

IFRS / FINANCIAL REPORTING REFERENCE MAP
Use the IFRS Conceptual Framework and identify relevant current Standards where material. Common routing includes: IFRS 1 first-time adoption; IFRS 2 share-based payment; IFRS 3 business combinations; IFRS 5 held-for-sale/discontinued operations; IFRS 7 financial-instrument disclosures; IFRS 8 segments; IFRS 9 financial instruments; IFRS 10 consolidation; IFRS 11 joint arrangements; IFRS 12 interests in other entities; IFRS 13 fair value; IFRS 15 revenue; IFRS 16 leases; IFRS 17 insurance; IFRS 18 presentation/disclosure in financial statements (effective according to its current requirements); IFRS 19 eligible-subsidiary disclosures; IAS 1/legacy presentation requirements where still relevant by effective date; IAS 2 inventories; IAS 7 cash flows; IAS 8 accounting policies/estimates/errors; IAS 10 events after reporting period; IAS 12 income taxes; IAS 16 PPE; IAS 19 employee benefits; IAS 20 government grants; IAS 21 foreign exchange; IAS 23 borrowing costs; IAS 24 related parties; IAS 27 separate statements; IAS 28 associates/joint ventures; IAS 29 hyperinflation; IAS 32 financial-instrument presentation; IAS 33 EPS; IAS 34 interim reporting; IAS 36 impairment; IAS 37 provisions/contingencies; IAS 38 intangibles; IAS 40 investment property; IAS 41 agriculture; plus current IFRIC/SIC interpretations.

Do not reproduce copyrighted IFRS text. For a current standards requirement, retrieve or cite the official IFRS Foundation/standard-setter material where available, identify effective-date context, and explain the principle in original words.

ACCOUNTING DECISION DISCIPLINE
1. First identify the economic event: what happened, to whom, when, how much, what was received/given, and whether an earlier receivable/payable/asset/liability already exists.
2. Decide whether this is recognition of a new event, settlement of an existing balance, reclassification/transfer, adjustment, measurement change, or disclosure-only event.
3. Identify affected elements (asset, liability, equity, income, expense) and subledger entity where applicable.
4. Ask only the missing facts that change the accounting conclusion. Never guess a bank/cash/credit channel, tax rate, inventory cost, loan principal-interest split, disposal carrying amount, or customer/supplier identity.
5. Every journal proposal must balance debits and credits and remain unposted until user confirmation.
6. If one user message contains multiple events, separate them. Preserve earlier unposted proposals while clarifying later events.
7. If the event cannot be safely represented by a simple journal, explain the workflow/control task that must happen first.

CURRENT INFORMATION DISCIPLINE
For current FX rates, prices, rates, laws, taxes, standards updates, market/business news, trends, company developments and other time-sensitive facts, use live web search. Prefer central banks, regulators, tax authorities, standards setters, official filings and first-party sources, then reputable market-data/news sources. State source/date and important rate type distinctions (reference vs mid-market vs buy/sell) when known.
""".strip()


def _q(engine: Any, req: Any) -> str:
    return engine.norm(req.question)


def _amt(engine: Any, req: Any) -> float:
    return engine.first_amount(req.question)


def _channel(engine: Any, req: Any, receiving: bool = False) -> str | None:
    return engine.payment_channel(req.question, receiving=receiving)


def extended_current_question(engine: Any, text: str) -> bool:
    q = engine.norm(text)
    if engine.current_external_question_original(text):
        return True
    return bool(re.search(
        r"\b(usd|us dollar|dollar|eur|euro|gbp|pound|cedi|ghs|naira|zar|rand|yen|cny|yuan)\b.*\b(to|against|rate|worth|convert|conversion)\b|"
        r"\b(exchange|convert|conversion)\b.*\b(usd|dollar|cedi|ghs|euro|pound|naira|rand)\b|"
        r"\b(what is happening|what's happening|business outlook|market outlook|business trends|market trends|economic outlook|breaking business|business news)\b|"
        r"\b(ifrs|ias|ifric|accounting standard|financial reporting standard)\b.*\b(current|latest|effective|amendment|update|requirement|requires)\b",
        q,
    ))


def _named_or_word(engine: Any, records: list[dict[str, Any]], raw: str, generic_words: str) -> dict[str, Any] | None:
    named = engine.find_named(records, raw)
    if named:
        return named
    return None


def customer_refund(engine: Any, req: Any):
    q = _q(engine, req)
    if not re.search(r"\b(refund|refunded|gave.*money back|returned.*money)\b", q) or not re.search(r"\b(customer|client|buyer|sale|sales)\b", q):
        return None
    amount = _amt(engine, req)
    customer = engine.find_named(req.businessData.customers, req.question)
    known: dict[str, Any] = {}
    if customer:
        known["customer"] = customer.get("name")
    if amount:
        known["amount"] = amount
    channel = _channel(engine, req)
    if channel and channel != "Accounts Payable":
        known["channel"] = channel
    if not amount:
        return engine.clarify(req, "customer_refund", "I understand that money was refunded to a customer.", "How much was refunded?", known, ["amount", "reason", "channel"])
    if not re.search(r"\b(return|overpayment|deposit|advance|cancel|cancellation|price adjustment|credit note|discount)\b", q):
        return engine.clarify(req, "customer_refund", f"I have a customer refund of {engine.money(amount, req.company.currency)}.", "Why was the customer refunded — sales return/credit note, overpayment, deposit cancellation, or something else?", known, ["reason", "channel"])
    if not known.get("channel"):
        return engine.clarify(req, "customer_refund", f"I understand the reason for the {engine.money(amount, req.company.currency)} refund.", "Was the refund paid from bank, cash, or MoMo?", known, ["channel"])
    if re.search(r"overpayment|deposit|advance|cancel|cancellation", q):
        debit = "Customer Deposits / Customer Advances"
    else:
        debit = "Sales Returns & Allowances"
    return engine.proposal_response(req, "customer_refund", req.question, [(debit, amount, 0), (known["channel"], 0, amount)], f"Refund proposal: Dr {debit} {engine.money(amount, req.company.currency)}; Cr {known['channel']} {engine.money(amount, req.company.currency)}. Review VAT/tax consequences and the customer credit-note allocation before posting.")


def customer_advance(engine: Any, req: Any):
    q = _q(engine, req)
    if not re.search(r"\b(customer|client|buyer)\b.*\b(deposit|advance|paid in advance|prepaid|down payment)\b|\b(deposit|advance|down payment)\b.*\b(customer|client|buyer)\b", q):
        return None
    amount = _amt(engine, req)
    channel = _channel(engine, req, receiving=True)
    if not amount:
        return engine.clarify(req, "customer_advance", "I understand that a customer paid before the related revenue is earned/invoiced.", "How much was received?", {}, ["amount", "channel", "customer"])
    if not channel:
        return engine.clarify(req, "customer_advance", f"I have a customer advance of {engine.money(amount, req.company.currency)}.", "Where was the money received — bank, cash, or MoMo?", {"amount": amount}, ["channel", "customer"])
    return engine.proposal_response(req, "customer_advance", req.question, [(channel, amount, 0), ("Customer Deposits / Contract Liability", 0, amount)], f"Advance receipt proposal: Dr {channel}; Cr Customer Deposits / Contract Liability for {engine.money(amount, req.company.currency)}. Revenue should be recognized only when the applicable performance/recognition conditions are met.")


def supplier_advance(engine: Any, req: Any):
    q = _q(engine, req)
    if not re.search(r"\b(paid|gave|sent).*(supplier|vendor).*(deposit|advance|down payment)|\b(supplier|vendor).*(deposit|advance|down payment)\b", q):
        return None
    amount = _amt(engine, req)
    channel = _channel(engine, req)
    if not amount:
        return engine.clarify(req, "supplier_advance", "I understand this as an advance paid to a supplier before the related goods/services are recognized.", "How much was paid?", {}, ["amount", "channel", "supplier"])
    if not channel or channel == "Accounts Payable":
        return engine.clarify(req, "supplier_advance", f"I have a supplier advance of {engine.money(amount, req.company.currency)}.", "Was it paid from bank, cash, or MoMo?", {"amount": amount}, ["channel", "supplier"])
    return engine.proposal_response(req, "supplier_advance", req.question, [("Supplier Advances / Prepayments", amount, 0), (channel, 0, amount)], f"Supplier advance proposal: Dr Supplier Advances / Prepayments; Cr {channel} for {engine.money(amount, req.company.currency)}.")


def sales_return(engine: Any, req: Any):
    q = _q(engine, req)
    if not re.search(r"\b(customer|client|buyer).*(returned|return).*\b(goods|items|products|stock)\b|\bsales return|goods returned by customer\b", q):
        return None
    amount = _amt(engine, req)
    if not amount:
        return engine.clarify(req, "sales_return", "I understand that a customer returned goods previously sold.", "What is the sales/credit-note value of the return? If inventory is tracked, also give the returned items/quantity or cost so Atlas can restore inventory correctly.", {}, ["sales_value", "inventory_cost_or_items", "settlement"])
    customer = engine.find_named(req.businessData.customers, req.question)
    if customer or re.search(r"\b(on credit|credit sale|receivable|invoice)\b", q):
        credit = "Accounts Receivable"
    else:
        channel = _channel(engine, req)
        if not channel:
            return engine.clarify(req, "sales_return", f"The return value is {engine.money(amount, req.company.currency)}.", "Was the original sale on credit, or are you refunding bank/cash/MoMo?", {"amount": amount}, ["settlement", "inventory_cost_or_items"])
        credit = channel
    return engine.proposal_response(req, "sales_return", req.question, [("Sales Returns & Allowances", amount, 0), (credit, 0, amount)], f"Sales-return value proposal: Dr Sales Returns & Allowances; Cr {credit} for {engine.money(amount, req.company.currency)}. If physical inventory came back, Atlas also needs its cost/item data to propose Dr Inventory; Cr Cost of Sales.", warnings=["Review indirect-tax/VAT credit-note treatment and inventory restoration before posting."])


def purchase_return(engine: Any, req: Any):
    q = _q(engine, req)
    if not re.search(r"\b(returned|return).*(supplier|vendor)|\bpurchase return|returned goods to supplier\b", q):
        return None
    amount = _amt(engine, req)
    if not amount:
        return engine.clarify(req, "purchase_return", "I understand that goods/items were returned to a supplier.", "What is the supplier credit-note/cost value of the return?", {}, ["amount", "settlement", "classification"])
    if re.search(r"\b(credit|payable|invoice)\b", q) or engine.find_named(req.businessData.suppliers, req.question):
        debit = "Accounts Payable"
    else:
        channel = _channel(engine, req, receiving=True)
        if not channel:
            return engine.clarify(req, "purchase_return", f"The purchase-return value is {engine.money(amount, req.company.currency)}.", "Will the supplier reduce your payable, or refund bank/cash/MoMo?", {"amount": amount}, ["settlement", "classification"])
        debit = channel
    credit = "Inventory / Purchase Returns"
    return engine.proposal_response(req, "purchase_return", req.question, [(debit, amount, 0), (credit, 0, amount)], f"Purchase-return proposal: Dr {debit}; Cr {credit} for {engine.money(amount, req.company.currency)}. Confirm whether the original item was inventory, an expense, or a fixed asset so the credit can use the exact original account.", warnings=["Use the original purchase classification when known rather than a generic purchase-return account."])


def discount_settlement(engine: Any, req: Any):
    q = _q(engine, req)
    vals = engine.amounts(req.question)
    if not re.search(r"\b(discount allowed|gave.*discount|customer.*discount|discount received|supplier.*discount)\b", q):
        return None
    if len(vals) < 1:
        return engine.clarify(req, "settlement_discount", "I understand there is a settlement discount.", "What is the discount amount, and what is the cash amount actually received/paid?", {}, ["discount", "cash_settlement", "counterparty"])
    return engine.clarify(req, "settlement_discount", "A settlement discount affects both the receivable/payable and the amount of cash settled.", "Please give both figures: the outstanding balance being cleared and the actual cash received/paid (or the exact discount amount).", {"figures_seen": vals}, ["balance_cleared", "cash_settlement"], warnings=["Indirect-tax/VAT treatment of discounts may depend on jurisdiction and invoice/credit-note rules."])


def accrual_prepayment(engine: Any, req: Any):
    q = _q(engine, req)
    amount = _amt(engine, req)
    if re.search(r"\b(accrued|accrual|incurred.*not paid|expense.*owing|expense payable)\b", q):
        if not amount:
            return engine.clarify(req, "expense_accrual", "I understand this as an expense incurred but not yet paid/invoiced or settled.", "What is the amount and what expense does it relate to?", {}, ["amount", "expense_type"])
        return engine.clarify(req, "expense_accrual", f"The accrual is {engine.money(amount, req.company.currency)}.", "What expense account does it relate to (for example utilities, audit, rent, interest, salaries)?", {"amount": amount}, ["expense_type"])
    if re.search(r"\b(prepaid|prepayment|paid in advance).*(rent|insurance|subscription|expense|service)|\b(rent|insurance|subscription).*(prepaid|paid in advance)\b", q):
        if not amount:
            return engine.clarify(req, "prepayment", "I understand this as payment for a future period/benefit.", "How much was prepaid and from which bank/cash/MoMo account?", {}, ["amount", "channel", "benefit_period"])
        channel = _channel(engine, req)
        if not channel or channel == "Accounts Payable":
            return engine.clarify(req, "prepayment", f"The prepayment is {engine.money(amount, req.company.currency)}.", "Was it paid from bank, cash, or MoMo, and what period does it cover?", {"amount": amount}, ["channel", "benefit_period"])
        return engine.proposal_response(req, "prepayment", req.question, [("Prepayments", amount, 0), (channel, 0, amount)], f"Initial prepayment proposal: Dr Prepayments; Cr {channel} for {engine.money(amount, req.company.currency)}. Expense recognition should then follow the period/consumption of the benefit.")
    return None


def dividend_distribution(engine: Any, req: Any):
    q = _q(engine, req)
    if not re.search(r"\b(dividend|distribution to shareholders|shareholder distribution)\b", q):
        return None
    amount = _amt(engine, req)
    if not amount:
        return engine.clarify(req, "dividend", "I understand this as a shareholder distribution/dividend event.", "What amount was declared or paid, and was it a declaration only or an actual payment?", {}, ["amount", "declared_or_paid"])
    if re.search(r"\b(declared|declaration)\b", q) and not re.search(r"\bpaid|payment\b", q):
        return engine.proposal_response(req, "dividend_declared", req.question, [("Retained Earnings / Dividends", amount, 0), ("Dividends Payable", 0, amount)], f"Dividend declaration proposal: Dr Retained Earnings / Dividends; Cr Dividends Payable for {engine.money(amount, req.company.currency)}. Confirm legal authorization and entity-specific equity presentation.")
    channel = _channel(engine, req)
    if not channel:
        return engine.clarify(req, "dividend_payment", f"The dividend/distribution amount is {engine.money(amount, req.company.currency)}.", "Was it paid from bank, cash, or another account, and had a dividend payable already been recognized?", {"amount": amount}, ["channel", "prior_declaration"])
    return engine.clarify(req, "dividend_payment", f"I have a payment of {engine.money(amount, req.company.currency)} from {channel}.", "Was this dividend already declared and recorded as Dividends Payable, or should Atlas treat this as a direct owner distribution under your entity structure?", {"amount": amount, "channel": channel}, ["prior_declaration"])


def merchant_settlement(engine: Any, req: Any):
    q = _q(engine, req)
    if not re.search(r"\b(card|pos|merchant|payment gateway|visa|mastercard|mobile money aggregator|processor)\b.*\b(settled|settlement|paid us|deposited|remitted)\b", q):
        return None
    vals = engine.amounts(req.question)
    if len(vals) < 2:
        return engine.clarify(req, "merchant_settlement", "I understand this as a merchant/payment-processor settlement, which may include fees withheld from gross collections.", "Give the gross amount collected and the net amount deposited (or the processor fee).", {"figures_seen": vals}, ["gross", "net_or_fee", "bank_account"])
    gross, net = vals[0], vals[1]
    if net > gross:
        gross, net = net, gross
    fee = round(gross - net, 2)
    return engine.proposal_response(req, "merchant_settlement", req.question, [("Bank", net, 0), ("Merchant / Processing Fees", fee, 0), ("Card / Merchant Clearing", 0, gross)], f"Merchant settlement proposal: Dr Bank {engine.money(net, req.company.currency)}; Dr Merchant / Processing Fees {engine.money(fee, req.company.currency)}; Cr Card / Merchant Clearing {engine.money(gross, req.company.currency)}. Confirm the clearing balance and any tax on fees before posting.")


def foreign_currency_event(engine: Any, req: Any):
    q = _q(engine, req)
    if not re.search(r"\b(usd|dollar|eur|euro|gbp|pound|naira|rand|foreign currency|fx)\b", q):
        return None
    # Let current-rate questions go to live web rather than create a journal.
    if extended_current_question(engine, req.question) and re.search(r"\b(rate|worth|convert|conversion|to cedi|to ghs|against)\b", q):
        return None
    if re.search(r"\b(bought|sold|paid|received|invoice|purchase|sale|settled)\b", q):
        vals = engine.amounts(req.question)
        if not re.search(r"\b(rate|exchange rate|spot rate)\b", q) and len(vals) < 2:
            return engine.clarify(req, "foreign_currency_transaction", "I understand this is a foreign-currency business transaction.", "What was the transaction currency amount and the applicable exchange rate (or the functional-currency amount) on the transaction date?", {"figures_seen": vals}, ["foreign_amount", "currency", "transaction_date_rate", "settlement"])
    return None


def fixed_asset_disposal(engine: Any, req: Any):
    q = _q(engine, req)
    if not re.search(r"\b(sold|disposed|scrapped|retired).*(asset|vehicle|car|machine|equipment|furniture|building|computer|printer)|\basset disposal\b", q):
        return None
    vals = engine.amounts(req.question)
    if len(vals) < 2 or not re.search(r"\b(carrying|book value|net book|cost|accumulated depreciation)\b", q):
        return engine.clarify(req, "fixed_asset_disposal", "A fixed-asset disposal needs more than the selling price because Atlas must derecognize the asset and accumulated depreciation and calculate any gain/loss.", "Please give the sale proceeds, asset cost, and accumulated depreciation (or the net carrying amount), plus where the proceeds were received.", {"figures_seen": vals}, ["proceeds", "cost", "accumulated_depreciation_or_carrying_amount", "receipt_channel"])
    return None  # complex combinations go to model after facts are present


def inventory_count_adjustment(engine: Any, req: Any):
    q = _q(engine, req)
    if not re.search(r"\b(stock count|inventory count|physical count|stocktake|stock take|shortage|surplus)\b", q):
        return None
    amount = _amt(engine, req)
    if not amount:
        return engine.clarify(req, "inventory_count_adjustment", "I understand this as a physical inventory/count difference.", "What is the cost value of the shortage or surplus, and is it a shortage/loss or a surplus?", {}, ["cost_value", "shortage_or_surplus"])
    if re.search(r"\b(shortage|missing|loss|less than)\b", q):
        return engine.proposal_response(req, "inventory_shortage", req.question, [("Inventory Count Loss / Shrinkage", amount, 0), ("Inventory", 0, amount)], f"Inventory shortage proposal at cost: Dr Inventory Count Loss / Shrinkage; Cr Inventory for {engine.money(amount, req.company.currency)}.")
    if re.search(r"\b(surplus|extra|more than|overage)\b", q):
        return engine.proposal_response(req, "inventory_surplus", req.question, [("Inventory", amount, 0), ("Inventory Count Gain / Adjustment", 0, amount)], f"Inventory surplus proposal at cost: Dr Inventory; Cr Inventory Count Gain / Adjustment for {engine.money(amount, req.company.currency)}. Investigate the cause before posting.")
    return engine.clarify(req, "inventory_count_adjustment", f"The count difference has a cost value of {engine.money(amount, req.company.currency)}.", "Is it a shortage/loss or a surplus/overage?", {"amount": amount}, ["shortage_or_surplus"])


def extended_resolver(engine: Any, req: Any):
    for fn in (
        customer_refund,
        customer_advance,
        supplier_advance,
        sales_return,
        purchase_return,
        discount_settlement,
        merchant_settlement,
        accrual_prepayment,
        dividend_distribution,
        inventory_count_adjustment,
        fixed_asset_disposal,
        foreign_currency_event,
    ):
        result = fn(engine, req)
        if result is not None:
            return result
    return None


def _extract_text(body: dict[str, Any]) -> str:
    text = body.get("output_text") or ""
    if text:
        return str(text).strip()
    parts: list[str] = []
    for item in body.get("output", []) or []:
        if item.get("type") in {"message", "output_message"}:
            for content in item.get("content", []) or []:
                if content.get("type") in {"output_text", "text"} and content.get("text"):
                    parts.append(str(content["text"]))
    return "\n".join(parts).strip()


async def robust_current_web(engine: Any, req: Any):
    if not engine.settings.provider_ready or not engine.settings.enable_web_search:
        return None
    if not extended_current_question(engine, req.question):
        return None

    url = engine.settings.provider_base_url + "/responses"
    headers = {
        "Authorization": f"Bearer {engine.settings.provider_api_key}",
        "api-key": engine.settings.provider_api_key,
        "Content-Type": "application/json",
    }
    snapshot = engine.safe_snapshot(req)
    base: dict[str, Any] = {
        "model": engine.settings.provider_model,
        "instructions": engine.SYSTEM_INSTRUCTIONS,
        "input": [{
            "role": "user",
            "content": "Use live web evidence for the current/external part of this request. Prefer authoritative primary sources.\n\nUser request:\n" + req.question + "\n\nAuthorized company snapshot:\n" + json.dumps(snapshot, ensure_ascii=False, default=str),
        }],
        "text": {"format": {"type": "json_schema", "name": "AtlasBusinessResponse", "schema": engine.RESPONSE_SCHEMA, "strict": True}},
        "max_output_tokens": 2200,
    }

    body: dict[str, Any] | None = None
    last_error = ""
    async with httpx.AsyncClient(timeout=engine.settings.request_timeout) as client:
        for tool_type in ("web_search", "web_search_preview"):
            payload = dict(base)
            payload["tools"] = [{"type": tool_type}]
            if tool_type == "web_search":
                payload["tools"] = [{"type": "web_search", "search_context_size": "medium"}]
                payload["tool_choice"] = "required"
            try:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code >= 400:
                    last_error = f"{response.status_code}: {response.text[:300]}"
                    continue
                body = response.json()
                break
            except Exception as exc:
                last_error = type(exc).__name__
                continue
    if body is None:
        print("Atlas current-web request failed: " + last_error)
        return None

    text = _extract_text(body)
    if not text:
        return None
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return engine.AskResponse(answer=text, source="web", confidence="medium", web_used=True, citations=engine.extract_citations(body))

    proposal = parsed.get("posting_proposal")
    action = parsed.get("client_action")
    return engine.AskResponse(
        answer=str(parsed.get("answer") or "Atlas returned no answer."),
        source="web",
        confidence=str(parsed.get("confidence") or "medium"),
        clarification=parsed.get("clarification"),
        operation_code=parsed.get("operation_code"),
        posting_proposal=engine.PostingProposal(**proposal) if proposal else None,
        client_action=engine.ClientAction(**action) if action else None,
        web_used=True,
        citations=engine.extract_citations(body),
        assumptions=[str(x) for x in parsed.get("assumptions", [])],
        warnings=[str(x) for x in parsed.get("warnings", [])],
    )


def apply(engine: Any) -> None:
    # Expand the semantic business model used by the model fallback.
    if "ATLAS BUSINESS KERNEL" not in engine.SYSTEM_INSTRUCTIONS:
        engine.SYSTEM_INSTRUCTIONS = engine.SYSTEM_INSTRUCTIONS + "\n\n" + BUSINESS_KNOWLEDGE

    original_resolver = engine.advanced_posting_resolver
    original_current = engine.current_external_question
    original_provider = engine.call_provider
    engine.current_external_question_original = original_current

    def resolver(req):
        result = extended_resolver(engine, req)
        if result is not None:
            return result
        return original_resolver(req)

    def current(text: str) -> bool:
        return extended_current_question(engine, text)

    async def provider(req):
        # For live/current facts, first force a grounded search with compatibility fallback.
        grounded = await robust_current_web(engine, req)
        if grounded is not None:
            return grounded
        return await original_provider(req)

    engine.advanced_posting_resolver = resolver
    engine.current_external_question = current
    engine.call_provider = provider
