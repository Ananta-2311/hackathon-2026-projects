"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPatientDashboardData } from "@/lib/api";

export default function PatientDashboardPanels() {
  const [dashboard, setDashboard] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [notification, setNotification] = useState("");
  const lastNoteCreatedAtRef = useRef("");

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard(isRefresh = false) {
      try {
        const data = await getPatientDashboardData();
        if (!isMounted) return;
        setDashboard(data);

        const newestNoteCreatedAt =
          data?.dischargeNotes?.createdAt || data?.discharge_notes?.created_at || "";
        if (
          isRefresh &&
          newestNoteCreatedAt &&
          lastNoteCreatedAtRef.current &&
          newestNoteCreatedAt !== lastNoteCreatedAtRef.current
        ) {
          setNotification("New instructions from your doctor are available.");
        }
        if (newestNoteCreatedAt) {
          lastNoteCreatedAtRef.current = newestNoteCreatedAt;
        }
      } catch (_error) {
        if (!isMounted) return;
        setErrorMessage("Unable to load your dashboard right now.");
      }
    }

    loadDashboard(false);
    const intervalId = setInterval(() => {
      loadDashboard(true).catch(() => {});
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const patient = dashboard?.patient || dashboard || {};
  const dischargeNotes = {
    originalNote:
      dashboard?.dischargeNotes?.originalNote ||
      dashboard?.discharge_notes?.original_note ||
      dashboard?.originalNote ||
      "",
    simplifiedNote:
      dashboard?.dischargeNotes?.simplifiedNote ||
      dashboard?.discharge_notes?.simplified_note ||
      dashboard?.simplifiedNote ||
      "",
  };
  const noteHistory = Array.isArray(dashboard?.noteHistory) ? dashboard.noteHistory : [];
  const reminders = Array.isArray(patient?.reminders) ? patient.reminders : [];
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
      {notification ? <p className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 font-semibold text-blue-900">{notification}</p> : null}

      <section className="space-y-5 text-base">
        <article className="border border-slate-300 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Discharge Instructions</h2>
          <div className="mt-4 space-y-3">
            <div className="border p-3">
              <p className="mb-1 font-semibold">Doctor&apos;s Notes</p>
              <p className="text-slate-700">{dischargeNotes.originalNote || "-"}</p>
            </div>
            <div className="border p-3">
              <p className="mb-1 font-semibold">Your Instructions</p>
              <p className="text-slate-700">{dischargeNotes.simplifiedNote || "-"}</p>
            </div>
            {dischargeNotes?.translatedNote ? (
              <div className="border p-3">
                <p className="mb-1 font-semibold">In {dischargeNotes.translatedLanguage?.toUpperCase()}</p>
                <p className="text-slate-700">{dischargeNotes.translatedNote}</p>
              </div>
            ) : null}
          </div>
        </article>

        <article className="border border-slate-300 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Previous Notes</h2>
          {noteHistory.length ? (
            <div className="mt-3 space-y-3">
              {noteHistory.map((note) => (
                <div key={note.id || `${note.createdAt}-${note.originalNote}`} className="border p-3">
                  <p className="mb-1 text-sm font-semibold text-slate-800">{note.createdAt || "Unknown date"}</p>
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">Original:</span> {note.originalNote || "-"}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    <span className="font-semibold">Simplified:</span> {note.simplifiedNote || "-"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No previous notes yet.</p>
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
