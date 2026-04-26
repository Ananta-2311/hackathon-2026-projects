const { createClient } = require("@supabase/supabase-js");

const isTest = process.env.NODE_ENV === "test";
const forceLocalSql = String(process.env.FORCE_LOCAL_SQL || "").toLowerCase() === "true";
const envOrUndefined = (value) => {
  const normalized = String(value || "").trim();
  return normalized || undefined;
};
const supabaseUrl = envOrUndefined(process.env.SUPABASE_URL || (!isTest ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined));
const serviceRoleKey = envOrUndefined(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY);
const anonKey = envOrUndefined(process.env.SUPABASE_ANON_KEY || (!isTest ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined));
const useSupabaseAdmin = !isTest && !forceLocalSql && Boolean(supabaseUrl && serviceRoleKey);

const supabaseAdmin =
  useSupabaseAdmin
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
        "Supabase admin is not configured. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, or keep local SQL mode enabled.",
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
