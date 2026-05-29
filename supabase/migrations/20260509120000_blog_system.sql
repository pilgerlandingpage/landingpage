create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content_markdown text not null,
  status text not null default 'draft' check (status in ('draft', 'under_review', 'published', 'archived')),
  cover_image_url text,
  author_name text default 'Imobiliaria Guilherme Pilger',
  category text default 'Mercado Imobiliario',
  tags jsonb not null default '[]'::jsonb,
  seo_title text,
  meta_description text,
  primary_keyword text,
  secondary_keywords jsonb not null default '[]'::jsonb,
  local_entities jsonb not null default '[]'::jsonb,
  aeo_questions jsonb not null default '[]'::jsonb,
  internal_links jsonb not null default '[]'::jsonb,
  source_summary jsonb,
  approval_notes jsonb not null default '[]'::jsonb,
  generated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists idx_blog_posts_status_published_at
  on public.blog_posts (status, published_at desc);

create index if not exists idx_blog_posts_slug
  on public.blog_posts (slug);

alter table public.blog_posts enable row level security;

drop policy if exists "Public can read published blog posts" on public.blog_posts;
create policy "Public can read published blog posts"
  on public.blog_posts for select
  using (status = 'published');

drop policy if exists "Service role manages blog posts" on public.blog_posts;
create policy "Service role manages blog posts"
  on public.blog_posts for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.set_blog_posts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_blog_posts_updated_at on public.blog_posts;
create trigger trg_blog_posts_updated_at
before update on public.blog_posts
for each row execute function public.set_blog_posts_updated_at();

insert into public.admin_permissions (module_key, label, description, category)
values ('blog', 'Blog', 'Gerenciar artigos, rascunhos e aprovacao do agente de blog', 'marketing')
on conflict (module_key) do update
set label = excluded.label,
    description = excluded.description,
    category = excluded.category;
