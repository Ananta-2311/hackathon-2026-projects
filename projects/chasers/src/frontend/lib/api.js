import { getAccessToken, getCurrentUserId } from "./auth";

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
    patient.riskScore;
  const riskScore = Number.isFinite(Number(prediction)) ? Number(prediction) : null;
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
  return getCurrentUserId()
    .then((userId) =>
      fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": "patient",
          "x-user-id": userId || "",
        },
        body: JSON.stringify(data),
        cache: "no-store",
      })
    )
    .then((response) => {
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      return response.json();
    });
}

export function getAlerts() {
  return request("/alerts", { headers: { "x-user-role": "doctor", "x-user-id": "doctor-1" } });
}

export function getPatientDashboardData() {
  return getCurrentUserId()
    .then((userId) =>
      fetch("http://127.0.0.1:8000/patient-dashboard", {
        headers: {
          "Content-Type": "application/json",
          "x-user-role": "patient",
          "x-user-id": userId || "",
        },
        cache: "no-store",
      })
    )
    .then((response) => {
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      return response.json();
    })
    .then((dashboard) => ({
      ...dashboard,
      patient: normalizePatient(dashboard?.patient || {}),
    }));
}

export { API_BASE_URL };
