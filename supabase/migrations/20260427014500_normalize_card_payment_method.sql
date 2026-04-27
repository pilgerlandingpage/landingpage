-- Normalize credit card payment method labels used by finance automation.

INSERT INTO public.finance_payment_methods (name, is_active, updated_at)
VALUES ('Cartao', TRUE, NOW())
ON CONFLICT (name) DO UPDATE
SET is_active = TRUE,
    updated_at = NOW();

UPDATE public.finance_entries
SET payment_method = 'Cartao',
    updated_at = NOW()
WHERE payment_method IS NOT NULL
  AND LOWER(BTRIM(payment_method)) IN (
    'cartao',
    U&'cart\00E3o',
    'cartao credito',
    U&'cart\00E3o cr\00E9dito',
    'cartao de credito',
    U&'cart\00E3o de cr\00E9dito'
  );

UPDATE public.finance_payables
SET payment_method = 'Cartao',
    updated_at = NOW()
WHERE payment_method IS NOT NULL
  AND LOWER(BTRIM(payment_method)) IN (
    'cartao',
    U&'cart\00E3o',
    'cartao credito',
    U&'cart\00E3o cr\00E9dito',
    'cartao de credito',
    U&'cart\00E3o de cr\00E9dito'
  );

UPDATE public.finance_receivables
SET payment_method = 'Cartao',
    updated_at = NOW()
WHERE payment_method IS NOT NULL
  AND LOWER(BTRIM(payment_method)) IN (
    'cartao',
    U&'cart\00E3o',
    'cartao credito',
    U&'cart\00E3o cr\00E9dito',
    'cartao de credito',
    U&'cart\00E3o de cr\00E9dito'
  );

DELETE FROM public.finance_payment_methods
WHERE name <> 'Cartao'
  AND LOWER(BTRIM(name)) IN (
    'cartao',
    U&'cart\00E3o',
    'cartao credito',
    U&'cart\00E3o cr\00E9dito',
    'cartao de credito',
    U&'cart\00E3o de cr\00E9dito'
  );
