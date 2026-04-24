-- NDIS CRM Migration 002 — Security hardening
-- Adds revoked_tokens table for server-side JWT logout support

CREATE TABLE IF NOT EXISTS revoked_tokens (
  id        SERIAL PRIMARY KEY,
  jti       VARCHAR(255) UNIQUE NOT NULL,
  revoked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index for fast jti look-ups on every authenticated request
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti      ON revoked_tokens (jti);
-- Index used by the cleanup query that removes expired entries
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires  ON revoked_tokens (expires_at);
