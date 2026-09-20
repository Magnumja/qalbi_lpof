CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  image_url text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents BETWEEN 100 AND 1000000),
  kind text NOT NULL CHECK (kind IN ('ready','made_to_order')),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  lead_days integer NOT NULL DEFAULT 7 CHECK (lead_days BETWEEN 1 AND 365),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id),
  request_key uuid NOT NULL,
  request_hash text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('shop','custom')),
  status text NOT NULL CHECK (status IN ('requested','awaiting_payment','confirmed','in_progress','ready','shipped','completed','cancelled')),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','pending','paid','refunded')),
  total_cents integer CHECK (total_cents BETWEEN 100 AND 2000000),
  shipping_cents integer NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  currency text NOT NULL DEFAULT 'eur',
  brief text NOT NULL DEFAULT '',
  address jsonb NOT NULL,
  due_at date,
  tracking text NOT NULL DEFAULT '',
  checkout_id text UNIQUE,
  checkout_url text,
  checkout_expires_at timestamptz,
  inventory_released boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, request_key)
);
CREATE INDEX orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX orders_due ON orders(due_at) WHERE status NOT IN ('completed','cancelled');
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  title text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 100),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  reserved_stock boolean NOT NULL DEFAULT false
);
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_order_created ON messages(order_id, created_at);
CREATE TABLE order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id),
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE stripe_events (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rate_limits (
  key text PRIMARY KEY,
  hits integer NOT NULL,
  expires_at timestamptz NOT NULL
);
ALTER TABLE orders ADD COLUMN production_days integer NOT NULL DEFAULT 7;
ALTER TABLE orders ADD COLUMN payment_intent text UNIQUE;
