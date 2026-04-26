const express = require("express");
const { supabaseAdmin, ensureSupabase } = require("../lib/supabase");
const { requireAuth } = require("../middleware/auth");
const { mockPatients } = require("../data/mockPatients");
const { predictRisk } = require("../services/riskService");
const { shouldUseLocalSql, listPatients, getPatientById } = require("../lib/localSql");

const router = express.Router();

function applyRisk(patient = {}) {
  const prediction = predictRisk(patient);
  return {
    ...patient,
    risk_score: prediction.riskScore,
    risk_level: prediction.riskLevel,
    prediction_percentage: prediction.riskScore,
    riskReasons: prediction.reasons,
    followUpSuggestion: prediction.recommendation,
  };
}

function mapPatientForResponse(patient = {}) {
  let parsedReasons = [];
  if (Array.isArray(patient.riskReasons)) {
    parsedReasons = patient.riskReasons;
  } else if (typeof patient.risk_reasons === "string" && patient.risk_reasons.trim()) {
    try {
      const candidate = JSON.parse(patient.risk_reasons);
      parsedReasons = Array.isArray(candidate) ? candidate : [];
    } catch (_error) {
      parsedReasons = [];
    }
  } else if (Array.isArray(patient.reasons)) {
    parsedReasons = patient.reasons;
  }

  return {
    ...patient,
    risk_score: patient.risk_score ?? patient.riskScore ?? patient.prediction_percentage ?? patient.readmission_probability ?? 0,
    risk_level: patient.risk_level ?? patient.riskLevel ?? "Medium",
    prediction_percentage:
      patient.prediction_percentage ?? patient.risk_score ?? patient.riskScore ?? patient.readmission_probability ?? 0,
    riskReasons: parsedReasons,
    followUpSuggestion: patient.followUpSuggestion || patient.follow_up_suggestion || "",
  };
}

router.get("/", requireAuth, async (req, res) => {
  if (!supabaseAdmin) {
    if (shouldUseLocalSql()) {
      const rows = listPatients();
      return res.json(rows.map((patient) => mapPatientForResponse(patient)));
    }
    const patients = req.app.locals.mockStore?.patients || mockPatients;
    const alerts = req.app.locals.mockStore?.alerts || [];
    return res.json(
      patients.map((p) => ({
        id: p.id,
        name: p.name,
        age: p.age,
        diagnosis: p.diagnosis,
        riskLevel: p.riskLevel,
        riskScore: p.riskScore,
        riskReasons: p.riskReasons || [],
        followUpSuggestion: p.followUpSuggestion || "",
        medications: p.medications || [],
        lastDischargeDate: p.lastDischargeDate || p.dischargeDate,
        alerts: [
          ...(p.alerts || []),
          ...alerts
            .filter((alert) => String(alert.patientId || alert.patient_id) === String(p.id))
            .map((alert) => alert.message),
        ],
      }))
    );
  }
  if (!ensureSupabase(res)) return;

  let query = supabaseAdmin.from("patients").select("*").order("created_at", {
    ascending: false,
  });

  if (req.profile.demoAuth) {
    // In demo header-auth mode, return full list to keep dashboard functional.
  } else if (req.profile.role === "doctor") {
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
  return res.json((data || []).map((patient) => applyRisk(patient)));
});

router.get("/:id", requireAuth, async (req, res) => {
  if (!supabaseAdmin) {
    if (shouldUseLocalSql()) {
      const patient = getPatientById(req.params.id);
      if (!patient) return res.status(404).json({ message: "Patient not found" });
      return res.json(mapPatientForResponse(patient));
    }
    const patients = req.app.locals.mockStore?.patients || mockPatients;
    const patient = patients.find((item) => item.id === String(req.params.id));
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    return res.json(patient);
  }
  if (!ensureSupabase(res)) return;

  const { id } = req.params;
  let { data: patient, error } = await supabaseAdmin
    .from("patients")
    .select("*, discharge_instructions(*), chat_messages(*), alerts(*)")
    .eq("id", id)
    .single();

  // Fallback when relational selects are not configured in Supabase.
  if (error || !patient) {
    const fallbackResponse = await supabaseAdmin
      .from("patients")
      .select("*")
      .eq("id", id)
      .single();
    patient = fallbackResponse.data;
    error = fallbackResponse.error;
  }

  if (error || !patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  const isDoctorOwner =
    req.profile.role === "doctor" && patient.assigned_doctor_id === req.profile.id;
  const isPatientOwner = req.profile.role === "patient" && patient.profile_id === req.profile.id;
  if (!req.profile.demoAuth && !isDoctorOwner && !isPatientOwner) {
    return res.status(403).json({ message: "Forbidden" });
  }

  return res.json(applyRisk(patient));
});

module.exports = router;
