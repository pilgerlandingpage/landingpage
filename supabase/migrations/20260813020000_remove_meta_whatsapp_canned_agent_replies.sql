-- Remove legacy canned replies from the Meta WhatsApp agent configuration.
-- Agente Guilherme now uses its LLM prompt and runtime guardrails instead of editable ready-made replies.

DELETE FROM public.app_config
WHERE key IN (
  'meta_whatsapp_triage_interest_reply',
  'meta_whatsapp_triage_opt_out_reply',
  'meta_whatsapp_triage_privacy_reply',
  'meta_whatsapp_agent_unknown_reply'
);
