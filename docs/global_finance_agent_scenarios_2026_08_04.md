# WhatsApp Global Finance Agent - Scenarios

Date: 2026-08-04

Scope: internal WhatsApp Global finance assistant. Lead attendance remains unchanged.

## Catalog Model

The current finance module has these operational catalogs:

- `finance_categories`
- `finance_subcategories`
- `finance_payment_methods`
- `finance_counterparties`
- `finance_cost_centers`
- `finance_bank_accounts`
- `finance_entities`
- `finance_tags`
- `finance_entry_tags`
- `finance_payable_tags`

The agent also repeats operational tags in notes when that column exists, so the context stays visible even before tag UI/reporting is expanded.

## Expected Rules

- If a message is not finance, internal Global does not trigger other sectors.
- If a paid expense has no payment method, the agent asks for it.
- If PF/PJ entity is missing, the agent asks whether the launch is for pessoa fisica or pessoa juridica.
- If category, subcategory, payment method, counterparty or cost center is missing from the catalog, the agent shows the draft and asks confirmation before creating catalog records.
- After confirmation, the agent creates the missing catalog records and then creates the finance entry/payable.
- If the period is locked, the agent must not create the entry/payable.

## Scenarios

| # | User message | Expected behavior |
|---|---|---|
| 1 | `lanca pagamento de R$ 83 para Joao da Padaria no pix na pessoa juridica` | Creates/uses counterparty `Joao da Padaria`, category `Consumo despesas / Alimentacao`, method `PIX`, then records a paid expense after confirmation if any catalog item is new. |
| 2 | `lanca esse comprovante como aluguel na pessoa juridica` with receipt image/PDF | Reads media context, categorizes as `Custos Fixos / Aluguel`, asks only missing data such as payment method or amount. |
| 3 | `paguei R$ 450 para Mercado Central via Mercado Pago Pix na pessoa juridica` | Creates/uses payment method `Mercado Pago Pix`, counterparty `Mercado Central`, category `Consumo despesas / Alimentacao`. |
| 4 | `cria 4 parcelas de R$ 5.000 para fornecedor ABC todo dia 10 na pessoa juridica` | Creates four open payables in `finance_payables`; asks/creates counterparty if new. |
| 5 | `o que tenho que pagar hoje` | Queries open/overdue payables due today and returns a natural summary. |
| 6 | `lanca R$ 220 no centro de custo Evento Verano, categoria Eventos, subcategoria Alimentacao, pix, pessoa juridica` | Creates/uses category/subcategory/cost center/method, then records the expense after confirmation if any are new. |
| 7 | `paguei R$ 120 para cartorio no pix pessoa juridica` | Categorizes as `Juridico / Cartorio`, creates/uses counterparty, records paid expense. |
| 8 | `paguei R$ 310 para contador via TED pessoa juridica` | Categorizes as `Custos Fixos / Contabilidade`, uses method `TED`, creates/uses counterparty. |
| 9 | `paguei R$ 98 de internet no cartao pessoa juridica` | Categorizes as `Custos Fixos / Internet`, method `Cartao`, asks only if a needed catalog item is missing. |
| 10 | `lanca pagamento de R$ 600 para Maria, pessoa fisica, dinheiro` | Creates/uses PF counterparty `Maria`, method `Dinheiro`, asks classification if category is unclear. |
| 11 | Receipt PDF only, no text | Agent comments what it detected and asks missing fields in natural language. |
| 12 | `lanca R$ 300 para Joao da Padaria` | Asks at least PF/PJ entity and payment method before recording. |
| 13 | `categoria nova Eventos para esse pagamento de R$ 900 no pix pessoa juridica` | Prepares category `Eventos`; asks confirmation before creating catalog and entry. |
| 14 | `nao lanca` while a draft is pending | Cancels the pending finance draft. |
| 15 | `sim` while a catalog-creation draft is pending | Creates missing catalog records, records the entry/payable, clears pending state. |
| 16 | Photo of a mug/cup with no finance text | Internal Global replies naturally as a work partner and does not create a finance draft. |
| 17 | Photo of a mug/cup + `comprei essa caneca e quero lancar no financeiro` | Classifies as finance, starts a draft and asks missing fields such as amount, PF/PJ, payment method and category. |
| 18 | `como esta nosso trafego pago` | Internal Global blocks non-finance sector and does not call traffic agent. |

## Manual QA Checklist

- Confirm the message is sent from a user with finance/admin permission.
- Confirm the Global WhatsApp instance is used.
- Test one scenario with only text.
- Test one scenario with image receipt.
- Test one scenario with PDF receipt.
- Test one scenario with audio after a receipt.
- Verify created records in `finance_entries` or `finance_payables`.
- Verify new catalog records in lookups.
- Verify tags in `finance_tags` plus links in `finance_entry_tags` or `finance_payable_tags`.
- Verify notes include `Tags operacionais` when the entry/payable table has notes.
