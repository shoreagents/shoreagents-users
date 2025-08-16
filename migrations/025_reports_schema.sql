-- Migration: 025_reports_schema.sql
-- Description: Create reports table for user issue reports

-- Create report_type enum
CREATE TYPE report_type_enum AS ENUM (
    'bug',
    'feature', 
    'ui',
    'performance',
    'account',
    'other'
);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    report_type report_type_enum NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    created_at timestamptz DEFAULT now() NULL,
    updated_at timestamptz DEFAULT now() NULL,
    
    -- Foreign key to users table
    CONSTRAINT fk_reports_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_reports_updated_at();

-- Add comments for documentation
COMMENT ON TABLE reports IS 'Stores user issue reports and feedback';
COMMENT ON COLUMN reports.id IS 'Primary key for reports';
COMMENT ON COLUMN reports.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN reports.report_type IS 'Type of report (bug, feature, ui, etc.)';
COMMENT ON COLUMN reports.title IS 'Brief title/description of the issue';
COMMENT ON COLUMN reports.description IS 'Detailed description of the issue';
COMMENT ON COLUMN reports.created_at IS 'Timestamp when report was created';
COMMENT ON COLUMN reports.updated_at IS 'Timestamp when report was last updated';
