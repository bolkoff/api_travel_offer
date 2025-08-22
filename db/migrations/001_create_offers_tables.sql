-- Migration 001: Create offers and offer_versions tables

-- Create offers table (metadata only)
CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 1,
  total_versions INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_modified_by TEXT NOT NULL,
  etag TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_version INTEGER,
  published_at TIMESTAMP WITH TIME ZONE,
  public_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create offer_versions table (content data)
CREATE TABLE IF NOT EXISTS offer_versions (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  change_type TEXT DEFAULT 'manual',
  description TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(offer_id, version)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_offers_user_id ON offers(user_id);
CREATE INDEX IF NOT EXISTS idx_offers_created_at ON offers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offers_updated_at ON offers(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_offers_status_published ON offers(is_published) WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_offer_versions_offer_id ON offer_versions(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_versions_offer_version ON offer_versions(offer_id, version);
CREATE INDEX IF NOT EXISTS idx_offer_versions_created_at ON offer_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offer_versions_status ON offer_versions(status);

-- Add constraint for valid status values
ALTER TABLE offer_versions ADD CONSTRAINT check_status_values 
  CHECK (status IN ('draft', 'published', 'archived'));

-- Add constraint for valid change_type values  
ALTER TABLE offer_versions ADD CONSTRAINT check_change_type_values
  CHECK (change_type IN ('manual', 'auto'));

-- Add constraint to ensure current_version exists in versions
-- (Will be enforced at application level for simplicity)

-- Comment on tables
COMMENT ON TABLE offers IS 'Travel offers metadata and versioning information';
COMMENT ON TABLE offer_versions IS 'Versioned content data for travel offers';

-- Column comments
COMMENT ON COLUMN offers.id IS 'Unique offer identifier';
COMMENT ON COLUMN offers.user_id IS 'Owner of the offer';
COMMENT ON COLUMN offers.current_version IS 'Currently active version number';
COMMENT ON COLUMN offers.total_versions IS 'Total number of versions created';
COMMENT ON COLUMN offers.etag IS 'ETag for optimistic locking';
COMMENT ON COLUMN offers.metadata IS 'Additional metadata like hasUnpublishedChanges';

COMMENT ON COLUMN offer_versions.content IS 'Complete tour data stored as JSONB';
COMMENT ON COLUMN offer_versions.change_type IS 'manual or auto version creation';
COMMENT ON COLUMN offer_versions.description IS 'User-provided version description';