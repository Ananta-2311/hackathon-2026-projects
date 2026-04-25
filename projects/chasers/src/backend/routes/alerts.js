const express = require("express");
const { supabaseAdmin, ensureSupabase } = require("../lib/supabase");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, requireRole("doctor"), async (req, res) => {
  if (!supabaseAdmin) return res.json(req.app.locals.alerts);
  if (!ensureSupabase(res)) return;

  const { data: assignedPatients, error: patientsError } = await supabaseAdmin
    .from("patients")
    .select("id")
    .eq("assigned_doctor_id", req.profile.id);

  if (patientsError) {
    return res.status(500).json({ message: "Failed to load patients", error: patientsError.message });
  }

  const patientIds = (assignedPatients || []).map((p) => p.id);
  if (patientIds.length === 0) return res.json([]);

  const { data, error } = await supabaseAdmin
    .from("alerts")
    .select("*")
    .in("patient_id", patientIds)
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ message: "Failed to load alerts", error: error.message });
  }
  return res.json(data || []);
});

router.post("/", requireAuth, requireRole("doctor"), async (req, res) => {
  if (!supabaseAdmin) {
    const { patientId, severity = "High", message = "", status = "open" } = req.body || {};
    const mockAlert = {
      id: Date.now().toString(),
      patient_id: patientId || "mock-patient",
      severity,
      message,
      status,
      created_at: new Date().toISOString(),
    };
    req.app.locals.alerts.unshift(mockAlert);
    return res.status(201).json(mockAlert);
  }
  if (!ensureSupabase(res)) return;
  const { patientId, severity = "High", message = "", status = "open" } = req.body || {};

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .eq("assigned_doctor_id", req.profile.id)
    .single();
  if (!patient) {
    return res.status(403).json({ message: "Patient not assigned to doctor" });
  }

  const { data, error } = await supabaseAdmin
    .from("alerts")
    .insert({
      patient_id: patientId,
      severity,
      message,
      status,
    })
    .select("*")
    .single();

  if (error) {
    return res.status(500).json({ message: "Failed to create alert", error: error.message });
  }
  return res.status(201).json(data);
});

module.exports = router;
