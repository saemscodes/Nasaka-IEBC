-- Migration: Add office_id, user_id, is_accurate, notes columns to confirmations
-- This migration enhances the confirmations table to support
-- the "Verified By" badge feature on OfficeDetail pages.

-- Add office_id to link confirmations directly to an office
ALTER TABLE confirmations
ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES iebc_offices(id);

-- Add user_id for verified-by display (can be 'ceka', 'ceka-xxx', or a UUID)
ALTER TABLE confirmations
ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Add is_accurate boolean for confirmation accuracy flag
ALTER TABLE confirmations
ADD COLUMN IF NOT EXISTS is_accurate BOOLEAN DEFAULT true;

-- Add notes for optional confirmation notes
ALTER TABLE confirmations
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Index for fast lookup by office_id + is_accurate (used by OfficeDetail verified-by query)
CREATE INDEX IF NOT EXISTS idx_confirmations_office_verified
ON confirmations(office_id, is_accurate)
WHERE is_accurate = true;

-- Index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_confirmations_user_id
ON confirmations(user_id)
WHERE user_id IS NOT NULL;
