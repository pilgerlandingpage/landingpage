# Finance Real Data Finalization (2026-04-23)

## Context
Real data imported from spreadsheet is already in `finance_entries`, but still needs final organization in the upgraded structure.

## Script to run
- `supabase/sql/finance_finalize_real_data_organization.sql`

## What this script does
- normalizes legacy text fields (`description`, `category`, `subcategory`, `payment_method`, `notes`)
- enriches missing `subcategory` from notes/description
- enriches missing `counterparty_name` from `Origem:` (notes), `Prestadores`, and description fallback
- sets `reference_company` from `Responsavel:` in notes when missing
- creates/matches `finance_cost_centers` and fills `cost_center_id` when possible
- ensures every legacy entry is represented in AP/AR (`finance_payables` / `finance_receivables`) without duplication
- syncs empty AP/AR descriptive fields from source entries
- refreshes lookups (`finance_categories`, `finance_subcategories`, `finance_payment_methods`, `finance_counterparties`)
- returns final verification counters

## Run order
1. Open Supabase SQL Editor.
2. Run `supabase/sql/finance_finalize_real_data_organization.sql`.
3. Save result screenshot of final verification query.
4. Run `supabase/sql/finance_upgrade_integrity_check.sql` and confirm no integrity issue.
5. Run `supabase/sql/finance_upgrade_go_live_report.sql` and confirm final status remains `GO`.

## Expected outcome
- fewer or zero entries without `counterparty_name`
- fewer or zero entries without `cost_center_id` (when notes include `Responsavel`)
- AP/AR linked to `finance_entries` by `source_entry_id`
- lookups consistent with imported real data

## Execution result (2026-04-23)
- `entries_total`: `114`
- `entries_without_counterparty`: `16`
- `entries_without_cost_center`: `57`
- `payables_linked_to_entries`: `57`
- `receivables_linked_to_entries`: `57`
- `categories_total`: `10`
- `subcategories_total`: `68`
- `counterparties_total`: `57`

Interpretation:
- AP/AR linkage is healthy (`57` payables + `57` receivables = `114` entries mapped).
- Catalogs are populated and active.
- Remaining gaps are concentrated in legacy enrichment (`counterparty` and `cost_center`) and can be handled by a targeted cleanup pass before final go-live signoff.
