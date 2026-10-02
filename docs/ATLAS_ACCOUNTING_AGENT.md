# Atlas Accounting Agent integration

The production cloud entry point (`app.entry:app`) now supplies Frank Danso's complete
80-section accounting specification to both the regular model adapter and the current-web
compatibility adapter. The original accounting text lives in
`cloud/app/prompts/accounting_agent.md`; the application contract lives in
`cloud/app/accounting_agent.py`. Existing deterministic accounting and business handlers
continue to take priority.

## Resulting behavior

- Model-backed accounting responses follow the supplied preparation, investigation,
  review, teaching and financial-analysis remit, subject to available evidence/tools.
- Accounting journal proposals are checked with decimal arithmetic before release:
  at least two named-account lines, numeric finite non-negative amounts, one non-zero
  side per line, equal debit/credit totals, and mandatory confirmation.
- Invalid journal/response output is withheld with an explicit error instead of being
  released as a posting proposal. This gateway always returns `execute=false`.
- Model client actions can only open the five existing report types. Unsupported
  report/action buttons are withheld with a warning.
- Current-web answers require actual web-tool evidence before being labelled verified
  through web search. Existing authoritative-source/citation handling remains in place.
- Asking “What can Atlas Accounting Agent do?” returns an honest capability summary
  even without a model provider. `/health` identifies the accounting specification version.

The contract requires tables, workings and totals inside the existing JSON answer field.
Existing Android clients can display these responses without a new APK. The supplied
text is preserved in full, including all 80 numbered sections; the application contract
resolves its broad execution language into review-only behavior.

## Actual capability boundaries

| Area | Current boundary |
| --- | --- |
| Journals and business questions | Existing deterministic handlers plus configured model drafts; review required |
| Ledger/report buttons | Existing balance, income, trial, journal and daily client reports |
| Bank/GL reconciliation | Requires both detailed records; snapshot totals alone are insufficient |
| Tax and standards | Model reasoning with authoritative current evidence when web search is enabled |
| Document/spreadsheet processing | No new upload, OCR, spreadsheet or computation tool is added by this prompt integration |
| ERP, bank feeds, payment, filing | No new external integration or execution capability |
| Persistence/identity | Existing mobile-snapshot/test boundary; this change does not connect the separate Financial OS core or add production identity |

Prompt instructions guide model behavior but are not a guarantee of accounting correctness
or professional certification. Complex workings still need an actual computation and
independent verification workflow. Automated adapter tests use simulated model responses;
they do not demonstrate live-model quality across all 80 topics.

## Validation and rollout

From `cloud/`:

```bash
PYTHONPATH=. python -m pytest -q
python -m compileall -q app tests
```

The cloud Dockerfile already copies the whole `app/` directory, including the prompt.
After review and merge, use the existing manual Azure deployment workflow to activate
the new cloud revision. Until deployment, the installed app continues using the old
cloud behavior. Check `/health` for the `accounting_agent` version and run representative
lease, reconciliation, missing-input, journal and current-tax examples on the configured
model before accepting the rollout. Preserve the manual deployment gate.

Use the existing cloud test workflow to validate source changes. Keep the spec and its
tests versioned together; do not replace source files with historical archive contents.
