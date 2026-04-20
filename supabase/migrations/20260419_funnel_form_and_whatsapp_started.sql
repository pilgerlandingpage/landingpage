-- Incremental migration (safe/idempotent)
-- Adds only new data points for the new funnel stages

-- Optional normalized phone for safer matching (site <-> whatsapp)
alter table public.leads
    add column if not exists phone_e164 text;

-- Marks first whatsapp conversation start time on lead (for future analytics)
alter table public.leads
    add column if not exists conversation_started_at timestamptz;

-- Helpful indexes for dashboard/funnel performance
create index if not exists idx_funnel_events_type_created
    on public.funnel_events (event_type, created_at desc);

create index if not exists idx_leads_phone_e164
    on public.leads (phone_e164);

