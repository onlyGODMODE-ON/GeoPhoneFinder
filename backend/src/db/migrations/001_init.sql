-- Georgian Smartphone Recommendation Platform — initial schema (PRD §11, §21)

-- Normalized processor taxonomy (PRD §10.2)
CREATE TABLE chipsets (
  id                 TEXT PRIMARY KEY,
  vendor             TEXT NOT NULL,
  name               TEXT NOT NULL,
  aliases            JSONB NOT NULL DEFAULT '[]',
  generation_rank    INTEGER NOT NULL CHECK (generation_rank >= 1),
  performance_tier   TEXT NOT NULL CHECK (performance_tier IN ('flagship','upper-mid','mid','entry')),
  cpu_score          DOUBLE PRECISION CHECK (cpu_score BETWEEN 0 AND 100),
  gpu_score          DOUBLE PRECISION CHECK (gpu_score BETWEEN 0 AND 100),
  architecture_score DOUBLE PRECISION CHECK (architecture_score BETWEEN 0 AND 100),
  cores              TEXT,
  released           TEXT
);

-- Retailers are data, never hard-coded conditions (PRD §5)
CREATE TABLE stores (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  base_url    TEXT NOT NULL,
  adapter_key TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

-- One row per materially distinct configuration (PRD §12)
CREATE TABLE phone_variants (
  id                UUID PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  identity_key      TEXT NOT NULL UNIQUE,
  brand             TEXT NOT NULL,
  model             TEXT NOT NULL,
  ram               INTEGER CHECK (ram IS NULL OR ram > 0),
  storage           INTEGER CHECK (storage IS NULL OR storage > 0),
  chipset_id        TEXT REFERENCES chipsets(id),
  display           JSONB,
  battery           JSONB,
  cameras           JSONB,
  video             JSONB,
  connectivity      JSONB,
  audio             JSONB,
  body              JSONB,
  software          JSONB,
  benchmarks        JSONB,
  scores            JSONB NOT NULL DEFAULT '{}',
  image_url         TEXT,
  source            TEXT NOT NULL,
  source_url        TEXT NOT NULL,
  source_product_id TEXT NOT NULL,
  last_updated      TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX phone_variants_brand_idx ON phone_variants (brand);

-- Price belongs to an offer, never directly to a phone (PRD §11.5)
CREATE TABLE store_offers (
  id                UUID PRIMARY KEY,
  phone_variant_id  UUID NOT NULL REFERENCES phone_variants(id) ON DELETE CASCADE,
  store_id          TEXT NOT NULL REFERENCES stores(id),
  price             NUMERIC(10,2) NOT NULL CHECK (price > 0),
  currency          TEXT NOT NULL DEFAULT 'GEL' CHECK (currency = 'GEL'),
  available         BOOLEAN NOT NULL,
  url               TEXT NOT NULL,
  source_product_id TEXT NOT NULL,
  last_updated      TIMESTAMPTZ NOT NULL,
  stale             BOOLEAN NOT NULL DEFAULT FALSE,
  -- a store can have only one active offer per variant => duplicate source records cannot duplicate offers
  UNIQUE (store_id, phone_variant_id)
);
CREATE INDEX store_offers_variant_idx ON store_offers (phone_variant_id);

-- Versioned score formulas (PRD §10.1, §10.8)
CREATE TABLE score_definitions (
  id         SERIAL PRIMARY KEY,
  key        TEXT NOT NULL,
  version    INTEGER NOT NULL,
  label      TEXT NOT NULL,
  definition JSONB NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (key, version)
);

-- Historical score output so score changes can be explained
CREATE TABLE score_snapshots (
  id               BIGSERIAL PRIMARY KEY,
  phone_variant_id UUID NOT NULL REFERENCES phone_variants(id) ON DELETE CASCADE,
  versions         JSONB NOT NULL,
  scores           JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX score_snapshots_variant_idx ON score_snapshots (phone_variant_id);

-- Raw source lineage (PRD §13.2, §29)
CREATE TABLE source_records (
  id                UUID PRIMARY KEY,
  store_id          TEXT NOT NULL REFERENCES stores(id),
  source_product_id TEXT NOT NULL,
  phone_variant_id  UUID REFERENCES phone_variants(id) ON DELETE SET NULL,
  status            TEXT NOT NULL CHECK (status IN ('normalized','quarantined')),
  raw               JSONB NOT NULL,
  errors            JSONB NOT NULL DEFAULT '[]',
  content_hash      TEXT NOT NULL,
  first_seen        TIMESTAMPTZ NOT NULL,
  last_seen         TIMESTAMPTZ NOT NULL,
  UNIQUE (store_id, source_product_id)
);

CREATE TABLE ingestion_runs (
  id          UUID PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id),
  started_at  TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status      TEXT NOT NULL CHECK (status IN ('running','success','partial','failed')),
  stats       JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX ingestion_runs_store_idx ON ingestion_runs (store_id, started_at DESC);

-- Collector / normalization / validation / failure events
CREATE TABLE update_logs (
  id         BIGSERIAL PRIMARY KEY,
  run_id     UUID REFERENCES ingestion_runs(id) ON DELETE SET NULL,
  store_id   TEXT,
  level      TEXT NOT NULL,
  event      TEXT NOT NULL,
  message    TEXT NOT NULL,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX update_logs_created_idx ON update_logs (created_at DESC);
