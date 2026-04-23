# Finance Smoke Test - Phase 5/6 (2026-04-23)

## Objective
Validate commission split behavior and monthly period lock safeguards after implementation.

## 1) Commission split rule (UI)
- [ ] Open `/admin/finance/comissoes`
- [ ] Create a rule with `Split (JSON opcional)` using:

```json
[
  { "broker_name": "Corretor A", "participant_type": "corretor", "percentage": 60 },
  { "broker_name": "Parceiro B", "participant_type": "parceiro", "percentage": 40 }
]
```

- [ ] Save rule successfully
- [ ] Confirm rule chip shows `split 2`

## 2) Split preview + apuração
- [ ] In "Calcular comissão", select the split-enabled rule
- [ ] Run "Calcular prévia"
- [ ] Confirm preview shows `Split:` with participant amounts
- [ ] Run "Apurar e salvar"
- [ ] Confirm two commission rows are created (one per participant)
- [ ] Confirm amounts sum exactly to total preview commission

## 3) Period lock safeguards
- [ ] Ensure at least one month is `locked` in `finance_closing_periods`
- [ ] Try creating/editing/deleting:
  - [ ] `/api/admin/finance` entry in locked month
  - [ ] `/api/admin/finance/apar` payable/receivable in locked month
  - [ ] `/api/admin/finance/reconciliations` record in locked month
  - [ ] `/api/admin/finance/commissions` record in locked month
- [ ] Confirm API returns `409` and lock message for each blocked action

## 4) Evidence
- [ ] Screenshot: split preview with breakdown
- [ ] Screenshot: multiple commission rows created from split
- [ ] Screenshot: blocked write in locked period (`409`)

## 5) Changelog
- [ ] Update `docs/finance_upgrade_changelog.md` status from `IMPLEMENTED_PENDING_SMOKE_TEST` to `COMPLETED` after all checks pass
