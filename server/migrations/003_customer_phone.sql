-- Telefone internacional opcional: contas antigas continuam entrando por email.
ALTER TABLE users ADD COLUMN phone text UNIQUE CHECK(phone ~ '^\+[1-9][0-9]{7,14}$');
