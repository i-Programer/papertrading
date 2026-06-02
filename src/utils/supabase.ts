// src/utils/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase Environment Variables!");
}

// Inisialisasi klien Supabase untuk digunakan di seluruh aplikasi Next.js
export const supabase = createClient(supabaseUrl, supabaseAnonKey);