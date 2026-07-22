CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- The POSTGRES_USER role Docker's postgres image creates (pos_user) is a
-- cluster superuser, and superusers unconditionally bypass Row-Level Security
-- — FORCE ROW LEVEL SECURITY has no effect on them. RLS only actually
-- protects application traffic if the application connects as a role that is
-- neither a superuser nor BYPASSRLS. pos_user stays superuser and owns the
-- schema (migrations, seeding, admin tooling run as pos_user); the API's
-- request-serving connections use pos_app instead (see APP_DATABASE_URL).
--
-- Dev-only credential, matching the existing plaintext pos_password pattern
-- in docker-compose.yml — production (Neon/Fly.io per ADR 0001) manages real
-- credentials through the hosting provider, not this bootstrap script.
CREATE ROLE pos_app LOGIN PASSWORD 'pos_app_password' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

