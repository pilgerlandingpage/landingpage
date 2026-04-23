# Finance Upgrade Changelog

## 2026-04-23 - Commissions split + period lock safeguards
- Status: `IMPLEMENTED_PENDING_SMOKE_TEST`
- Operator: `connectyhub`
- Scope:
  - hard-lock de período em rotas de escrita:
    - `/api/admin/finance` (`POST/PUT/DELETE`)
    - `/api/admin/finance/apar` (`POST/PUT/DELETE`)
    - `/api/admin/finance/reconciliations` (`POST/PUT/DELETE`)
    - `/api/admin/finance/commissions` (`POST/PUT/DELETE`, entidade `commission`, e `calculate create_record`)
  - helper comum de lock: `app/api/admin/finance/_lib/period-lock.ts`
  - split de comissão por regra (`split_payload`) com criação automática de múltiplas comissões
  - UI em `/admin/finance/comissoes`:
    - campo `Split (JSON opcional)` no cadastro de regra
    - indicador de split na listagem de regras
    - prévia exibindo `split_breakdown`
- Validation:
  - lint local das rotas/UI alteradas: `OK`
  - smoke manual pendente (fluxo de split + tentativa de alteração em período bloqueado)

## 2026-04-23 - Finance upgrade validation
- Status: `GO`
- Operator: `connectyhub`
- Snapshots: `pre_upgrade_2026_04_23`, `post_upgrade_2026_04_23`
- Evidence: integrity check + go-live report screenshots
- Notes: All integrity counters at zero and baseline diffs at zero. Finance go-live approved.

## 2026-04-23 - Finance reporting phase (implementation)
- Status: `COMPLETED`
- Operator: `connectyhub`
- Scope: added `Fluxo de Caixa` and `DRE Gerencial` pages + `/api/admin/finance/reports`
- Manual validation checklist: `docs/finance_upgrade_reporting_smoke_test_2026_04_23.md`
- Notes: reporting smoke test completed with both pages loading and showing expected data.
