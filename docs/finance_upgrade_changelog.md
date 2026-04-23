# Finance Upgrade Changelog

## 2026-04-23 - Real data organization after spreadsheet import
- Status: `COMPLETED_WITH_PENDING_ENRICHMENT`
- Operator: `connectyhub`
- Scope:
  - executed idempotent real-data organization script:
    - `supabase/sql/finance_finalize_real_data_organization.sql`
  - run evidence guide:
    - `docs/finance_real_data_finalization_2026_04_23.md`
- Result snapshot:
  - `entries_total`: `114`
  - `entries_without_counterparty`: `16`
  - `entries_without_cost_center`: `57`
  - `payables_linked_to_entries`: `57`
  - `receivables_linked_to_entries`: `57`
  - `categories_total`: `10`
  - `subcategories_total`: `68`
  - `counterparties_total`: `57`
- Notes:
  - legacy entries were organized into AP/AR without duplication.
  - remaining blanks are enrichment-only gaps (`counterparty`/`cost_center`) and do not indicate data loss.

## 2026-04-23 - Phase 5/6 smoke execution kickoff
- Status: `COMPLETED`
- Operator: `connectyhub`
- Scope:
  - added SQL helper to seed/confirm locked period:
    - `supabase/sql/finance_phase5_6_lock_seed_and_probe.sql`
  - standardized execution checklist:
    - `docs/finance_phase5_6_smoke_test_2026_04_23.md`
  - added step-by-step execution guide with API probe payloads:
    - `docs/finance_phase5_6_execution_guide_2026_04_23.md`
- Notes:
  - Manual evidence collected.
  - Lock probes returned expected `409` on all targets:
    - `/api/admin/finance`
    - `/api/admin/finance/apar`
    - `/api/admin/finance/reconciliations`
    - `/api/admin/finance/commissions`

## 2026-04-23 - Commissions split + period lock safeguards
- Status: `COMPLETED`
- Operator: `connectyhub`
- Scope:
  - hard-lock de periodo em rotas de escrita:
    - `/api/admin/finance` (`POST/PUT/DELETE`)
    - `/api/admin/finance/apar` (`POST/PUT/DELETE`)
    - `/api/admin/finance/reconciliations` (`POST/PUT/DELETE`)
    - `/api/admin/finance/commissions` (`POST/PUT/DELETE`, entidade `commission`, e `calculate create_record`)
  - helper comum de lock: `app/api/admin/finance/_lib/period-lock.ts`
  - split de comissao por regra (`split_payload`) com criacao automatica de multiplas comissoes
  - UI em `/admin/finance/comissoes`:
    - campo `Split (JSON opcional)` no cadastro de regra
    - indicador de split na listagem de regras
    - previa exibindo `split_breakdown`
- Validation:
  - lint local das rotas/UI alteradas: `OK`
  - smoke manual concluido (fluxo de split + tentativa de alteracao em periodo bloqueado)
  - resultado de lock: `409` confirmado em todos os endpoints protegidos

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
