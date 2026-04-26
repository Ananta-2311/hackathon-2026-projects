import { getAccessToken } from "./auth";

const viteBaseUrl =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_API_BASE_URL
    : undefined;

const API_BASE_URL =
  viteBaseUrl ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5001/api";

async function request(path, options = {}) {
  const token = await getAccessToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(options.headers || {}),
    },
    ...options,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

function normalizePatient(patient = {}) {
  const prediction =
    patient.predictionPercentage ??
    patient.prediction_percentage ??
    patient.readmission_probability ??
    patient.riskScore ??
    50;
  const riskScore = Number(prediction);
  return {
    ...patient,
    doctor: patient.doctor ?? patient.doctorName ?? "Care Team",
    dischargeDate: patient.dischargeDate ?? patient.discharge_date ?? patient.created_at ?? "-",
    riskScore,
    predictionPercentage: riskScore,
    riskLevel: patient.riskLevel ?? patient.risk_level ?? (riskScore >= 70 ? "High" : riskScore >= 40 ? "Medium" : "Low"),
    riskReasons: patient.riskReasons ?? patient.reasons ?? [],
  };
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
  return request(`/patients/${id}`, { headers: { "x-user-role": "doctor", "x-user-id": "doctor-1" } }).then((data) =>
    normalizePatient(data)
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
  return request("/instructions/send", {
    method: "POST",
    headers: { "x-user-role": "doctor", "x-user-id": "doctor-1" },
    body: JSON.stringify(data),
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
  return request("/chat", {
    method: "POST",
    headers: { "x-user-role": "patient", "x-user-id": "patient-1" },
    body: JSON.stringify(data),
  });
}

export function getAlerts() {
  return request("/alerts", { headers: { "x-user-role": "doctor", "x-user-id": "doctor-1" } });
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
    dischargeNotes: {
      originalNote:
        "Administer prescribed cardiac medication twice daily with food and monitor for dyspnea, chest discomfort, edema, or dizziness.",
      simplifiedNote:
        "Take your heart medicine two times a day with food. Call your doctor if you have chest pain, trouble breathing, swelling, or dizziness.",
    },
    chatMessages: [],
    alerts: [],
  };

  return request("/patient-dashboard?patient_id=60a0567c-d7b8-4139-accc-d103ca919017", {
    headers: { "x-user-role": "patient", "x-user-id": "patient-1" },
  })
    .then((dashboard) => ({
      ...dashboard,
      patient: normalizePatient(dashboard?.patient || {}),
    }))
    .catch(() => mariaFallback);
}

export { API_BASE_URL };
