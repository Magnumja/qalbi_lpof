-- Foto na conversa: a mídia fica ligada ao pedido e só participantes a veem.
ALTER TABLE media ADD COLUMN owner_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE media ADD COLUMN order_id uuid REFERENCES orders(id) ON DELETE CASCADE;
CREATE INDEX media_order ON media(order_id) WHERE order_id IS NOT NULL;
ALTER TABLE messages ADD COLUMN media_id uuid REFERENCES media(id);
ALTER TABLE messages DROP CONSTRAINT messages_body_check;
ALTER TABLE messages ADD CONSTRAINT messages_body_check CHECK (char_length(body) <= 4000 AND (char_length(body) >= 1 OR media_id IS NOT NULL));
