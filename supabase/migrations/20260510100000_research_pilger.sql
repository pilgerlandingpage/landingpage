create table if not exists public.ai_research_reports (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  requester text not null default 'manual',
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  depth text not null default 'media',
  executive_summary text,
  report_markdown text,
  sources jsonb not null default '[]'::jsonb,
  queries jsonb not null default '[]'::jsonb,
  raw_response jsonb,
  error_message text,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_research_reports_created_at
  on public.ai_research_reports (created_at desc);

create index if not exists idx_ai_research_reports_status
  on public.ai_research_reports (status);

alter table public.ai_research_reports enable row level security;

drop policy if exists "Service role manages ai research reports" on public.ai_research_reports;
create policy "Service role manages ai research reports"
  on public.ai_research_reports for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.set_ai_research_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ai_research_reports_updated_at on public.ai_research_reports;
create trigger trg_ai_research_reports_updated_at
before update on public.ai_research_reports
for each row execute function public.set_ai_research_reports_updated_at();

insert into public.admin_permissions (module_key, label, description, category)
values ('research', 'Pesquisa Profunda IA', 'Executar e consultar pesquisas externas do Research Pilger', 'inteligencia')
on conflict (module_key) do update
set label = excluded.label,
    description = excluded.description,
    category = excluded.category;
