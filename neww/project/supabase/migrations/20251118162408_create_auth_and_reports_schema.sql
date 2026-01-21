/*
  # Medical Report Analyzer - Initial Schema

  ## Tables Created
  
  ### users
  - `id` (uuid, primary key) - Unique user identifier
  - `email` (text, unique) - User's email address
  - `password_hash` (text) - Hashed password
  - `created_at` (timestamptz) - Account creation timestamp
  
  ### otp_codes
  - `id` (uuid, primary key) - Unique OTP record identifier
  - `user_id` (uuid, foreign key) - References users table
  - `email` (text) - Email address for OTP
  - `code` (text) - 6-digit OTP code
  - `expires_at` (timestamptz) - Expiration time (5 minutes from creation)
  - `verified` (boolean) - Whether OTP has been verified
  - `created_at` (timestamptz) - OTP creation timestamp
  
  ### medical_reports
  - `id` (uuid, primary key) - Unique report identifier
  - `user_id` (uuid, foreign key) - References users table
  - `filename` (text) - Original filename
  - `file_type` (text) - MIME type (pdf, image/png, etc.)
  - `file_url` (text) - Storage URL or path
  - `extracted_tests` (jsonb) - Array of detected test names
  - `created_at` (timestamptz) - Upload timestamp
  
  ## Security
  
  - RLS enabled on all tables
  - Users can only access their own data
  - Authenticated access required for all operations
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create OTP codes table
CREATE TABLE IF NOT EXISTS otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own OTPs"
  ON otp_codes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert OTPs"
  ON otp_codes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service can update OTPs"
  ON otp_codes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create medical reports table
CREATE TABLE IF NOT EXISTS medical_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_type text NOT NULL,
  file_url text NOT NULL,
  extracted_tests jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE medical_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reports"
  ON medical_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports"
  ON medical_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON medical_reports FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster OTP lookups
CREATE INDEX IF NOT EXISTS idx_otp_email_code ON otp_codes(email, code, verified);
CREATE INDEX IF NOT EXISTS idx_reports_user ON medical_reports(user_id, created_at DESC);