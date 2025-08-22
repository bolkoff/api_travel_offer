-- Database initialization script
-- This script runs when PostgreSQL container starts for the first time

-- Ensure database exists (already created by POSTGRES_DB env var)
-- Create extension for better JSON support if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Run migration script
\i /docker-entrypoint-initdb.d/migrations/001_create_offers_tables.sql

-- Insert test data (optional, can be removed in production)
-- This matches the existing data structure from offers.json
INSERT INTO offers (id, user_id, current_version, total_versions, created_at, updated_at, last_modified_by, etag, is_published, published_version, published_at, public_url, metadata) VALUES
('offer_1', 'user_1', 2, 3, '2025-08-20T15:09:14.332Z', '2025-08-22T10:41:24.085Z', 'user_1', '"3f0076ba"', false, null, null, null, '{"hasUnpublishedChanges": false, "lastAutoSaveAt": null}'),
('offer_2', 'user_1', 1, 1, '2025-08-21T20:25:19.172Z', '2025-08-21T20:25:43.056Z', 'user_1', '"51dcaf3e"', false, null, null, null, '{"hasUnpublishedChanges": false, "lastAutoSaveAt": null}')
ON CONFLICT (id) DO NOTHING;

-- Note: For offer_versions, we'll let the application handle data migration
-- since the content JSONB is too large for this init script

-- Verify table creation
SELECT 'Offers table created' as message, count(*) as count FROM offers;
SELECT 'Offer_versions table created' as message, count(*) as count FROM offer_versions;