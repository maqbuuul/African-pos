-- P13 — Add credit_risk column to customers (Drizzle schema defines it but
-- 0014_p13_crm_loyalty.sql omitted the column).
ALTER TABLE "customers" ADD COLUMN "credit_risk" boolean NOT NULL DEFAULT false;
