# Finance Smoke Test - 2026-04-23

Use this checklist after SQL validation.

## Status
- SQL validation: completed (`GO` on go-live report).
- Manual closure: completed.

- [x] `/admin/finance` loads without UI/API errors
- [x] `/admin/finance/contas-a-pagar` list loads and create/edit/delete basic flow works
- [x] `/admin/finance/contas-a-receber` list loads and create/edit/delete basic flow works
- [x] `/admin/finance/comissoes` list and details load without errors
- [x] `/admin/finance/conciliacao-bancaria` list/actions load without errors
- [x] `/admin/finance/fechamento-mensal` period list and actions load without errors
- [x] `/admin/finance/exportacao-contabil` generate and download CSV works

## Evidence
- [x] Screenshot: integrity check SQL result
- [x] Screenshot: go-live report SQL result (`GO`)

## Final note
- [x] Changelog updated in `docs/finance_upgrade_changelog.md`
- [x] Validation cycle closed on 2026-04-23
