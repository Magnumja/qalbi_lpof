-- Leitura por pessoa: permite contar mensagens novas para cliente e atelier.
CREATE TABLE order_reads (
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, user_id)
);
-- Link de acesso único gerado pelo atelier para recuperar a conta do cliente.
CREATE TABLE access_links (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX access_links_user ON access_links(user_id);
