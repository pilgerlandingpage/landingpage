type SupabaseAdminLike = {
  from: (table: string) => any
}

export async function saveAppConfig(supabase: SupabaseAdminLike, key: string, value: string) {
  const { error } = await supabase
    .from('app_config')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (error) throw new Error(`Erro ao salvar ${key}: ${error.message}`)
}

export async function markAgentStarted(supabase: SupabaseAdminLike, prefix: string) {
  await saveAppConfig(supabase, `${prefix}_last_started_at`, new Date().toISOString())
}

export async function markAgentCompleted(supabase: SupabaseAdminLike, prefix: string, result?: unknown) {
  const now = new Date().toISOString()
  await Promise.all([
    saveAppConfig(supabase, `${prefix}_last_run_at`, now),
    saveAppConfig(supabase, `${prefix}_last_started_at`, now),
    saveAppConfig(supabase, `${prefix}_last_error`, ''),
    saveAppConfig(supabase, `${prefix}_last_error_at`, ''),
    result === undefined
      ? Promise.resolve()
      : saveAppConfig(supabase, `${prefix}_last_result`, JSON.stringify(result).slice(0, 2000)),
  ])
}

export async function markAgentFailed(supabase: SupabaseAdminLike, prefix: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Erro desconhecido')
  await Promise.all([
    saveAppConfig(supabase, `${prefix}_last_error`, message.slice(0, 500)),
    saveAppConfig(supabase, `${prefix}_last_error_at`, new Date().toISOString()),
  ])
}
