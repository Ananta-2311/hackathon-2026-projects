"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getPatientDashboardData } from "@/lib/api";

export default function PatientDashboardPanels() {
  const [patient, setPatient] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    getPatientDashboardData()
      .then((data) => setPatient(data))
      .catch(() => setErrorMessage("Unable to load your dashboard right now."));
  }, []);

  const dueBanner = useMemo(() => {
    if (!patient?.reminders?.length) return "No medications due today.";
    const items = patient.reminders.map((item) => `${item.name} at ${item.dueTime}`);
    return `Today: ${items.join(", ")}`;
  }, [patient]);

  return (
    <main className="mx-auto w-full max-w-5xl">
      <header className="mb-6 border border-slate-300 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{patient?.name || "Patient"}</h1>
            <p className="text-base text-slate-700">Age {patient?.age || "-"}</p>
          </div>
          <div className="h-14 w-14 rounded-full bg-slate-200" aria-label="Profile photo placeholder" />
        </div>
        <div className="mt-3 text-base text-slate-700">
          <p>Diagnosis: {patient?.diagnosis || "-"}</p>
          <p>Discharge Date: {patient?.dischargeDate || "-"}</p>
          <p>Doctor: {patient?.doctorName || "-"}</p>
        </div>
      </header>

      {errorMessage ? <p className="mb-4 font-semibold text-red-700">{errorMessage}</p> : null}

      <section className="space-y-5 text-base">
        <article className="border border-slate-300 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Discharge Instructions</h2>
          <div className="mt-4 space-y-3">
            <div className="border p-3">
              <p className="mb-1 font-semibold">Doctor&apos;s Notes</p>
              <p className="text-slate-700">{patient?.doctorNotes || "Your doctor has not sent discharge instructions yet."}</p>
            </div>
            <div className="border p-3">
              <p className="mb-1 font-semibold">Your Instructions</p>
              <p className="text-slate-700">{patient?.simplifiedInstructions || "Your doctor has not sent discharge instructions yet."}</p>
            </div>
            {patient?.translatedInstructions ? (
              <div className="border p-3">
                <p className="mb-1 font-semibold">In {patient.translatedLanguage?.toUpperCase()}</p>
                <p className="text-slate-700">{patient.translatedInstructions}</p>
              </div>
            ) : null}
          </div>
        </article>

        <article className="border border-slate-300 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Medication Reminders</h2>
          <p className="mt-2 rounded bg-blue-50 p-2 font-semibold text-blue-900">{dueBanner}</p>
          <ul className="mt-3 space-y-2">
            {(patient?.reminders || []).map((item) => (
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
