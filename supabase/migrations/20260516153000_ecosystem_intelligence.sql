-- Central de Inteligencia Pilger
-- Memoria consolidada para sincronizar agentes de Blog, Noticias, WhatsApp, Radar, Trafego e CEO.

create extension if not exists pgcrypto;

create table if not exists public.ecosystem_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_type text not null default 'system',
  lead_id uuid null,
  visitor_id uuid null,
  entity_type text null,
  entity_id text null,
  source text null,
  label text null,
  metadata jsonb not null default '{}'::jsonb,
  importance_score integer not null default 0,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists ecosystem_events_event_type_idx on public.ecosystem_events(event_type);
create index if not exists ecosystem_events_lead_id_idx on public.ecosystem_events(lead_id);
create index if not exists ecosystem_events_visitor_id_idx on public.ecosystem_events(visitor_id);
create index if not exists ecosystem_events_entity_idx on public.ecosystem_events(entity_type, entity_id);
create index if not exists ecosystem_events_occurred_at_idx on public.ecosystem_events(occurred_at desc);
create index if not exists ecosystem_events_metadata_idx on public.ecosystem_events using gin(metadata);

create table if not exists public.ecosystem_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'global',
  agent text not null default 'global',
  subject_id text null,
  period_start timestamptz null,
  period_end timestamptz null,
  status text not null default 'completed',
  summary text null,
  signals jsonb not null default '{}'::jsonb,
  source_counts jsonb not null default '{}'::jsonb,
  source_summary jsonb not null default '{}'::jsonb,
  created_by text not null default 'ecosystem-intelligence',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ecosystem_context_snapshots_agent_idx on public.ecosystem_context_snapshots(agent);
create index if not exists ecosystem_context_snapshots_scope_idx on public.ecosystem_context_snapshots(scope, subject_id);
create index if not exists ecosystem_context_snapshots_generated_at_idx on public.ecosystem_context_snapshots(generated_at desc);
create index if not exists ecosystem_context_snapshots_signals_idx on public.ecosystem_context_snapshots using gin(signals);

create or replace function public.update_ecosystem_context_snapshots_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists ecosystem_context_snapshots_updated_at on public.ecosystem_context_snapshots;
create trigger ecosystem_context_snapshots_updated_at
before update on public.ecosystem_context_snapshots
for each row execute function public.update_ecosystem_context_snapshots_updated_at();

alter table public.ecosystem_events enable row level security;
alter table public.ecosystem_context_snapshots enable row level security;

drop policy if exists "Service role manages ecosystem events" on public.ecosystem_events;
create policy "Service role manages ecosystem events"
on public.ecosystem_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Service role manages ecosystem snapshots" on public.ecosystem_context_snapshots;
create policy "Service role manages ecosystem snapshots"
on public.ecosystem_context_snapshots
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

insert into public.app_config(key, value, updated_at)
values
  ('ecosystem_intelligence_enabled', 'true', now()),
  ('ecosystem_intelligence_interval_hours', '6', now()),
  ('ecosystem_intelligence_snapshot_days', '30', now())
on conflict (key) do nothing;

insert into public.admin_permissions(module_key, label, description, category)
values (
  'intelligence',
  'Central de Inteligencia',
  'Acessar memoria sincronizada dos agentes e sinais do ecossistema',
  'inteligencia'
)
on conflict (module_key) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category;
