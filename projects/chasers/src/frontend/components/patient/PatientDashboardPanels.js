"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getPatientDashboardData } from "@/lib/api";

export default function PatientDashboardPanels() {
  const [dashboard, setDashboard] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const data = await getPatientDashboardData();
        setDashboard(data);
      } catch (_error) {
        setErrorMessage("Unable to load your dashboard right now.");
      }
    }

    loadDashboard();
    const intervalId = setInterval(() => {
      loadDashboard().catch(() => {});
    }, 10000);
    return () => clearInterval(intervalId);
  }, []);

  const patient = dashboard?.patient || dashboard || {};
  const latestNote = dashboard?.latestNote || {};
  const previousNotes = Array.isArray(dashboard?.previousNotes) ? dashboard.previousNotes : [];
  const olderNotes = previousNotes.filter(
    (note, index) =>
      !(index === 0 && latestNote?.createdAt && note?.createdAt && note.createdAt === latestNote.createdAt)
  );
  const fallbackReminders = [
    { name: "Metoprolol", dose: "25mg", schedule: "twice daily", dueTime: "Morning & Evening" },
    { name: "Furosemide", dose: "20mg", schedule: "once daily", dueTime: "Morning" },
    { name: "Lisinopril", dose: "10mg", schedule: "once daily", dueTime: "Morning" },
  ];
  const reminders =
    Array.isArray(patient?.reminders) && patient.reminders.length ? patient.reminders : fallbackReminders;
  const dischargeDateRaw = patient?.dischargeDate || patient?.discharge_date || patient?.created_at || "";
  const dischargeDate = useMemo(() => {
    if (!dischargeDateRaw) return "-";
    const parsed = new Date(dischargeDateRaw);
    if (Number.isNaN(parsed.getTime())) return dischargeDateRaw;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(parsed);
  }, [dischargeDateRaw]);

  const dueBanner = useMemo(() => {
    if (!reminders.length) return "No medications due today.";
    const items = reminders.map((item) => `${item.name} at ${item.dueTime}`);
    return `Today: ${items.join(", ")}`;
  }, [reminders]);

  return (
    <main className="mx-auto w-full max-w-5xl">
      <header className="mb-6 border border-slate-300 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{patient?.name || "Patient"}</h1>
            <p className="text-base text-slate-700">Age {patient?.age || "-"}</p>
          </div>
          <img
            src="/api/maria-avatar"
            alt="Maria profile"
            className="h-14 w-14 rounded-full border border-slate-200 object-cover"
            onError={(event) => {
              event.currentTarget.src = "https://api.dicebear.com/9.x/avataaars/svg?seed=Maria";
            }}
          />
        </div>
        <div className="mt-3 text-base text-slate-700">
          <p>Diagnosis: {patient?.diagnosis || "-"}</p>
          <p>Discharge Date: {dischargeDate}</p>
          <p>Doctor: {patient?.doctor || "-"}</p>
          <p>
            Prediction:{" "}
            {patient?.predictionPercentage ?? patient?.prediction_percentage ?? patient?.readmission_probability ?? "-"}%
          </p>
        </div>
      </header>

      {errorMessage ? <p className="mb-4 font-semibold text-red-700">{errorMessage}</p> : null}

      <section className="space-y-5 text-base">
        <article className="border border-slate-300 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Discharge Instructions</h2>
          <div className="mt-4 space-y-3">
            <div className="border p-3">
              <p className="mb-1 font-semibold">Doctor&apos;s Notes</p>
              <p className="text-slate-700">{latestNote?.originalNote || "No discharge note sent yet."}</p>
            </div>
            <div className="border p-3">
              <p className="mb-1 font-semibold">Your Instructions</p>
              <p className="text-slate-700">{latestNote?.simplifiedNote || "No simplified instructions yet."}</p>
            </div>
          </div>
        </article>

        <article className="border border-slate-300 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Previous Instructions</h2>
          {olderNotes.length ? (
            <div className="mt-3 space-y-2">
              {olderNotes.map((note, index) => (
                <div key={`${note.createdAt || "note"}-${index}`} className="border p-3 text-sm text-slate-700">
                  <p className="mb-1 font-semibold">{note.createdAt || "Unknown date"}</p>
                  <p>Doctor: {note.originalNote || "-"}</p>
                  <p>Your Instructions: {note.simplifiedNote || "-"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No previous instructions yet.</p>
          )}
        </article>

        <article className="border border-slate-300 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Medication Reminders</h2>
          <p className="mt-2 rounded bg-blue-50 p-2 font-semibold text-blue-900">{dueBanner}</p>
          <ul className="mt-3 space-y-2">
            {reminders.map((item) => (
              <li key={`${item.name}-${item.dueTime}`} className="border p-3 text-slate-800">
                {item.name} {item.dose} — {item.schedule}
              </li>
            ))}
          </ul>
        </article>

        <div className="flex justify-end">
          <Link
            href="/chat"
            className="rounded border border-slate-400 bg-white px-4 py-2 text-base font-semibold text-slate-800"
          >
            Open Health Chatbot
          </Link>
        </div>
      </section>
    </main>
  );
}
