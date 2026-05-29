-- Rename legacy "Pilger Imoveis" brand references in persisted content.

create or replace function public.replace_pilger_imoveis_brand(input text)
returns text
language sql
immutable
as $$
  select case
    when input is null then null
    else replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    input,
                    'Guilherme Pilger Imóveis de Luxo',
                    'Imobiliaria Guilherme Pilger'
                  ),
                  'Guilherme Pilger Imoveis de Luxo',
                  'Imobiliaria Guilherme Pilger'
                ),
                'Guilherme Pilger Imóveis',
                'Imobiliaria Guilherme Pilger'
              ),
              'Guilherme Pilger Imoveis',
              'Imobiliaria Guilherme Pilger'
            ),
            'Pilger Imóveis de Luxo',
            'Imobiliaria Guilherme Pilger'
          ),
          'Pilger Imoveis de Luxo',
          'Imobiliaria Guilherme Pilger'
        ),
        'Pilger Imóveis',
        'Imobiliaria Guilherme Pilger'
      ),
      'Pilger Imoveis',
      'Imobiliaria Guilherme Pilger'
    )
  end
$$;

do $$
declare
  target record;
begin
  for target in
    select *
    from (
      values
        ('app_config', 'value', 'text'),
        ('blog_posts', 'title', 'text'),
        ('blog_posts', 'excerpt', 'text'),
        ('blog_posts', 'content_markdown', 'text'),
        ('blog_posts', 'author_name', 'text'),
        ('blog_posts', 'category', 'text'),
        ('blog_posts', 'seo_title', 'text'),
        ('blog_posts', 'meta_description', 'text'),
        ('blog_posts', 'primary_keyword', 'text'),
        ('blog_posts', 'tags', 'jsonb'),
        ('blog_posts', 'secondary_keywords', 'jsonb'),
        ('blog_posts', 'local_entities', 'jsonb'),
        ('blog_posts', 'aeo_questions', 'jsonb'),
        ('blog_posts', 'internal_links', 'jsonb'),
        ('blog_posts', 'source_summary', 'jsonb'),
        ('blog_posts', 'approval_notes', 'jsonb'),
        ('landing_pages', 'title', 'text'),
        ('landing_pages', 'description', 'text'),
        ('landing_pages', 'custom_prompt', 'text'),
        ('landing_pages', 'content', 'jsonb'),
        ('landing_pages', 'metadata', 'jsonb'),
        ('virtual_brokers', 'name', 'text'),
        ('virtual_brokers', 'system_prompt', 'text'),
        ('event_events', 'title', 'text'),
        ('event_events', 'eyebrow', 'text'),
        ('event_events', 'subtitle', 'text'),
        ('event_events', 'description', 'text'),
        ('event_events', 'content', 'text'),
        ('event_events', 'location_name', 'text'),
        ('event_events', 'location_address', 'text'),
        ('event_events', 'target_audience', 'text'),
        ('event_events', 'confirmation_message_template', 'text'),
        ('event_events', 'reminder_message_template', 'text'),
        ('event_events', 'agenda', 'jsonb'),
        ('event_events', 'metadata', 'jsonb'),
        ('event_registrations', 'real_estate_name', 'text'),
        ('event_registrations', 'metadata', 'jsonb'),
        ('event_automation_rules', 'name', 'text'),
        ('event_automation_rules', 'message_template', 'text'),
        ('event_automation_rules', 'metadata', 'jsonb'),
        ('event_message_queue', 'content', 'text'),
        ('event_message_queue', 'provider_response', 'jsonb'),
        ('event_message_queue', 'metadata', 'jsonb'),
        ('event_agent_logs', 'message', 'text'),
        ('event_agent_logs', 'metadata', 'jsonb'),
        ('ai_research_reports', 'topic', 'text'),
        ('ai_research_reports', 'executive_summary', 'text'),
        ('ai_research_reports', 'report_markdown', 'text'),
        ('ai_research_reports', 'sources', 'jsonb'),
        ('ai_research_reports', 'queries', 'jsonb'),
        ('ecosystem_events', 'label', 'text'),
        ('ecosystem_events', 'metadata', 'jsonb'),
        ('ecosystem_context_snapshots', 'summary', 'text'),
        ('ecosystem_context_snapshots', 'signals', 'jsonb'),
        ('ecosystem_context_snapshots', 'source_summary', 'jsonb')
    ) as columns_to_clean(table_name, column_name, column_kind)
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = target.table_name
        and column_name = target.column_name
    ) then
      if target.column_kind = 'jsonb' then
        execute format(
          'update public.%I set %I = public.replace_pilger_imoveis_brand(%I::text)::jsonb where %I::text ilike %L',
          target.table_name,
          target.column_name,
          target.column_name,
          target.column_name,
          '%Pilger Im%'
        );
      else
        execute format(
          'update public.%I set %I = public.replace_pilger_imoveis_brand(%I) where %I ilike %L',
          target.table_name,
          target.column_name,
          target.column_name,
          target.column_name,
          '%Pilger Im%'
        );
      end if;
    end if;
  end loop;
end $$;

drop function if exists public.replace_pilger_imoveis_brand(text);
