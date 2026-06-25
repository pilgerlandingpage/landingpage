-- Allow broker-authorized phones to be explicitly registered as internal
-- Global identities. Runtime already resolves this identity type from
-- broker_assistant_authorized_phones; overrides need the same vocabulary.

ALTER TABLE public.whatsapp_global_identity_overrides
  DROP CONSTRAINT IF EXISTS whatsapp_global_identity_overrides_identity_type_check;

ALTER TABLE public.whatsapp_global_identity_overrides
  ADD CONSTRAINT whatsapp_global_identity_overrides_identity_type_check
  CHECK (identity_type IN (
    'admin_user',
    'broker_user',
    'broker_authorized',
    'property_owner',
    'lead',
    'blocked'
  ));
