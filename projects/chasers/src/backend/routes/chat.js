const express = require("express");
const { supabaseAdmin, ensureSupabase } = require("../lib/supabase");
const { requireAuth, requireRole } = require("../middleware/auth");
const { generateChatReplyWithAI } = require("../services/openaiService");

const router = express.Router();

const redFlagSymptoms = [
  "chest pain",
  "shortness of breath",
  "can't breathe",
  "cant breathe",
  "severe pain",
  "fainting",
  "swelling",
  "high fever",
];

function containsRedFlag(message = "") {
  const normalized = message.toLowerCase();
  return redFlagSymptoms.some((keyword) => normalized.includes(keyword));
}

function buildFriendlyReply({ message = "", patientAge = null, emergency = false }) {
  if (emergency) {
    return "Your symptoms may be serious. Please call 911 now or go to the nearest ER. I already alerted your doctor.";
  }
  const normalized = String(message || "").toLowerCase();
  if (normalized.includes("confused") || normalized.includes("don't understand")) {
    return "You are doing the right thing by asking. I can explain in simple steps. Tell me which part is confusing and I will make it easier.";
  }
  if (normalized.includes("pain")) {
    return "I am sorry you are hurting. Please rest, take your prescribed pain medicine exactly as instructed, and tell your doctor if the pain gets worse or does not improve.";
  }
  if (Number(patientAge) >= 65) {
    return "Thank you for the update. Please keep steps simple today: take your medicines on time, drink water, rest, and call your doctor if breathing, pain, or dizziness gets worse.";
  }
  return "Thanks for the update. Keep resting, stay hydrated, and continue your medications as prescribed. If symptoms get worse, contact your care team right away.";
}

router.get("/history/:patientId", requireAuth, async (req, res) => {
  if (!supabaseAdmin) return res.json([]);
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
    .from("chat_messages")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: true });
  if (error) return res.status(500).json({ message: "Failed to load chat history", error: error.message });
  return res.json(data || []);
});

router.post("/", requireAuth, requireRole("patient"), async (req, res) => {
  const { message = "", patient_id: requestedPatientId = "", patient_name: requestedPatientName = "" } = req.body || {};
  let patientId = "1";
  let patientName = requestedPatientName || "";
  if (supabaseAdmin) {
    if (!ensureSupabase(res)) return;
    if (req.profile.demoAuth) {
      if (requestedPatientId) {
        patientId = String(requestedPatientId);
      } else {
        const { data: mariaPatient } = await supabaseAdmin
          .from("patients")
          .select("id, name")
          .eq("email", "patient@dischargeiq.com")
          .limit(1)
          .single();
        if (mariaPatient?.id) {
          patientId = String(mariaPatient.id);
          patientName = patientName || mariaPatient.name || "";
        } else {
          const { data: firstPatient } = await supabaseAdmin
            .from("patients")
            .select("id, name")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
          if (firstPatient?.id) {
            patientId = String(firstPatient.id);
            patientName = patientName || firstPatient.name || "";
          }
        }
      }
    } else {
      const { data: patient } = await supabaseAdmin
        .from("patients")
        .select("id, name")
        .eq("profile_id", req.profile.id)
        .single();

      if (!patient) {
        return res.status(404).json({ message: "Patient record not found for logged-in user" });
      }
      patientId = patient.id;
      patientName = patientName || patient?.name || "";
    }
  }
  const alertCreated = containsRedFlag(message);

  let alert = null;
  let patientAge = null;

  if (supabaseAdmin) {
    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("age, name")
      .eq("id", patientId)
      .single();
    patientAge = patient?.age ?? null;
    patientName = patientName || patient?.name || "";
  }

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
      const patient = (req.app.locals.mockStore?.patients || []).find((item) => item.id === patientId);
      alert = {
        id: Date.now().toString(),
        ...alert,
        patientName: patient?.name || "Unknown patient",
        created_at: new Date().toISOString()
      };
      req.app.locals.mockStore.alerts.unshift(alert);
    }
  }
  let recentMessages = [];
  if (supabaseAdmin) {
    const recent = await supabaseAdmin
      .from("chat_messages")
      .select("sender, message, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(8);
    recentMessages = Array.isArray(recent.data) ? recent.data.slice().reverse() : [];
  }

  let reply =
    (await generateChatReplyWithAI({
      message,
      age: patientAge,
      patientName,
      recentMessages,
      emergency: alertCreated,
    }).catch(() => null)) || null;

  if (!reply) {
    reply = buildFriendlyReply({ message, patientAge, emergency: alertCreated });
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
