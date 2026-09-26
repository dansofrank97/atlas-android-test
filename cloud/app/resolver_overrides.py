from __future__ import annotations

import re
from typing import Any


def apply(engine: Any) -> None:
    original_customer_receipt = engine.customer_receipt
    original_supplier_payment = engine.supplier_payment

    def customer_receipt(req):
        raw = req.question
        q = engine.norm(raw)
        named = engine.find_named(req.businessData.customers, raw)
        pending = (req.context or {}).get("cloud_state") if isinstance(req.context, dict) else None
        continuing = isinstance(pending, dict) and pending.get("intent") == "customer_receipt"
        if named and re.search(r"\b(paid|repaid|settled|cleared|remitted|transferred)\b", q):
            # Add an explicit customer/receivable cue so the proven resolver handles it.
            proxy = req.model_copy(deep=True)
            proxy.question = raw + " customer receivable payment"
            return original_customer_receipt(proxy)
        if continuing:
            return original_customer_receipt(req)
        return original_customer_receipt(req)

    def supplier_payment(req):
        raw = req.question
        q = engine.norm(raw)
        named = engine.find_named(req.businessData.suppliers, raw)
        pending = (req.context or {}).get("cloud_state") if isinstance(req.context, dict) else None
        continuing = isinstance(pending, dict) and pending.get("intent") == "supplier_payment"
        if named and re.search(r"\b(paid|settled|cleared|remitted|transferred)\b", q):
            proxy = req.model_copy(deep=True)
            proxy.question = raw + " supplier payable payment"
            return original_supplier_payment(proxy)
        if continuing:
            return original_supplier_payment(req)
        return original_supplier_payment(req)

    def loan_transaction(req):
        raw = req.question
        q = engine.norm(raw)
        # Repayment must be checked before loan receipt because "repaid" contains "paid"
        # and natural language may also include "bank loan" / "loan from bank".
        repayment = bool(re.search(r"\b(repaid|repay|paid back|loan repayment|paid.*loan|settled.*loan)\b", q))
        if repayment and not re.search(r"customer|debtor|receivable", q):
            amount = engine.first_amount(raw)
            if not amount:
                return engine.clarify(req, "loan_repayment", "I understand this as a repayment of business borrowing.", "How much was paid, and how much of it was principal versus interest or fees?", {}, ["amount", "principal_interest_split", "payment_channel"])
            state = engine.pending_state(req, "loan_repayment")
            known = dict(state.get("known") or {}) if isinstance((req.context or {}).get("cloud_state") if isinstance(req.context, dict) else None, dict) else {}
            known["amount"] = amount
            channel = engine.payment_channel(raw)
            if channel and channel != "Accounts Payable":
                known["channel"] = channel
            values = engine.amounts(raw)
            principal = None
            interest = None
            principal_match = re.search(r"principal(?:\s+(?:was|of|is))?\s*(?:ghs|ghc|gh¢|gh₵|₵)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)", raw, re.I)
            interest_match = re.search(r"interest(?:\s+(?:was|of|is))?\s*(?:ghs|ghc|gh¢|gh₵|₵)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)", raw, re.I)
            if principal_match:
                principal = float(principal_match.group(1).replace(",", ""))
            if interest_match:
                interest = float(interest_match.group(1).replace(",", ""))
            if principal is None or interest is None:
                return engine.clarify(req, "loan_repayment", f"The loan payment is {engine.money(amount, req.company.currency)}. A repayment can contain principal, interest and fees, which have different accounting effects.", "How much of this payment was principal and how much was interest/fees?", known, ["principal_interest_split"] + ([] if known.get("channel") else ["payment_channel"]))
            total_split = principal + interest
            if abs(total_split - amount) > 0.01:
                return engine.clarify(req, "loan_repayment", f"The principal plus interest you gave is {engine.money(total_split, req.company.currency)}, but the total payment is {engine.money(amount, req.company.currency)}.", "Please confirm the correct total/principal/interest figures before I prepare the posting.", known, ["principal_interest_split"], warnings=["The repayment components do not reconcile to the total payment."])
            if not known.get("channel"):
                return engine.clarify(req, "loan_repayment", f"I have principal of {engine.money(principal, req.company.currency)} and interest/fees of {engine.money(interest, req.company.currency)}.", "Was the repayment made from bank, cash, or MoMo?", {**known, "principal": principal, "interest": interest}, ["payment_channel"])
            lines = [("Loan Payable", principal, 0)]
            if interest:
                lines.append(("Interest Expense", interest, 0))
            lines.append((str(known["channel"]), 0, amount))
            return engine.proposal_response(req, "loan_repayment", raw, lines, f"Loan repayment proposal: Dr Loan Payable {engine.money(principal, req.company.currency)}; Dr Interest Expense {engine.money(interest, req.company.currency)}; Cr {known['channel']} {engine.money(amount, req.company.currency)}.")

        # Loan received: require actual borrowing/receipt wording, not merely the phrase "bank loan".
        if re.search(r"\b(borrowed|received a loan|took a loan|obtained a loan|loan proceeds|loan received)\b", q):
            amount = engine.first_amount(raw)
            if not amount:
                return engine.clarify(req, "loan_received", "I understand that the business borrowed money.", "How much was borrowed?", {}, ["amount", "receipt_channel", "lender"])
            channel = engine.payment_channel(raw, receiving=True)
            if not channel:
                return engine.clarify(req, "loan_received", f"I understand a loan receipt of {engine.money(amount, req.company.currency)}.", "Where did the loan money arrive — bank, cash, or MoMo?", {"amount": amount}, ["receipt_channel"])
            return engine.proposal_response(req, "loan_received", raw, [(channel, amount, 0), ("Loan Payable", 0, amount)], f"Loan receipt proposal: Dr {channel} {engine.money(amount, req.company.currency)}; Cr Loan Payable {engine.money(amount, req.company.currency)}. If the lender-specific account is known, Atlas should use that subledger account.")
        return None

    engine.customer_receipt = customer_receipt
    engine.supplier_payment = supplier_payment
    engine.loan_transaction = loan_transaction
