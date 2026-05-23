-- Run in Supabase SQL Editor (https://supabase.com → your project → SQL)

CREATE TABLE IF NOT EXISTS site_users (
  id       TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role     TEXT NOT NULL DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS sms_tracking (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  username     TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  pid          TEXT NOT NULL,
  country      TEXT NOT NULL,
  assigned_at  BIGINT NOT NULL,
  received_sms BOOLEAN NOT NULL DEFAULT FALSE,
  released     BOOLEAN NOT NULL DEFAULT FALSE,
  sms_code     TEXT,
  updated_at   BIGINT
);

CREATE INDEX IF NOT EXISTS sms_tracking_user_id ON sms_tracking (user_id);
CREATE INDEX IF NOT EXISTS sms_tracking_assigned_at ON sms_tracking (assigned_at DESC);

CREATE TABLE IF NOT EXISTS site_settings (
  key   TEXT PRIMARY KEY,
  value JSONB
);

ALTER TABLE site_users    DISABLE ROW LEVEL SECURITY;
ALTER TABLE sms_tracking  DISABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings DISABLE ROW LEVEL SECURITY;
