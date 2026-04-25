const express = require("express");
const { supabaseAdmin, ensureSupabase } = require("../lib/supabase");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const redFlagSymptoms = [
  "chest pain",
  "shortness of breath",
  "can't breathe",
  "severe pain",
  "fainting",
  "bleeding",
  "fever",
];

function containsRedFlag(message = "") {
  const normalized = message.toLowerCase();
  return redFlagSymptoms.some((keyword) => normalized.includes(keyword));
}

router.get("/history/:patientId", requireAuth, async (req, res) => {
  if (!supabaseAdmin) return res.json([]);
  if (!ensureSupabase(res)) return;
  const { patientId } = req.params;

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("id, profile_id, assigned_doctor_id")
    .eq("id", patientId)
    .single();
  if (!patient) return res.status(404).json({ message: "Patient not found" });

  const canRead =
    (req.profile.role === "doctor" && patient.assigned_doctor_id === req.profile.id) ||
    (req.profile.role === "patient" && patient.profile_id === req.profile.id);
  if (!canRead) return res.status(403).json({ message: "Forbidden" });

  const { data, error } = await supabaseAdmin
    .from("chat_messages")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: true });
  if (error) return res.status(500).json({ message: "Failed to load chat history", error: error.message });
  return res.json(data || []);
});

router.post("/", requireAuth, requireRole("patient"), async (req, res) => {
  const { message = "" } = req.body || {};
  let patientId = "mock-patient";
  if (supabaseAdmin) {
    if (!ensureSupabase(res)) return;
    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("id")
      .eq("profile_id", req.profile.id)
      .single();

    if (!patient) {
      return res.status(404).json({ message: "Patient record not found for logged-in user" });
    }
    patientId = patient.id;
  }
  const alertCreated = containsRedFlag(message);

  let alert = null;
  let reply =
    "Thanks for sharing. Keep resting, stay hydrated, and continue your medications as prescribed.";

  if (alertCreated) {
    alert = {
      patientId: String(patientId),
      severity: "High",
      message,
      status: "open",
    };
    if (supabaseAdmin) {
      const { data: insertedAlert } = await supabaseAdmin
        .from("alerts")
        .insert({
          patient_id: alert.patientId,
          severity: alert.severity,
          message: alert.message,
          status: alert.status,
        })
        .select("*")
        .single();
      alert = insertedAlert || null;
    } else {
      alert = { id: Date.now().toString(), ...alert, created_at: new Date().toISOString() };
      req.app.locals.alerts.unshift(alert);
    }
    reply =
      "I detected urgent symptoms and alerted your care team. If symptoms are severe, call emergency services now.";
  }

  if (supabaseAdmin) {
    await supabaseAdmin.from("chat_messages").insert([
      { patient_id: patientId, sender: "patient", message },
      { patient_id: patientId, sender: "assistant", message: reply },
    ]);
  }

  res.json({
    reply,
    alertCreated,
    alert,
  });
});

module.exports = router;
