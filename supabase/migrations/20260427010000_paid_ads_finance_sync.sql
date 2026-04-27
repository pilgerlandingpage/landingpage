-- Paid ads finance sync support
-- Prevent duplicate finance entries for monthly Meta/Google Ads spend.

CREATE UNIQUE INDEX IF NOT EXISTS ux_finance_entries_paid_ads_reference
ON public.finance_entries (source_module, external_reference)
WHERE source_module = 'paid_ads'
  AND external_reference IS NOT NULL;
