const { supabaseAuthClient, supabaseAdmin, ensureSupabase } = require("../lib/supabase");

async function requireAuth(req, res, next) {
  if (!supabaseAuthClient || !supabaseAdmin) {
    if (process.env.NODE_ENV === "test") {
      const role = req.headers["x-test-role"] || "doctor";
      req.user = { id: "test-user", email: "test@dischargeiq.com" };
      req.profile = { id: "test-profile", role, full_name: "Test User" };
      return next();
    }
    if (!ensureSupabase(res)) return;
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Missing auth token" });
  }

  const { data, error } = await supabaseAuthClient.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ message: "Invalid auth token" });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    return res.status(403).json({ message: "Profile not found" });
  }

  req.user = data.user;
  req.profile = profile;
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.profile) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!roles.includes(req.profile.role)) {
      return res.status(403).json({ message: "Forbidden for this role" });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
