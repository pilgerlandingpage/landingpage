# Finance Smoke Test - 2026-04-23

Use this checklist after SQL validation.

## Status
- SQL validation: completed (`GO` on go-live report).
- Manual closure: pending operator checks below.

- [ ] `/admin/finance` loads without UI/API errors
- [ ] `/admin/finance/contas-a-pagar` list loads and create/edit/delete basic flow works
- [ ] `/admin/finance/contas-a-receber` list loads and create/edit/delete basic flow works
- [ ] `/admin/finance/comissoes` list and details load without errors
- [ ] `/admin/finance/conciliacao-bancaria` list/actions load without errors
- [ ] `/admin/finance/fechamento-mensal` period list and actions load without errors
- [ ] `/admin/finance/exportacao-contabil` generate and download CSV works

## Evidence
- [ ] Screenshot: integrity check SQL result
- [ ] Screenshot: go-live report SQL result (`GO`)

## Final note
- [x] Changelog updated in `docs/finance_upgrade_changelog.md`
