const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    : null;

const supabaseAuthClient =
  supabaseUrl && anonKey
    ? createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
    : null;

function ensureSupabase(res, options = {}) {
  const { requireAuthClient = false } = options;
  if (!supabaseAdmin || (requireAuthClient && !supabaseAuthClient)) {
    res.status(500).json({
      message:
        "Supabase is not configured. Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.",
    });
    return false;
  }
  return true;
}

module.exports = {
  supabaseAdmin,
  supabaseAuthClient,
  ensureSupabase,
};
