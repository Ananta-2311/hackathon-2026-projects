"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const languages = [
  { label: "English", value: "English" },
  { label: "Spanish", value: "Spanish" },
  { label: "French", value: "French" },
  { label: "Arabic", value: "Arabic" },
  { label: "Mandarin", value: "Mandarin" },
  { label: "Hindi", value: "Hindi" },
];

function badgeClass(score) {
  if (score >= 70) return "bg-red-100 text-red-800 border-red-200";
  if (score >= 40) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-green-100 text-green-800 border-green-200";
}

export default function DoctorDashboardPanels({ showLogout = true }) {
  const apiBaseUrl = "http://127.0.0.1:8000";
  const [patients, setPatients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [previousNotes, setPreviousNotes] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [originalText, setOriginalText] = useState("");
  const [simplifiedText, setSimplifiedText] = useState("");
  const [language, setLanguage] = useState("English");
  const [prescriptionText, setPrescriptionText] = useState("");
  const [extractedReminders, setExtractedReminders] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      let patientsData = [];
      let patientsError = "";
      try {
        const patientsResponse = await fetch(`${apiBaseUrl}/patients`, {
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!patientsResponse.ok) {
          throw new Error(`Patients API failed: ${patientsResponse.status}`);
        }
        const response = await patientsResponse.json();
        patientsData = response.patients || [];
        patientsError = response.error || "";
      } catch (_error) {
        patientsData = [];
        patientsError = "Could not load patients from backend.";
      }

      try {
        const alertsResponse = await fetch(`${apiBaseUrl}/alerts`, { cache: "no-store" });
        const alertsData = await alertsResponse.json();
        setAlerts(Array.isArray(alertsData?.alerts) ? alertsData.alerts : []);
      } catch (_error) {
        setAlerts([]);
      }

      setPatients(patientsData || []);
      if (patientsData?.length) {
        setSelectedPatientId(patientsData[0].id);
        setStatusMessage(patientsError);
      } else {
        setStatusMessage("Could not load dashboard data.");
      }
    }

    loadData().catch(() => setStatusMessage("Could not load dashboard data."));
  }, []);

  useEffect(() => {
    if (!selectedPatientId) return;

    const patient = patients.find((item) => String(item.id) === String(selectedPatientId)) || null;
    setSelectedPatient(patient);
    setOriginalText("");
    setSimplifiedText("");
    setPreviousNotes([]);
    setChatHistory([]);

    async function loadPatientDetails() {
      try {
        const dashboardResponse = await fetch(`${apiBaseUrl}/patient-dashboard?patient_id=${selectedPatientId}`, {
          cache: "no-store",
        });
        const dashboardData = await dashboardResponse.json();
        if (dashboardData?.patient) {
          setSelectedPatient((prev) => ({ ...(prev || {}), ...dashboardData.patient }));
        }
        if (dashboardData?.dischargeNotes?.originalNote) {
          setOriginalText(dashboardData.dischargeNotes.originalNote);
        }
      } catch (_error) {
        setStatusMessage("Could not load patient details.");
      }

      try {
        const notesResponse = await fetch(`${apiBaseUrl}/discharge-notes?patient_id=${selectedPatientId}`, {
          cache: "no-store",
        });
        const notesData = await notesResponse.json();
        setPreviousNotes(Array.isArray(notesData?.notes) ? notesData.notes : []);
      } catch (_error) {
        setPreviousNotes([]);
      }

      try {
        const chatResponse = await fetch(`${apiBaseUrl}/chat-history?patient_id=${selectedPatientId}`, {
          cache: "no-store",
        });
        const chatData = await chatResponse.json();
        setChatHistory(Array.isArray(chatData?.chatMessages) ? chatData.chatMessages : []);
      } catch (_error) {
        setChatHistory([]);
      }
    }

    loadPatientDetails().catch(() => setStatusMessage("Could not load patient details."));
  }, [selectedPatientId, patients]);

  const alertByPatient = useMemo(() => {
    const map = {};
    alerts.forEach((alert) => {
      const key = String(alert.patientId || alert.patient_id);
      if (!map[key]) map[key] = [];
      map[key].push(alert.message);
    });
    return map;
  }, [alerts]);

  const selectedPatientAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          String(alert.patientId || alert.patient_id) === String(selectedPatientId) &&
          String(alert.severity || "").toLowerCase() === "high"
      ),
    [alerts, selectedPatientId]
  );
  const emergencyAlert = selectedPatientAlerts[0] || null;
  const chatSummary = useMemo(() => {
    if (!chatHistory.length) {
      return {
        totalMessages: 0,
        patientMessages: 0,
        latestPatientMessage: "No patient chat messages yet.",
        urgentSignals: [],
      };
    }

    const patientMsgs = chatHistory.filter(
      (message) => String(message.sender || message.role || "").toLowerCase() === "user"
    );
    const latestPatient = patientMsgs[patientMsgs.length - 1];
    const urgentKeywords = [
      "chest pain",
      "shortness of breath",
      "trouble breathing",
      "severe pain",
      "fainting",
      "confusion",
      "bleeding",
    ];
    const allPatientText = patientMsgs.map((item) => String(item.message || "").toLowerCase()).join(" ");
    const urgentSignals = urgentKeywords.filter((keyword) => allPatientText.includes(keyword));

    return {
      totalMessages: chatHistory.length,
      patientMessages: patientMsgs.length,
      latestPatientMessage: latestPatient?.message || "No patient chat messages yet.",
      urgentSignals,
    };
  }, [chatHistory]);

  async function onSimplify() {
    if (!selectedPatientId || !originalText.trim()) return;
    try {
      const response = await fetch(`${apiBaseUrl}/simplify-discharge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: selectedPatientId,
          note: originalText,
          language,
        }),
      });
      if (!response.ok) {
        throw new Error(`Simplify failed: ${response.status}`);
      }
      const result = await response.json();
      setSimplifiedText(result.simplifiedNote || "");
      setStatusMessage("Instructions simplified.");
    } catch (_error) {
      setStatusMessage("Simplify failed. Check backend/API and try again.");
    }
  }

  async function onSend() {
    if (!selectedPatientId) {
      setStatusMessage("Select a patient first.");
      return;
    }
    if (!originalText.trim()) {
      setStatusMessage("Add doctor notes before sending.");
      return;
    }
    if (!simplifiedText.trim()) {
      setStatusMessage("Please simplify instructions before sending.");
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/send-discharge-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: selectedPatientId,
          original_note: originalText,
          simplified_note: simplifiedText,
          language,
        }),
      });
      if (!response.ok) {
        throw new Error(`Send failed: ${response.status}`);
      }
      await response.json();
      setStatusMessage("Sent to patient.");
    } catch (_error) {
      setStatusMessage("Send failed. Check backend/API and try again.");
    }
  }

  async function onExtractPrescription() {
    if (!selectedPatientId) return;
    try {
      const response = await fetch(`${apiBaseUrl}/update-prescription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: selectedPatientId,
          prescription: prescriptionText,
        }),
      });
      if (!response.ok) {
        throw new Error(`Prescription extraction failed: ${response.status}`);
      }
      const result = await response.json();
      const reminders = result.reminders || [];
      setExtractedReminders(reminders);
      setStatusMessage("Prescription updated.");
      setPatients((prev) =>
        prev.map((patient) =>
          String(patient.id) === String(selectedPatientId)
            ? { ...patient, prescription: prescriptionText, medicationsCount: reminders.length || 0 }
            : patient
        )
      );
    } catch (_error) {
      setStatusMessage("Prescription extraction failed. Check backend/API and try again.");
    }
  }

  return (
    <main className="mx-auto max-w-7xl">
      <header className="mb-4 flex items-center justify-between border border-slate-200 bg-white p-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Clinician Dashboard</h1>
          <p className="text-sm text-slate-600">DischargeIQ care management</p>
        </div>
        {showLogout ? (
          <Link href="/" className="rounded border px-3 py-1 text-sm font-semibold text-slate-700">
            Logout
          </Link>
        ) : null}
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_1.9fr]">
        <aside className="border border-slate-200 bg-white">
          <div className="border-b p-3 font-semibold text-slate-800">Patients</div>
          <div className="max-h-[78vh] overflow-auto">
            {patients.map((patient) => {
              const patientAlerts = [
                ...(patient.alerts || []),
                ...(alertByPatient[String(patient.id)] || []),
              ];
              const prediction = patient.predictionPercentage ?? patient.riskScore ?? 0;
              return (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => setSelectedPatientId(patient.id)}
                  className={`w-full border-b p-3 text-left hover:bg-slate-50 ${
                    String(selectedPatientId) === String(patient.id) ? "bg-slate-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{patient.name}</p>
                      <p className="text-xs text-slate-600">{patient.diagnosis}</p>
                      <p className="text-xs text-slate-700">
                        {patient.riskLevel || "Medium"} ({prediction}%)
                      </p>
                    </div>
                    <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${badgeClass(prediction)}`}>
                      {prediction}%
                    </span>
                  </div>
                  {patientAlerts[0] ? (
                    <p className="mt-2 text-xs font-semibold text-red-700">🚨 {patientAlerts[0]}</p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

        <div className="space-y-4">
          <article className="border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">Patient Detail</h2>
            {selectedPatient ? (
              <div className="mt-3 space-y-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">
                  {selectedPatient.name} • Age {selectedPatient.age}
                </p>
                <p>ID: {selectedPatient.id || "N/A"}</p>
                <p>Diagnosis: {selectedPatient.diagnosis || "N/A"}</p>
                <p>Email: {selectedPatient.email || "N/A"}</p>
                <p>Phone: {selectedPatient.phone || "N/A"}</p>
                <p>Address: {selectedPatient.address || "N/A"}</p>
                <p>Risk: {selectedPatient.riskLevel || "Medium"}</p>
                <p className="font-semibold text-slate-900">
                  Prediction: {selectedPatient.predictionPercentage ?? selectedPatient.readmissionProbability ?? "-"}%
                </p>
                <p>Medical history: {selectedPatient.medicalHistory || "N/A"}</p>
                <p>Prescription: {selectedPatient.prescription || "N/A"}</p>
                <p>Patient report: {selectedPatient.patientReport || "N/A"}</p>
                <div>
                  <p className="font-semibold text-slate-900">Risk reasons</p>
                  <ul className="list-disc pl-5">
                    {(selectedPatient.riskReasons || []).map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
                <p className="rounded bg-blue-50 p-2 font-medium text-blue-900">
                  Recommended action: {selectedPatient.recommendedAction || "Standard discharge follow-up in 14 days."}
                </p>
                {selectedPatientAlerts.length ? (
                  <div className="rounded border border-red-200 bg-red-50 p-2 text-red-800">
                    <p className="font-semibold">High alerts</p>
                    {selectedPatientAlerts.map((alert) => (
                      <p key={alert.id || alert.message}>- {alert.message}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </article>

          <article className="border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-900">Discharge Instructions</h3>
            <textarea
              className="mt-2 h-28 w-full border p-2 text-sm"
              value={originalText}
              onChange={(event) => setOriginalText(event.target.value)}
              placeholder="Doctor's medical notes"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={onSimplify} className="rounded bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white">
                Simplify
              </button>
              <select value={language} onChange={(event) => setLanguage(event.target.value)} className="border px-2 py-1.5 text-xs">
                {languages.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <button type="button" onClick={onSend} className="rounded bg-green-700 px-3 py-1.5 text-xs font-semibold text-white">
                Send to Patient
              </button>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <div className="border p-2 text-xs">
                <p className="mb-1 font-semibold">Before</p>
                <p>{originalText || "-"}</p>
              </div>
              <div className="border p-2 text-xs">
                <p className="mb-1 font-semibold">After</p>
                <p>{simplifiedText || "-"}</p>
              </div>
            </div>
          </article>

          <article className="border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-900">Prescription Upload (text for now)</h3>
            <textarea
              className="mt-2 h-20 w-full border p-2 text-sm"
              value={prescriptionText}
              onChange={(event) => setPrescriptionText(event.target.value)}
              placeholder={"Metoprolol|5mg|Take in the morning with food\nAtorvastatin|20mg|Take at night"}
            />
            <button
              type="button"
              onClick={onExtractPrescription}
              className="mt-2 rounded bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Extract + Create Reminders
            </button>
            {extractedReminders.length ? (
              <ul className="mt-3 space-y-1 text-xs text-slate-700">
                {extractedReminders.map((item) => (
                  <li key={`${item.name}-${item.dueTime}`}>
                    {item.name} {item.dose} — {item.schedule} ({item.dueTime})
                  </li>
                ))}
              </ul>
            ) : null}
          </article>

          <article className="border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-900">Previous Notes</h3>
            {previousNotes.length ? (
              <div className="mt-2 space-y-2 text-xs">
                {previousNotes.map((note) => (
                  <div key={note.id || `${note.patient_id}-${note.created_at}`} className="border p-2">
                    <p className="font-semibold">{note.created_at || "Unknown date"}</p>
                    <p>Doctor: {note.original_note || "-"}</p>
                    <p>Simplified: {note.simplified_note || "-"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-600">No previous notes for this patient.</p>
            )}
          </article>

          <article className="border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-900">Chat History</h3>
            {chatHistory.length ? (
              <div className="mt-2 space-y-2 text-xs">
                {chatHistory.map((message) => (
                  <div key={message.id || `${message.created_at}-${message.message}`} className="border p-2">
                    <p className="font-semibold">{message.sender || message.role || "Unknown sender"}</p>
                    <p>{message.message || "-"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-600">No chat history for this patient.</p>
            )}
          </article>

          <article className="border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-900">Chat Summary</h3>
            <div className="mt-2 space-y-2 text-sm text-slate-700">
              <p>Total messages: {chatSummary.totalMessages}</p>
              <p>Patient messages: {chatSummary.patientMessages}</p>
              <p className="rounded bg-slate-50 p-2">
                <span className="font-semibold">Latest patient concern:</span>{" "}
                {chatSummary.latestPatientMessage}
              </p>
              <p>
                <span className="font-semibold">Urgent signals:</span>{" "}
                {chatSummary.urgentSignals.length ? chatSummary.urgentSignals.join(", ") : "None detected"}
              </p>
            </div>
          </article>

          <article className="border border-red-200 bg-red-50 p-4">
            <h3 className="font-semibold text-red-900">Emergency Right Now</h3>
            {emergencyAlert ? (
              <div className="mt-2 text-sm text-red-800">
                <p className="font-semibold">High-risk alert from patient chatbot</p>
                <p className="mt-1">{emergencyAlert.message}</p>
                <p className="mt-2 font-semibold">Action: Contact patient immediately.</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-red-700">No active high-risk emergency alert right now.</p>
            )}
          </article>

          {statusMessage ? <p className="text-xs font-semibold text-emerald-700">{statusMessage}</p> : null}
        </div>
      </section>
    </main>
  );
}
