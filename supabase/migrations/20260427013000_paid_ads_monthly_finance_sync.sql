-- Paid ads monthly finance sync support
-- Prevent duplicate finance entries for each platform/month pair.

CREATE UNIQUE INDEX IF NOT EXISTS ux_finance_entries_paid_ads_monthly_reference
ON public.finance_entries (source_module, external_reference)
WHERE source_module = 'paid_ads_monthly'
  AND external_reference IS NOT NULL;
