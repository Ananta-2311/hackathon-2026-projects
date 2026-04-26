const { supabaseAuthClient, supabaseAdmin, ensureSupabase } = require("../lib/supabase");

async function requireAuth(req, res, next) {
  if (!supabaseAuthClient || !supabaseAdmin) {
    const headerRole = req.headers["x-user-role"] || req.headers["x-test-role"];
    const role = String(headerRole || "doctor").toLowerCase();
    const userId = req.headers["x-user-id"] || (role === "patient" ? "patient-1" : "doctor-1");
    req.user = { id: String(userId), email: `${role}@dischargeiq.dev` };
    req.profile = {
      id: String(userId),
      role,
      full_name: role === "patient" ? "Maria Thompson" : "Dr. Smith",
      demoAuth: true,
    };
    return next();
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  // Demo-safe fallback: if local UI didn't perform Supabase login yet, still allow
  // x-user headers so the hackathon flow can run end-to-end.
  if (!token) {
    const headerRole = req.headers["x-user-role"] || req.headers["x-test-role"];
    const role = String(headerRole || "doctor").toLowerCase();
    const userId = req.headers["x-user-id"] || (role === "patient" ? "patient-1" : "doctor-1");
    req.user = { id: String(userId), email: `${role}@dischargeiq.dev` };
    req.profile = {
      id: String(userId),
      role,
      full_name: role === "patient" ? "Maria Thompson" : "Dr. Smith",
      demoAuth: true,
    };
    return next();
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

  let resolvedProfile = profile;
  if (profileError || !profile) {
    // Demo-safe fallback: infer role when profile seed is missing.
    // This prevents login dead-ends during hackathon demos.
    const email = String(data.user.email || "").toLowerCase();
    const inferredRole = email.includes("doctor") ? "doctor" : "patient";
    const inferredName = data.user.user_metadata?.full_name || email.split("@")[0] || "User";

    resolvedProfile = {
      id: data.user.id,
      full_name: inferredName,
      role: inferredRole,
      created_at: new Date().toISOString(),
      inferred: true,
    };
  }

  req.user = data.user;
  req.profile = resolvedProfile;
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
