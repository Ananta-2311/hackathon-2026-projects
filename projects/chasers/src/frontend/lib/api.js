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

export function getPatients() {
  return request("/patients");
}

export function getCurrentUserProfile() {
  return request("/auth/me");
}

export function getPatientById(id) {
  return request(`/patients/${id}`);
}

export function predictRisk(data) {
  return request("/risk/predict", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function simplifyInstructions(data) {
  return request("/instructions/simplify", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function sendChatMessage(data) {
  return request("/chat", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getAlerts() {
  return request("/alerts");
}

export { API_BASE_URL };
