const express = require("express");
const { supabaseAdmin, ensureSupabase } = require("../lib/supabase");
const { requireAuth } = require("../middleware/auth");
const {
  hasOpenAIKey,
  simplifyInstructionsWithAI,
  fallbackSimplify,
} = require("../services/openaiService");

const router = express.Router();

router.get("/:patientId", requireAuth, async (req, res) => {
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
    .from("discharge_instructions")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ message: "Failed to load instructions", error: error.message });
  return res.json(data || []);
});

router.post("/simplify", requireAuth, async (req, res) => {
  try {
    const { originalInstructions = "", language = "en", patientId = null } = req.body || {};

    let simplifiedInstructions = null;
    if (hasOpenAIKey()) {
      simplifiedInstructions = await simplifyInstructionsWithAI(
        originalInstructions,
        language
      );
    }

    if (!simplifiedInstructions) {
      simplifiedInstructions = fallbackSimplify(originalInstructions, language);
    }

    if (patientId && supabaseAdmin) {
      const { data: patient, error: patientError } = await supabaseAdmin
        .from("patients")
        .select("id, profile_id, assigned_doctor_id")
        .eq("id", patientId)
        .single();

      if (patientError || !patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      const canWrite =
        (req.profile.role === "doctor" && patient.assigned_doctor_id === req.profile.id) ||
        (req.profile.role === "patient" && patient.profile_id === req.profile.id);
      if (!canWrite) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await supabaseAdmin.from("discharge_instructions").insert({
        patient_id: patientId,
        original_text: originalInstructions,
        simplified_text: simplifiedInstructions,
        language,
      });
    }

    res.json({
      originalInstructions,
      simplifiedInstructions,
      language,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to simplify instructions",
      error: error.message,
    });
  }
});

router.post("/", requireAuth, async (req, res) => {
  if (!ensureSupabase(res)) return;
  if (req.profile.role !== "doctor") {
    return res.status(403).json({ message: "Only doctors can create instructions" });
  }

  const { patientId, originalText = "", language = "en" } = req.body || {};
  if (!patientId || !originalText) {
    return res.status(400).json({ message: "patientId and originalText are required" });
  }

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("id, assigned_doctor_id")
    .eq("id", patientId)
    .single();
  if (!patient) return res.status(404).json({ message: "Patient not found" });
  if (patient.assigned_doctor_id !== req.profile.id) {
    return res.status(403).json({ message: "Patient not assigned to doctor" });
  }

  let simplifiedText =
    (hasOpenAIKey() && (await simplifyInstructionsWithAI(originalText, language))) ||
    fallbackSimplify(originalText, language);

  const { data, error } = await supabaseAdmin
    .from("discharge_instructions")
    .insert({
      patient_id: patientId,
      original_text: originalText,
      simplified_text: simplifiedText,
      language,
    })
    .select("*")
    .single();

  if (error) {
    return res.status(500).json({ message: "Failed to create instruction", error: error.message });
  }
  return res.status(201).json(data);
});

module.exports = router;
