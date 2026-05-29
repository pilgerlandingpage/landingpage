insert into app_config (key, value, updated_at)
values
  ('facebook_login_configuration_id', '962122286613191', now())
on conflict (key) do update
set value = excluded.value,
    updated_at = excluded.updated_at;
