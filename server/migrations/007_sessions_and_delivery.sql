-- Sessões visíveis ao usuário: quando começou, último uso e um rótulo do aparelho.
ALTER TABLE sessions ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE sessions ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE sessions ADD COLUMN label text NOT NULL DEFAULT '';
-- Entrega de avisos fora da transação: a linha é reservada antes do envio.
ALTER TABLE notifications ADD COLUMN claimed_at timestamptz;
-- Aviso de novo acesso não pertence a um pedido.
ALTER TABLE notifications ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('message','quote','paid','status','login'));
