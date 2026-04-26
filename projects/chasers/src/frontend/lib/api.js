import { getAccessToken, getCurrentUserId } from "./auth";

const viteBaseUrl =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_API_BASE_URL
    : undefined;

const API_BASE_URLS = [
  viteBaseUrl,
  process.env.NEXT_PUBLIC_API_BASE_URL,
  "http://localhost:5001/api",
].filter(Boolean);

const API_BASE_URL = API_BASE_URLS[0];

async function request(path, options = {}) {
  const token = await getAccessToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  let lastError = null;

  for (const baseUrl of API_BASE_URLS) {
    try {
      const mergedHeaders = {
        "Content-Type": "application/json",
        ...authHeaders,
        ...(options.headers || {}),
      };
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: mergedHeaders,
        cache: "no-store",
      });

      if (!response.ok) {
        // If this base URL simply doesn't have this route, try next candidate.
        if (response.status === 404 || response.status === 405) {
          continue;
        }
        let message = `API request failed: ${response.status}`;
        try {
          const payload = await response.json();
          message = payload?.message || payload?.error || message;
        } catch (_error) {
          // ignore parse errors and keep generic status message
        }
        throw new Error(message);
      }

      return response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("API request failed");
}

function normalizePatient(patient = {}) {
  const prediction =
    patient.predictionPercentage ??
    patient.prediction_percentage ??
    patient.readmission_probability ??
    patient.riskScore ??
    50;
  const riskScore = Number.isFinite(Number(prediction)) ? Number(prediction) : null;
  const medicalHistoryRaw = patient.medicalHistory ?? patient.medical_history ?? [];
  const medicalHistory = Array.isArray(medicalHistoryRaw)
    ? medicalHistoryRaw
    : String(medicalHistoryRaw)
        .split(/[;,]/)
        .map((item) => item.trim())
        .filter(Boolean);
  return {
    ...patient,
    doctor: patient.doctor ?? patient.doctorName ?? "Care Team",
    dischargeDate: patient.dischargeDate ?? patient.discharge_date ?? patient.created_at ?? "-",
    riskScore,
    predictionPercentage: riskScore ?? patient.predictionPercentage ?? patient.prediction_percentage ?? patient.readmission_probability,
    riskLevel:
      patient.riskLevel ??
      patient.risk_level ??
      (riskScore == null ? "Medium" : riskScore >= 70 ? "High" : riskScore >= 40 ? "Medium" : "Low"),
    medicalHistory,
    riskReasons: patient.riskReasons ?? patient.reasons ?? [],
  };
}

function extractPrescriptionReminders(prescriptionText = "") {
  const lines = String(prescriptionText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const [name = "Medication", dose = "", schedule = "As directed"] = line.split("|");
    const normalizedSchedule = String(schedule).toLowerCase();
    let dueTime = "As directed";
    if (normalizedSchedule.includes("morning") && normalizedSchedule.includes("evening")) {
      dueTime = "Morning & Evening";
    } else if (normalizedSchedule.includes("morning")) {
      dueTime = "Morning";
    } else if (normalizedSchedule.includes("evening") || normalizedSchedule.includes("night")) {
      dueTime = "Evening";
    } else if (normalizedSchedule.includes("daily")) {
      dueTime = "Daily";
    }
    return {
      name: String(name).trim(),
      dose: String(dose).trim(),
      schedule: String(schedule).trim(),
      dueTime,
    };
  });
}

export function getPatients() {
  return request("/patients", { headers: { "x-user-role": "doctor", "x-user-id": "doctor-1" } }).then((data) => {
    const rows = Array.isArray(data) ? data : data?.patients || [];
    return rows.map((patient) => normalizePatient(patient));
  });
}

export function getCurrentUserProfile() {
  return request("/auth/me");
}

export function getPatientById(id) {
  return request(`/patients/${id}`, {
    headers: { "x-user-role": "doctor", "x-user-id": "doctor-1" },
  })
    .then((data) => normalizePatient(data?.patient || data))
    .catch(() =>
      request(`/patient-dashboard?patient_id=${id}`, {
        headers: { "x-user-role": "doctor", "x-user-id": "doctor-1" },
      }).then((dashboard) => normalizePatient(dashboard?.patient || {}))
    );
}

export function predictRisk(data) {
  return request("/risk/predict", {
    method: "POST",
    headers: { "x-user-role": "doctor", "x-user-id": "doctor-1" },
    body: JSON.stringify(data),
  });
}

export function simplifyInstructions(data) {
  return request("/instructions/simplify", {
    method: "POST",
    headers: { "x-user-role": "doctor", "x-user-id": "doctor-1" },
    body: JSON.stringify(data),
  });
}

export function translateInstructions(data) {
  return request("/instructions/translate", {
    method: "POST",
    headers: { "x-user-role": "doctor", "x-user-id": "doctor-1" },
    body: JSON.stringify(data),
  });
}

export function sendInstructionsToPatient(data) {
  return request("/send-discharge-note", {
    method: "POST",
    headers: { "x-user-role": "doctor", "x-user-id": "doctor-1" },
    body: JSON.stringify({
      patient_id: data.patientId,
      original_note: data.originalText,
      simplified_note: data.simplifiedText,
      language: data.language || "English",
    }),
  });
}

export function extractPrescription(data) {
  return request("/prescriptions/extract", {
    method: "POST",
    headers: { "x-user-role": "doctor", "x-user-id": "doctor-1" },
    body: JSON.stringify(data),
  });
}

export function sendChatMessage(data) {
  return getCurrentUserId().then((userId) =>
    request("/chat", {
      method: "POST",
      headers: { "x-user-role": "patient", "x-user-id": userId || "patient-1" },
      body: JSON.stringify(data),
    })
  );
}

export function getAlerts() {
  return request("/alerts", { headers: { "x-user-role": "doctor", "x-user-id": "doctor-1" } });
}

export function getChatHistory(patientId) {
  return request(`/chat/history/${patientId}`, {
    headers: { "x-user-role": "doctor", "x-user-id": "doctor-1" },
  });
}

export function getInstructionHistory(patientId) {
  return request(`/discharge-notes?patient_id=${encodeURIComponent(patientId)}`, {
    headers: { "x-user-role": "doctor", "x-user-id": "doctor-1" },
  }).then((data) => data?.notes || []);
}

export function getPatientDashboardData() {
  const mariaFallback = {
    patient: {
      id: "60a0567c-d7b8-4139-accc-d103ca919017",
      name: "Maria",
      age: 74,
      gender: "Female",
      email: "patient@dischargeiq.com",
      phone: "",
      address: "",
      diagnosis: "Heart Failure",
      doctor: "Dr. Smith",
      dischargeDate: new Date().toISOString(),
      medicalHistory: "",
      prescription: "",
      patientReport: "",
      predictionPercentage: 50,
      riskLevel: "Medium",
      conditionsCount: 6,
      medicationsCount: 9,
      encountersCount: 12,
      priorAdmissions: 4,
      currentAppointment: "",
      nextAppointmentDate: "",
    },
    latestNote: {
      originalNote:
        "Administer prescribed cardiac medication twice daily with food and monitor for dyspnea, chest discomfort, edema, or dizziness.",
      simplifiedNote:
        "Take your heart medicine two times a day with food. Call your doctor if you have chest pain, trouble breathing, swelling, or dizziness.",
      createdAt: new Date().toISOString(),
    },
    previousNotes: [],
    chatMessages: [],
    alerts: [],
  };

  return getCurrentUserId()
    .then((userId) => {
      const patientHeaders = { "x-user-role": "patient", "x-user-id": userId || "patient-1" };
      let selectedEmail = "";
      if (typeof window !== "undefined") {
        selectedEmail = String(window.localStorage.getItem("demoPatientEmail") || "").toLowerCase();
      }

      if (!selectedEmail) {
        return request("/patient-dashboard", { headers: patientHeaders });
      }

      return request("/patients", { headers: patientHeaders }).then((rows) => {
        const patients = (Array.isArray(rows) ? rows : rows?.patients || []).map((item) => normalizePatient(item));
        const selectedPatient = patients.find((item) => String(item.email || "").toLowerCase() === selectedEmail);
        if (!selectedPatient?.id) {
          return request("/patient-dashboard", { headers: patientHeaders });
        }
        return request(`/patient-dashboard?patient_id=${encodeURIComponent(selectedPatient.id)}`, {
          headers: patientHeaders,
        });
      });
    })
    .then(async (dashboard) => {
      const patient = normalizePatient(dashboard?.patient || {});
      const reminders =
        Array.isArray(patient?.reminders) && patient.reminders.length
          ? patient.reminders
          : extractPrescriptionReminders(patient?.prescription || "");

      // Out-of-box safety: read directly from discharge-notes (same source doctor send uses),
      // then prefer the latest meaningful note over dashboard-provided note.
      const patientId = String(patient?.id || "1");
      let directNotes = [];
      try {
        const direct = await request(`/discharge-notes?patient_id=${encodeURIComponent(patientId)}`, {
          headers: { "x-user-role": "patient", "x-user-id": (await getCurrentUserId()) || "patient-1" },
        });
        directNotes = Array.isArray(direct?.notes) ? direct.notes : [];
      } catch (_error) {
        directNotes = [];
      }

      const mappedDirect = directNotes.map((note) => ({
        originalNote: note?.originalNote ?? note?.original_note ?? "",
        simplifiedNote: note?.simplifiedNote ?? note?.simplified_note ?? "",
        createdAt: note?.createdAt ?? note?.created_at ?? null,
      }));
      const meaningfulDirect = mappedDirect.find(
        (note) => String(note?.originalNote || "").trim() || String(note?.simplifiedNote || "").trim()
      );

      return {
        ...dashboard,
        latestNote: meaningfulDirect || dashboard?.latestNote || { originalNote: "", simplifiedNote: "", createdAt: null },
        previousNotes: mappedDirect.length ? mappedDirect : dashboard?.previousNotes || [],
        patient: { ...patient, reminders },
      };
    })
    .catch(() => mariaFallback);
}

export { API_BASE_URL };
