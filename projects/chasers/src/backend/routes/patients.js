const express = require("express");
const { supabaseAdmin, ensureSupabase } = require("../lib/supabase");
const { requireAuth } = require("../middleware/auth");
const { mockPatients } = require("../data/mockPatients");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  if (!supabaseAdmin) {
    return res.json(
      mockPatients.map((p) => ({
        id: p.id,
        name: p.name,
        age: p.age,
        diagnosis: p.diagnosis,
        riskLevel: p.riskLevel,
        riskScore: p.riskScore,
        medications: p.medications,
        lastDischargeDate: p.lastDischargeDate,
        alerts: p.alerts,
      }))
    );
  }
  if (!ensureSupabase(res)) return;

  let query = supabaseAdmin.from("patients").select("*").order("created_at", {
    ascending: false,
  });

  if (req.profile.role === "doctor") {
    query = query.eq("assigned_doctor_id", req.profile.id);
  } else if (req.profile.role === "patient") {
    query = query.eq("profile_id", req.profile.id);
  } else {
    return res.status(403).json({ message: "Invalid role" });
  }

  const { data, error } = await query;
  if (error) {
    return res.status(500).json({ message: "Failed to load patients", error: error.message });
  }
  return res.json(data || []);
});

router.get("/:id", requireAuth, async (req, res) => {
  if (!supabaseAdmin) {
    const patient = mockPatients.find((item) => item.id === String(req.params.id));
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    return res.json(patient);
  }
  if (!ensureSupabase(res)) return;

  const { id } = req.params;
  const { data: patient, error } = await supabaseAdmin
    .from("patients")
    .select("*, discharge_instructions(*), chat_messages(*), alerts(*)")
    .eq("id", id)
    .single();

  if (error || !patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  const isDoctorOwner =
    req.profile.role === "doctor" && patient.assigned_doctor_id === req.profile.id;
  const isPatientOwner = req.profile.role === "patient" && patient.profile_id === req.profile.id;
  if (!isDoctorOwner && !isPatientOwner) {
    return res.status(403).json({ message: "Forbidden" });
  }

  return res.json(patient);
});

module.exports = router;
