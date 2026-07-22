-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fast LIKE/ILIKE for customer name search
CREATE EXTENSION IF NOT EXISTS "unaccent";   -- accent-insensitive search (French names etc.)

-- Enable Row-Level Security on connection
-- The app sets this per-connection: SET app.current_business_id = '<uuid>'
-- RLS policies (defined in migrations) use: current_setting('app.current_business_id')::UUID
