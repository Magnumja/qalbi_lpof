-- Avisos por email: fila persistida, entregue pela manutenção da API.
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('message','quote','paid','status')),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  error text
);
CREATE INDEX notifications_pending ON notifications(created_at) WHERE sent_at IS NULL;
-- Cliente pode desligar; administradores recebem sempre.
ALTER TABLE users ADD COLUMN email_notifications boolean NOT NULL DEFAULT true;
