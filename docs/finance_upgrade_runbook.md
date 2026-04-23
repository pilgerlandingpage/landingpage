# Finance Upgrade Runbook

## Objective
Standardize how we run and validate finance schema/app changes without data loss.

## Important
- This `.md` file is documentation only. Do not run it in SQL Editor.
- Run only `.sql` files in Supabase SQL Editor.

## 1) Before any new change
Run:
- `supabase/sql/finance_upgrade_pre_snapshot.sql`

Then replace:
- `pre_upgrade_YYYY_MM_DD` -> `pre_upgrade_2026_04_23` (example for April 23, 2026)

## 2) Apply migration
Run the target migration SQL in Supabase SQL Editor.

## 3) After migration
Run:
- `supabase/sql/finance_upgrade_integrity_check.sql`
- `supabase/sql/finance_upgrade_go_live_report.sql`

Expected final statuses:
- Preferred: `GO`
- Acceptable (legacy scenario): `GO_LIMITED_BASELINE`

Blocker statuses:
- `REVIEW_BASELINE_DIVERGENCE`
- `REVIEW_INTEGRITY_ISSUES`
- `BLOCKED_MISSING_POST`

## 4) Create post snapshot
Run:
- `supabase/sql/finance_upgrade_post_snapshot.sql`

Then replace:
- `post_upgrade_YYYY_MM_DD` -> `post_upgrade_2026_04_23` (example for April 23, 2026)

## 5) App smoke tests
Validate these pages:
- `/admin/finance`
- `/admin/finance/contas-a-pagar`
- `/admin/finance/contas-a-receber`
- `/admin/finance/fluxo-caixa`
- `/admin/finance/dre-gerencial`
- `/admin/finance/comissoes`
- `/admin/finance/conciliacao-bancaria`
- `/admin/finance/fechamento-mensal`
- `/admin/finance/exportacao-contabil`

## 6) Evidence to store
- Screenshot of integrity SQL result
- Screenshot of go-live report result
- Snapshot tags used (`pre` and `post`)
- Short note in `docs/finance_upgrade_changelog.md` with date and operator
