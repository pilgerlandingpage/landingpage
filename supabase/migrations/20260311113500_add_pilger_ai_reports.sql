-- Create pilger_ai_reports table
CREATE TABLE IF NOT EXISTS pilger_ai_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('daily', 'weekly')),
  date DATE NOT NULL,
  content_markdown TEXT NOT NULL,
  token_usage JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for quick lookup
CREATE INDEX IF NOT EXISTS idx_pilger_ai_reports_date_type ON pilger_ai_reports (date, type);

-- Create market_radars table
CREATE TABLE IF NOT EXISTS market_radars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create market_radar_data table
CREATE TABLE IF NOT EXISTS market_radar_data (
  radar_id UUID NOT NULL REFERENCES market_radars(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  trend_score INTEGER NOT NULL CHECK (trend_score >= 0 AND trend_score <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (radar_id, date)
);
