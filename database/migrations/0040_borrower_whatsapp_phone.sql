-- Keep the WhatsApp contact separate from the primary phone so collectors
-- can reach the client through the channel they actually use.

ALTER TABLE borrowers
  ADD COLUMN whatsapp_phone text NULL;
