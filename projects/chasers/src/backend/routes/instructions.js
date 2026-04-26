const express = require("express");
const { supabaseAdmin, ensureSupabase } = require("../lib/supabase");
const { requireAuth } = require("../middleware/auth");
const {
  hasOpenAIKey,
  simplifyInstructionsWithAI,
  fallbackSimplify,
} = require("../services/openaiService");
const { shouldUseLocalSql, insertDischargeNote } = require("../lib/localSql");

const router = express.Router();
const languageLabels = {
  en: "English",
  es: "Spanish",
  fr: "French",
  ar: "Arabic",
  zh: "Mandarin",
  hi: "Hindi",
};

function getLocalInstructionStore(req) {
  if (!req.app.locals.mockStore) req.app.locals.mockStore = {};
  if (!req.app.locals.mockStore.dischargeInstructions) {
    req.app.locals.mockStore.dischargeInstructions = {};
  }
  return req.app.locals.mockStore.dischargeInstructions;
}

router.get("/:patientId", requireAuth, async (req, res) => {
  if (!supabaseAdmin) {
    const localStore = getLocalInstructionStore(req);
    const localRows = localStore[String(req.params.patientId)] || [];
    if (localRows.length) return res.json(localRows);

    const patient = (req.app.locals.mockStore?.patients || []).find(
      (item) => item.id === String(req.params.patientId)
    );
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    return res.json([
      {
        original_text: patient.doctorNotes || "",
        simplified_text: patient.simplifiedInstructions || "",
        translated_text: patient.translatedInstructions || "",
        language: patient.translatedLanguage || "en",
      },
    ]);
  }
  if (!ensureSupabase(res)) return;
  const { patientId } = req.params;

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .single();
  if (!patient) return res.status(404).json({ message: "Patient not found" });

  const canRead =
    req.profile.demoAuth ||
    (req.profile.role === "doctor" && patient.assigned_doctor_id === req.profile.id) ||
    (req.profile.role === "patient" && patient.profile_id === req.profile.id);
  if (!canRead) return res.status(403).json({ message: "Forbidden" });

  const { data, error } = await supabaseAdmin
    .from("discharge_instructions")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) {
    if (String(error.message || "").includes("Could not find the table")) {
      const localStore = getLocalInstructionStore(req);
      return res.json(localStore[String(patientId)] || []);
    }
    return res.status(500).json({ message: "Failed to load instructions", error: error.message });
  }
  return res.json(data || []);
});

router.post("/simplify", requireAuth, async (req, res) => {
  try {
    const { originalInstructions = "", language = "en", patientId = null } = req.body || {};

    let simplifiedInstructions = null;
    let method = "fallback";
    if (hasOpenAIKey()) {
      simplifiedInstructions = await Promise.race([
        simplifyInstructionsWithAI(originalInstructions, language),
        new Promise((resolve) => setTimeout(() => resolve(null), 12000)),
      ]);
      if (simplifiedInstructions) method = "openai";
    }

    if (!simplifiedInstructions) {
      simplifiedInstructions = fallbackSimplify(originalInstructions, language);
      method = "fallback";
    }

    if (patientId && !supabaseAdmin) {
      const patients = req.app.locals.mockStore?.patients || [];
      const patient = patients.find((item) => item.id === String(patientId));
      if (patient) {
        patient.doctorNotes = originalInstructions;
        patient.simplifiedInstructions = simplifiedInstructions;
      }
      if (shouldUseLocalSql()) {
        insertDischargeNote({
          patientId: String(patientId),
          originalNote: originalInstructions,
          simplifiedNote: simplifiedInstructions,
          language,
        });
        if (String(patientId) !== "1") {
          insertDischargeNote({
            patientId: "1",
            originalNote: originalInstructions,
            simplifiedNote: simplifiedInstructions,
            language,
          });
        }
      }
    } else if (patientId && supabaseAdmin) {
      const { data: patient, error: patientError } = await supabaseAdmin
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .single();

      if (patientError || !patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      const canWrite =
        req.profile.demoAuth ||
        (req.profile.role === "doctor" &&
          (!patient.assigned_doctor_id || patient.assigned_doctor_id === req.profile.id)) ||
        (req.profile.role === "patient" && patient.profile_id === req.profile.id);
      if (!canWrite) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { error: insertError } = await supabaseAdmin.from("discharge_instructions").insert({
        patient_id: patientId,
        original_text: originalInstructions,
        simplified_text: simplifiedInstructions,
        language,
      });
      if (insertError && String(insertError.message || "").includes("Could not find the table")) {
        const localStore = getLocalInstructionStore(req);
        const row = {
          patient_id: patientId,
          original_text: originalInstructions,
          simplified_text: simplifiedInstructions,
          translated_text: null,
          language,
          created_at: new Date().toISOString(),
        };
        if (!localStore[String(patientId)]) localStore[String(patientId)] = [];
        localStore[String(patientId)].unshift(row);
      }

      // Keep patient portal source-of-truth in sync with simplify output.
      await supabaseAdmin.from("discharge_notes").insert({
        patient_id: patientId,
        original_note: originalInstructions,
        simplified_note: simplifiedInstructions,
        language,
      });
    }

    res.json({
      originalInstructions,
      simplifiedInstructions,
      language,
      method,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to simplify instructions",
      error: error.message,
    });
  }
});

router.post("/translate", requireAuth, async (req, res) => {
  const { text = "", language = "en" } = req.body || {};
  const label = languageLabels[language] || "Selected language";
  const translatedText = text
    ? `[${label}] ${text}`
    : "No simplified instructions available to translate yet.";

  return res.json({
    language,
    languageLabel: label,
    translatedText,
  });
});

router.post("/send", requireAuth, async (req, res) => {
  const {
    patientId,
    originalText = "",
    simplifiedText = "",
    translatedText = "",
    language = "en",
  } = req.body || {};

  if (!patientId) return res.status(400).json({ message: "patientId is required" });

  if (!supabaseAdmin) {
    const patients = req.app.locals.mockStore?.patients || [];
    const patient = patients.find((item) => item.id === String(patientId));
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    patient.doctorNotes = originalText;
    patient.simplifiedInstructions = simplifiedText;
    patient.translatedInstructions = translatedText;
    patient.translatedLanguage = language;

    return res.status(201).json({
      patientId,
      sent: true,
      language,
      originalText,
      simplifiedText,
      translatedText,
    });
  }

  const { data: patient, error: patientError } = await supabaseAdmin
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .single();
  if (patientError || !patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  const canWrite =
    req.profile.demoAuth ||
    (req.profile.role === "doctor" &&
      (!patient.assigned_doctor_id || patient.assigned_doctor_id === req.profile.id));
  if (!canWrite) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { error: insertError } = await supabaseAdmin.from("discharge_instructions").insert({
    patient_id: patientId,
    original_text: originalText,
    simplified_text: simplifiedText,
    translated_text: translatedText || null,
    language,
  });

  if (insertError && !String(insertError.message || "").includes("Could not find the table")) {
    return res.status(500).json({ message: "Failed to send instructions", error: insertError.message });
  }

  if (insertError && String(insertError.message || "").includes("Could not find the table")) {
    const localStore = getLocalInstructionStore(req);
    const row = {
      patient_id: patientId,
      original_text: originalText,
      simplified_text: simplifiedText,
      translated_text: translatedText || null,
      language,
      created_at: new Date().toISOString(),
    };
    if (!localStore[String(patientId)]) localStore[String(patientId)] = [];
    localStore[String(patientId)].unshift(row);
  }

  // Create an informational alert that the patient has new instructions.
  await supabaseAdmin.from("alerts").insert({
    patient_id: patientId,
    severity: "Info",
    message: "New discharge instructions were sent to the patient.",
    status: "open",
  });

  return res.status(201).json({
    patientId,
    sent: true,
    language,
    originalText,
    simplifiedText,
    translatedText,
  });
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
