/*
  # Medical Report Analyzer - Test Results Enhancement

  ## New Table: test_results

  ### Purpose
  Store individual test results from medical reports for trend analysis and detailed reporting.

  ### Schema
  - `id` (uuid, primary key) - Unique result identifier
  - `report_id` (uuid, foreign key) - References medical_reports table
  - `test_name` (text) - Name of the medical test
  - `value` (text) - Test result value
  - `unit` (text) - Unit of measurement (mg/dL, g/dL, etc.)
  - `reference_range` (text) - Normal reference range for the test
  - `interpretation` (text) - Result interpretation: 'High', 'Normal', 'Low', 'Unknown'
  - `explanation` (text) - AI-generated explanation of the test
  - `created_at` (timestamptz) - Timestamp when result was saved

  ## Indexes
  - Primary key on id
  - Foreign key to medical_reports
  - Composite index for trend queries (report_id, test_name, created_at)
  - Index on interpretation for filtering

  ## Security
  - RLS enabled
  - Users can only access their own test results through report ownership
*/

-- Create test_results table
CREATE TABLE IF NOT EXISTS test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES medical_reports(id) ON DELETE CASCADE,
  test_name text NOT NULL,
  value text NOT NULL,
  unit text,
  reference_range text,
  interpretation text NOT NULL CHECK (interpretation IN ('High', 'Normal', 'Low', 'Unknown')),
  explanation text,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access test results from their own reports
CREATE POLICY "Users can read own test results"
  ON test_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM medical_reports
      WHERE medical_reports.id = test_results.report_id
      AND medical_reports.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert test results for own reports"
  ON test_results FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM medical_reports
      WHERE medical_reports.id = test_results.report_id
      AND medical_reports.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete test results for own reports"
  ON test_results FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM medical_reports
      WHERE medical_reports.id = test_results.report_id
      AND medical_reports.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_test_results_report_id ON test_results(report_id);
CREATE INDEX IF NOT EXISTS idx_test_results_test_name ON test_results(test_name);
CREATE INDEX IF NOT EXISTS idx_test_results_interpretation ON test_results(interpretation);
CREATE INDEX IF NOT EXISTS idx_test_results_created_at ON test_results(created_at DESC);

-- Composite index for trend analysis queries
CREATE INDEX IF NOT EXISTS idx_test_results_trends ON test_results(report_id, test_name, created_at DESC);

-- Update medical_reports table to include patient info
ALTER TABLE medical_reports
ADD COLUMN IF NOT EXISTS patient_name text,
ADD COLUMN IF NOT EXISTS patient_age integer,
ADD COLUMN IF NOT EXISTS patient_gender text;

-- Update RLS for medical_reports to allow updates for patient info
CREATE POLICY "Users can update own reports"
  ON medical_reports FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);