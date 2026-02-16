-- Add geolocation columns to visitors table
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS detected_source TEXT DEFAULT 'Direct';

-- Add geolocation columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS state TEXT;
