-- WhatsApp AI: mirror mode + human takeover + voice cloning support

-- 1) Broker-level cloned voice selection (ElevenLabs Voice ID)
ALTER TABLE public.virtual_brokers
  ADD COLUMN IF NOT EXISTS voice_id TEXT;

-- 2) Track outbound bot message ids to distinguish bot vs human "fromMe"
ALTER TABLE public.whatsapp_ai_conversations
  ADD COLUMN IF NOT EXISTS bot_message_ids TEXT[] DEFAULT '{}'::text[];

-- 3) Allow human_takeover status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_ai_conversations_status_check'
      AND conrelid = 'public.whatsapp_ai_conversations'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_ai_conversations
      DROP CONSTRAINT whatsapp_ai_conversations_status_check;
  END IF;
END $$;

ALTER TABLE public.whatsapp_ai_conversations
  ADD CONSTRAINT whatsapp_ai_conversations_status_check
  CHECK (status IN ('active', 'human_takeover', 'transferred', 'closed'));

-- 4) Speed up bot id lookup used by webhook takeover detection
CREATE INDEX IF NOT EXISTS idx_ai_conv_bot_message_ids
  ON public.whatsapp_ai_conversations
  USING GIN (bot_message_ids);
