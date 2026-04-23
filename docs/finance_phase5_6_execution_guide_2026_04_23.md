# Finance Phase 5/6 - Execution Guide (2026-04-23)

## Goal
Finish the pending validation for:
- commission split flow
- period lock (`locked`) safeguards with HTTP 409

## Step 1 - Seed locked period
1. Open Supabase SQL Editor.
2. Run:
   - `supabase/sql/finance_phase5_6_lock_seed_and_probe.sql`
3. Copy:
   - `period_month` (example: `2026-04-01`)
   - `probe_date_yyyy_mm_dd` (example: `2026-04-15`)
4. Paste both values in:
   - `docs/finance_phase5_6_smoke_test_2026_04_23.md`

## Step 2 - Validate split in UI
1. Open `/admin/finance/comissoes`.
2. Create a rule with split JSON:

```json
[
  { "broker_name": "Corretor A", "participant_type": "corretor", "percentage": 60 },
  { "broker_name": "Parceiro B", "participant_type": "parceiro", "percentage": 40 }
]
```

3. Run `Calcular previa` and confirm `Split:` appears.
4. Run `Apurar e salvar`.
5. Confirm:
   - two commission rows were created
   - sum of row amounts equals preview total

## Step 3 - Validate lock HTTP 409 (browser console)
Run the snippets below while logged in Admin (same tab/session).

Replace `LOCK_DATE` with the `probe_date_yyyy_mm_dd` value from Step 1.

### 3.1 Finance entries
```js
const LOCK_DATE = '2026-04-15'
await fetch('/api/admin/finance', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    description: 'LOCK TEST ENTRY',
    entry_type: 'expense',
    amount: 10.5,
    entry_date: LOCK_DATE,
  }),
}).then(async (r) => ({ status: r.status, body: await r.json() }))
```

Expected: `status = 409`.

### 3.2 AP/AR
```js
const LOCK_DATE = '2026-04-15'
await fetch('/api/admin/finance/apar', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'payable',
    description: 'LOCK TEST APAR',
    amount: 10.5,
    due_date: LOCK_DATE,
  }),
}).then(async (r) => ({ status: r.status, body: await r.json() }))
```

Expected: `status = 409`.

### 3.3 Reconciliations
```js
const LOCK_DATE = '2026-04-15'
await fetch('/api/admin/finance/reconciliations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    statement_date: LOCK_DATE,
    description: 'LOCK TEST RECON',
    amount: 10.5,
    status: 'pending',
  }),
}).then(async (r) => ({ status: r.status, body: await r.json() }))
```

Expected: `status = 409`.

### 3.4 Commissions
```js
const LOCK_DATE = '2026-04-15'
await fetch('/api/admin/finance/commissions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entity: 'commission',
    broker_name: 'LOCK TEST BROKER',
    commission_amount: 10.5,
    due_date: LOCK_DATE,
    source_ref_type: 'manual',
  }),
}).then(async (r) => ({ status: r.status, body: await r.json() }))
```

Expected: `status = 409`.

## Step 4 - Evidence and closure
1. Save 3 screenshots:
   - split preview with breakdown
   - multiple rows created from split
   - any API 409 blocked write
2. Fill all checkboxes in:
   - `docs/finance_phase5_6_smoke_test_2026_04_23.md`
3. Update changelog status to `COMPLETED` in:
   - `docs/finance_upgrade_changelog.md`
