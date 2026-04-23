# Finance Smoke Test - Phase 5/6 (2026-04-23)

## Status
- Execution state: `COMPLETED`
- Started at: `2026-04-23`
- Locked period used: `2026-04-01`
- Probe date used: `2026-04-15`
- Completed at: `2026-04-23`

## Objective
Validate commission split behavior and monthly period lock safeguards after implementation.

## Pre-check (required)
- [x] Run `supabase/sql/finance_phase5_6_lock_seed_and_probe.sql` in Supabase SQL Editor
- [x] Copy the returned `period_month` and `probe_date_yyyy_mm_dd` to the Status section above

## 1) Commission split rule (UI)
- [x] Open `/admin/finance/comissoes`
- [x] Create a rule with `Split (JSON opcional)` using:

```json
[
  { "broker_name": "Corretor A", "participant_type": "corretor", "percentage": 60 },
  { "broker_name": "Parceiro B", "participant_type": "parceiro", "percentage": 40 }
]
```

- [x] Save rule successfully
- [x] Confirm rule chip shows `split 2`

## 2) Split preview + settlement
- [x] In `Calcular comissao`, select the split-enabled rule
- [x] Run `Calcular previa`
- [x] Confirm preview shows `Split:` with participant amounts
- [x] Run `Apurar e salvar`
- [x] Confirm two commission rows are created (one per participant)
- [x] Confirm amounts sum exactly to total preview commission

## 3) Period lock safeguards (expected HTTP 409)
- [x] `/api/admin/finance` write blocked in locked month
- [x] `/api/admin/finance/apar` write blocked in locked month
- [x] `/api/admin/finance/reconciliations` write blocked in locked month
- [x] `/api/admin/finance/commissions` write blocked in locked month
- [x] Every blocked call returned HTTP `409` with lock message

## 4) Evidence
- [x] Screenshot: split preview with breakdown
- [x] Screenshot: multiple commission rows created from split
- [x] Screenshot: blocked write in locked period (`409`)

## 5) API probe log (fill)
- [x] `POST /api/admin/finance` -> status: `409` | message: `Lancamento financeiro: periodo 04/2026 bloqueado para alteracoes.`
- [x] `POST /api/admin/finance/apar` -> status: `409` | message: `Contas a pagar: periodo 04/2026 bloqueado para alteracoes.`
- [x] `POST /api/admin/finance/reconciliations` -> status: `409` | message: `Conciliacao bancaria: periodo 04/2026 bloqueado para alteracoes.`
- [x] `POST /api/admin/finance/commissions` -> status: `409` | message: `Comissao: periodo 04/2026 bloqueado para alteracoes.`

## 6) Changelog closure
- [x] Update `docs/finance_upgrade_changelog.md` status from `IMPLEMENTED_PENDING_SMOKE_TEST` to `COMPLETED` after all checks pass
