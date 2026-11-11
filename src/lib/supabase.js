// Shared Supabase client for the whole app (US01).
// Works in a Vite/React frontend (VITE_ vars) and in plain Node.js scripts.
import { createClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) || process.env;

const SUPABASE_URL = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL / SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const PROOF_BUCKET = 'payment-proofs';

/** Returns the signed-in user's profile row (including role), or null if logged out. */
export async function getCurrentProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return data;
}

/** Path to store a payment proof: <user id>/<timestamp>-<file name>. Required by the storage policy. */
export function proofPath(userId, fileName) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${userId}/${Date.now()}-${safe}`;
}
