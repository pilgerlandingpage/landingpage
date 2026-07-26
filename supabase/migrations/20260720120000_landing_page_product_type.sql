-- Separate real-estate landing pages from product sales landing pages.
alter table if exists public.landing_pages
    add column if not exists page_type text not null default 'development';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'landing_pages_page_type_check'
    ) then
        alter table public.landing_pages
            add constraint landing_pages_page_type_check
            check (page_type in ('development', 'product'));
    end if;
end $$;

create index if not exists idx_landing_pages_page_type
    on public.landing_pages(page_type);

comment on column public.landing_pages.page_type is
    'Landing page category: development for real-estate projects, product for sales pages such as Guilherme Pilger products.';
