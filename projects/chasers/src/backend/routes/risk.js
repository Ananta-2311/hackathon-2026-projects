const express = require("express");
const { predictRisk } = require("../services/riskService");
const { supabaseAdmin, ensureSupabase } = require("../lib/supabase");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.post("/predict", requireAuth, requireRole("doctor"), async (req, res) => {
  const result = predictRisk(req.body || {});

  if (req.body?.patientId) {
    if (!ensureSupabase(res)) return;
    await supabaseAdmin
      .from("patients")
      .update({
        risk_score: result.riskScore,
        risk_level: result.riskLevel,
      })
      .eq("id", req.body.patientId)
      .eq("assigned_doctor_id", req.profile.id);
  }

  res.json(result);
});

module.exports = router;
