import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface OTPCode {
  id: string;
  user_id: string;
  email: string;
  code: string;
  expires_at: string;
  verified: boolean;
  created_at: string;
}

export interface MedicalReport {
  id: string;
  user_id: string;
  filename: string;
  file_type: string;
  file_url: string;
  extracted_tests: string[];
  created_at: string;
}
