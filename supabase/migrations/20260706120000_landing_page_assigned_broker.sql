-- Tie each landing page directly to the broker that should receive its WhatsApp leads.
alter table if exists public.landing_pages
    add column if not exists assigned_broker_id uuid references public.virtual_brokers(id) on delete set null;

create index if not exists idx_landing_pages_assigned_broker_id
    on public.landing_pages(assigned_broker_id);

comment on column public.landing_pages.assigned_broker_id is
    'Broker selected in admin landing pages to receive WhatsApp leads for this page.';
