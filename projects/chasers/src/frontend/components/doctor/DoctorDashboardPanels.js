"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  extractPrescription,
  getAlerts,
  getChatHistory,
  getInstructionHistory,
  getPatientById,
  getPatients,
  sendInstructionsToPatient,
  simplifyInstructions,
  translateInstructions,
} from "@/lib/api";

const languages = [
  { label: "English", value: "en" },
  { label: "Spanish", value: "es" },
  { label: "French", value: "fr" },
  { label: "Arabic", value: "ar" },
  { label: "Mandarin", value: "zh" },
  { label: "Hindi", value: "hi" },
];

function badgeClass(score) {
  const numeric = Number(score) || 0;
  if (numeric >= 70) return "bg-red-100 text-red-800 border-red-200";
  if (numeric >= 40) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-green-100 text-green-800 border-green-200";
}

export default function DoctorDashboardPanels({ showLogout = true }) {
  const [patients, setPatients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [instructionHistory, setInstructionHistory] = useState([]);
  const [originalText, setOriginalText] = useState("");
  const [simplifiedText, setSimplifiedText] = useState("");
  const [language, setLanguage] = useState("en");
  const [translatedText, setTranslatedText] = useState("");
  const [prescriptionText, setPrescriptionText] = useState("");
  const [extractedReminders, setExtractedReminders] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      const [patientsData, alertsData] = await Promise.all([getPatients(), getAlerts()]);
      setPatients(patientsData || []);
      setAlerts(alertsData || []);
      if (patientsData?.length) setSelectedPatientId(patientsData[0].id);
    }

    loadData().catch(() => setStatusMessage("Could not load dashboard data."));
    const intervalId = setInterval(() => {
      loadData().catch(() => {});
    }, 12000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!selectedPatientId) return;
    Promise.all([
      getPatientById(selectedPatientId),
      getInstructionHistory(selectedPatientId).catch(() => []),
      getChatHistory(selectedPatientId).catch(() => []),
    ])
      .then(([data, instructions, chats]) => {
        setSelectedPatient(data);
        setInstructionHistory(Array.isArray(instructions) ? instructions : []);
        setChatHistory(Array.isArray(chats) ? chats : []);

        const latestInstruction = Array.isArray(instructions) && instructions.length ? instructions[0] : null;
        setOriginalText(
          latestInstruction?.originalNote || latestInstruction?.original_text || data.doctorNotes || ""
        );
        setSimplifiedText(
          latestInstruction?.simplifiedNote || latestInstruction?.simplified_text || data.simplifiedInstructions || ""
        );
        setTranslatedText(
          latestInstruction?.translatedText || latestInstruction?.translated_text || data.translatedInstructions || ""
        );
      })
      .catch(() => setStatusMessage("Could not load patient details."));
  }, [selectedPatientId]);

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
      alerts.filter((alert) => String(alert.patientId || alert.patient_id) === String(selectedPatientId)),
    [alerts, selectedPatientId]
  );

  const chatSummary = useMemo(() => {
    if (!chatHistory.length) {
      return {
        totalMessages: 0,
        patientMessages: 0,
        latestPatientMessage: "No patient messages yet.",
        urgentSignals: [],
      };
    }
    const patientMessages = chatHistory.filter((item) => {
      const sender = String(item.sender || item.role || "").toLowerCase();
      return sender === "patient" || sender === "user";
    });
    const latestPatientMessage = patientMessages.length
      ? patientMessages[patientMessages.length - 1].message
      : "No patient messages yet.";
    const urgentKeywords = ["chest pain", "shortness of breath", "can't breathe", "fainting", "severe pain"];
    const combinedText = patientMessages.map((item) => String(item.message || "").toLowerCase()).join(" ");
    const urgentSignals = urgentKeywords.filter((term) => combinedText.includes(term));
    return {
      totalMessages: chatHistory.length,
      patientMessages: patientMessages.length,
      latestPatientMessage,
      urgentSignals,
    };
  }, [chatHistory]);

  async function onSimplify() {
    if (!selectedPatientId || !originalText.trim()) return;
    try {
      const result = await simplifyInstructions({
        patientId: selectedPatientId,
        originalInstructions: originalText,
        language,
      });
      setSimplifiedText(result.simplifiedInstructions || "");
      setStatusMessage("Instructions simplified.");
    } catch (_error) {
      setStatusMessage("Simplify failed. Check backend/API and try again.");
    }
  }

  async function onTranslate() {
    try {
      const result = await translateInstructions({ text: simplifiedText, language });
      setTranslatedText(result.translatedText || "");
      setStatusMessage("Instructions translated.");
    } catch (_error) {
      setStatusMessage("Translate failed. Check backend/API and try again.");
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
      await sendInstructionsToPatient({
        patientId: selectedPatientId,
        originalText,
        simplifiedText,
        translatedText,
        language,
      });
      setStatusMessage("Instructions sent to patient.");
      const instructions = await getInstructionHistory(selectedPatientId).catch(() => []);
      setInstructionHistory(Array.isArray(instructions) ? instructions : []);
    } catch (error) {
      setStatusMessage(`Send failed: ${error.message || "Check backend/API and try again."}`);
    }
  }

  async function onExtractPrescription() {
    if (!selectedPatientId) return;
    try {
      const result = await extractPrescription({
        patientId: selectedPatientId,
        prescriptionText,
      });
      setExtractedReminders(result.extracted || []);
      setStatusMessage(result.confirmation || "Prescription extracted.");
      const refreshedPatient = await getPatientById(selectedPatientId);
      setSelectedPatient(refreshedPatient);
      setPatients((prev) =>
        prev.map((item) => (String(item.id) === String(selectedPatientId) ? { ...item, ...refreshedPatient } : item))
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
                      <p className="text-xs text-slate-600">
                        Age {patient.age} • {patient.diagnosis}
                      </p>
                    </div>
                    <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${badgeClass(patient.riskScore)}`}>
                      {patient.riskScore ?? patient.predictionPercentage ?? 0}%
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
                <p>Diagnosis: {selectedPatient.diagnosis}</p>
                <p>
                  Medical history:{" "}
                  {Array.isArray(selectedPatient.medicalHistory)
                    ? selectedPatient.medicalHistory.join(", ") || "N/A"
                    : selectedPatient.medicalHistory || "N/A"}
                </p>
                <p className="font-semibold text-slate-900">
                  Risk: {selectedPatient.riskScore ?? selectedPatient.predictionPercentage ?? 0}%
                </p>
                <ul className="list-disc pl-5">
                  {(selectedPatient.riskReasons || []).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <p className="rounded bg-blue-50 p-2 font-medium text-blue-900">
                  {selectedPatient.followUpSuggestion}
                </p>
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
              <button type="button" onClick={onTranslate} className="rounded border px-3 py-1.5 text-xs font-semibold">
                Translate
              </button>
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
                {translatedText ? <p className="mt-2 border-t pt-2">{translatedText}</p> : null}
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
            <h3 className="font-semibold text-slate-900">Chat Summary</h3>
            <div className="mt-2 space-y-1 text-xs text-slate-700">
              <p>Total messages: {chatSummary.totalMessages}</p>
              <p>Patient messages: {chatSummary.patientMessages}</p>
              <p>
                <span className="font-semibold">Latest patient message:</span> {chatSummary.latestPatientMessage}
              </p>
              <p>
                <span className="font-semibold">Urgent signals:</span>{" "}
                {chatSummary.urgentSignals.length ? chatSummary.urgentSignals.join(", ") : "None"}
              </p>
            </div>
          </article>

          <article className="border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-900">Previous Notes</h3>
            {instructionHistory.length ? (
              <div className="mt-2 space-y-2 text-xs text-slate-700">
                {instructionHistory.slice(0, 5).map((item, index) => (
                  <div key={`${item.id || item.createdAt || "note"}-${index}`} className="border p-2">
                    <p className="font-semibold">{item.createdAt || item.created_at || "Unknown date"}</p>
                    <p>Doctor: {item.originalNote || item.original_text || "-"}</p>
                    <p>Simplified: {item.simplifiedNote || item.simplified_text || "-"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-600">No previous notes yet.</p>
            )}
          </article>

          <article className="border border-red-200 bg-red-50 p-4">
            <h3 className="font-semibold text-red-900">Doctor Alerts</h3>
            {selectedPatientAlerts.length ? (
              <div className="mt-2 space-y-1 text-xs text-red-800">
                {selectedPatientAlerts.map((alert) => (
                  <p key={alert.id || `${alert.created_at}-${alert.message}`}>- {alert.message}</p>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-red-700">No active alerts for this patient.</p>
            )}
          </article>

          {statusMessage ? <p className="text-xs font-semibold text-emerald-700">{statusMessage}</p> : null}
        </div>
      </section>
    </main>
  );
}
