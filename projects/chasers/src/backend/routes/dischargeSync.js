const express = require("express");
const { supabaseAdmin, ensureSupabase } = require("../lib/supabase");
const { requireAuth } = require("../middleware/auth");
const {
  shouldUseLocalSql,
  getPatientById,
  getPatientByProfileId,
  insertDischargeNote,
  listDischargeNotes,
  getLatestDischargeNoteAnyPatient,
} = require("../lib/localSql");

const router = express.Router();

function mapNote(row = {}) {
  return {
    id: row.id,
    patientId: row.patient_id,
    originalNote: row.original_note || "",
    simplifiedNote: row.simplified_note || "",
    language: row.language || "English",
    createdAt: row.created_at,
  };
}

function pickLatestMeaningfulNote(notes = []) {
  const meaningful = notes.find(
    (note) => String(note?.originalNote || "").trim() || String(note?.simplifiedNote || "").trim()
  );
  return meaningful || notes[0] || null;
}

function getLocalStore(req) {
  if (!req.app.locals.mockStore) req.app.locals.mockStore = {};
  if (!req.app.locals.mockStore.dischargeNotes) req.app.locals.mockStore.dischargeNotes = {};
  return req.app.locals.mockStore.dischargeNotes;
}

async function resolvePatient(req, patientIdFromQuery) {
  if (!supabaseAdmin && shouldUseLocalSql()) {
    if (patientIdFromQuery) return getPatientById(patientIdFromQuery);
    if (req.profile?.role === "patient") {
      return getPatientByProfileId(req.profile.id) || getPatientById("1");
    }
    return getPatientById("1");
  }
  if (!supabaseAdmin) return null;

  if (patientIdFromQuery) {
    const { data } = await supabaseAdmin.from("patients").select("*").eq("id", patientIdFromQuery).single();
    return data || null;
  }

  if (req.profile?.role === "patient" && !req.profile?.demoAuth) {
    const { data } = await supabaseAdmin.from("patients").select("*").eq("profile_id", req.profile.id).limit(1).single();
    return data || null;
  }

  const byEmail = await supabaseAdmin
    .from("patients")
    .select("*")
    .eq("email", "patient@dischargeiq.com")
    .limit(1)
    .single();
  if (byEmail.data) return byEmail.data;

  const first = await supabaseAdmin.from("patients").select("*").order("created_at", { ascending: false }).limit(1).single();
  return first.data || null;
}

router.post("/send-discharge-note", requireAuth, async (req, res) => {
  const payload = req.body || {};
  let patientId =
    payload.patient_id ||
    payload.patientId ||
    payload.patient?.id ||
    payload?.note?.patient_id ||
    payload?.note?.patientId ||
    req.query?.patient_id ||
    null;
  const originalNote = payload.original_note ?? payload.originalText ?? payload.originalNote ?? "";
  const simplifiedNote = payload.simplified_note ?? payload.simplifiedText ?? payload.simplifiedNote ?? "";
  const language = payload.language || "English";
  const safeOriginalNote = String(originalNote || "").trim() || "Doctor shared updated discharge instructions.";
  const safeSimplifiedNote =
    String(simplifiedNote || "").trim() || "Please follow your updated discharge instructions from your doctor.";

  if (!patientId) {
    const resolvedPatient = await resolvePatient(req, null);
    patientId = resolvedPatient?.id || "1";
  }

  if (!patientId) {
    return res.status(400).json({
      success: false,
      message: "patient_id is required",
      receivedKeys: Object.keys(payload),
    });
  }

  if (!supabaseAdmin) {
    if (shouldUseLocalSql()) {
      const inserted = insertDischargeNote({
        patientId,
        originalNote: safeOriginalNote,
        simplifiedNote: safeSimplifiedNote,
        language,
      });
      // Demo-safe mirror so the patient portal always has latest instructions
      // even when doctor/patient ID mapping is inconsistent in local mode.
      if (String(patientId) !== "1") {
        insertDischargeNote({
          patientId: "1",
          originalNote: safeOriginalNote,
          simplifiedNote: safeSimplifiedNote,
          language,
        });
      }
      return res.json({
        success: true,
        message: "Discharge note sent to patient",
        note: mapNote(inserted || {}),
      });
    }
    const localStore = getLocalStore(req);
    const row = {
      id: `${Date.now()}`,
      patient_id: String(patientId),
      original_note: originalNote || "",
      simplified_note: simplifiedNote || "",
      language,
      created_at: new Date().toISOString(),
    };
    if (!localStore[String(patientId)]) localStore[String(patientId)] = [];
    localStore[String(patientId)].unshift(row);
    return res.json({
      success: true,
      message: "Discharge note sent to patient",
      note: mapNote(row),
    });
  }
  if (!ensureSupabase(res)) return;

  const { data, error } = await supabaseAdmin
    .from("discharge_notes")
    .insert({
      patient_id: patientId,
      original_note: safeOriginalNote,
      simplified_note: safeSimplifiedNote,
      language,
    })
    .select("*")
    .single();

  if (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to send discharge note",
      error: error.message,
    });
  }

  return res.json({
    success: true,
    message: "Discharge note sent to patient",
    note: mapNote(data),
  });
});

router.get("/discharge-notes", requireAuth, async (req, res) => {
  const patientId = req.query.patient_id;
  if (!patientId) return res.status(400).json({ message: "patient_id is required" });

  if (!supabaseAdmin) {
    if (shouldUseLocalSql()) {
      const rows = listDischargeNotes(patientId);
      return res.json({ notes: rows.map((row) => mapNote(row)) });
    }
    const localStore = getLocalStore(req);
    const localRows = localStore[String(patientId)] || [];
    return res.json({ notes: localRows.map((row) => mapNote(row)) });
  }
  if (!ensureSupabase(res)) return;

  const { data, error } = await supabaseAdmin
    .from("discharge_notes")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ message: "Failed to load discharge notes", error: error.message });
  }

  return res.json({ notes: (data || []).map((row) => mapNote(row)) });
});

router.get("/patient-dashboard", requireAuth, async (req, res) => {
  const patientId = req.query.patient_id;

  if (!supabaseAdmin) {
    const patient = await resolvePatient(req, patientId);
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    let notes = shouldUseLocalSql()
      ? listDischargeNotes(patient.id).map((row) => mapNote(row))
      : (getLocalStore(req)[String(patient?.id)] || []).map((row) => mapNote(row));
    if (shouldUseLocalSql() && !notes.length) {
      const latestGlobal = getLatestDischargeNoteAnyPatient();
      if (latestGlobal) notes = [mapNote(latestGlobal)];
    }
    const latest = pickLatestMeaningfulNote(notes);
    return res.json({
      patient: {
        id: patient?.id || "",
        name: patient?.name || "",
        age: patient?.age || 0,
        diagnosis: patient?.diagnosis || "",
        doctor: patient?.doctor || patient?.doctorName || "Dr. Smith",
        predictionPercentage:
          patient?.prediction_percentage ??
          patient?.readmission_probability ??
          patient?.risk_score ??
          patient?.riskScore ??
          0,
        riskLevel: patient?.risk_level || patient?.riskLevel || "Medium",
      },
      latestNote: latest
        ? {
            originalNote: latest.originalNote,
            simplifiedNote: latest.simplifiedNote,
            createdAt: latest.createdAt,
          }
        : { originalNote: "", simplifiedNote: "", createdAt: null },
      previousNotes: notes.map((note) => ({
        originalNote: note.originalNote,
        simplifiedNote: note.simplifiedNote,
        createdAt: note.createdAt,
      })),
    });
  }
  if (!ensureSupabase(res)) return;

  const patient = await resolvePatient(req, patientId);
  if (!patient) return res.status(404).json({ message: "Patient not found" });

  const notesResponse = await supabaseAdmin
    .from("discharge_notes")
    .select("*")
    .eq("patient_id", patient.id)
    .order("created_at", { ascending: false });

  if (notesResponse.error) {
    return res.status(500).json({ message: "Failed to load discharge notes", error: notesResponse.error.message });
  }

  const notes = (notesResponse.data || []).map((row) => mapNote(row));
  const latestNote = pickLatestMeaningfulNote(notes);

  return res.json({
    patient: {
      id: patient.id,
      name: patient.name || "",
      age: patient.age || 0,
      diagnosis: patient.diagnosis || "",
      doctor: patient.doctor || "Dr. Smith",
      predictionPercentage:
        patient.prediction_percentage ?? patient.readmission_probability ?? patient.risk_score ?? 0,
      riskLevel: patient.risk_level || "Medium",
    },
    latestNote: latestNote
      ? {
          originalNote: latestNote.originalNote,
          simplifiedNote: latestNote.simplifiedNote,
          createdAt: latestNote.createdAt,
        }
      : { originalNote: "", simplifiedNote: "", createdAt: null },
    previousNotes: notes.map((note) => ({
      originalNote: note.originalNote,
      simplifiedNote: note.simplifiedNote,
      createdAt: note.createdAt,
    })),
  });
});

module.exports = router;
