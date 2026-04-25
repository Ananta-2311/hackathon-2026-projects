const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { supabaseAdmin, ensureSupabase } = require("../lib/supabase");

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
  if (!supabaseAdmin) {
    const patient =
      req.profile.role === "patient"
        ? req.app.locals.mockStore?.patients?.find((item) => item.id === "1") || null
        : null;
    return res.json({
      user: req.user,
      profile: req.profile,
      patient,
    });
  }

  if (!ensureSupabase(res)) return;

  let patient = null;
  if (req.profile.role === "patient") {
    const { data } = await supabaseAdmin
      .from("patients")
      .select("*")
      .eq("profile_id", req.profile.id)
      .single();
    patient = data || null;
  }

  return res.json({
    user: { id: req.user.id, email: req.user.email },
    profile: req.profile,
    patient,
  });
});

module.exports = router;
