"use client";

import Link from "next/link";
import { useState } from "react";

const medicationItems = [
  "Lisinopril 10mg - Morning",
  "Furosemide 20mg - Afternoon",
  "Metoprolol 25mg - Evening",
];

const instructionItems = [
  "💊 Take your medications at the same time every day.",
  "💧 Drink water regularly unless your doctor says otherwise.",
  "🧂 Use low-salt meals to reduce fluid buildup.",
  "🚶 Take a short 15-minute walk daily if you feel well.",
  "📞 Call your care team if swelling or breathing gets worse.",
];

export default function PatientDashboardPanels() {
  const [checkedMeds, setCheckedMeds] = useState([]);

  const toggleMedication = (name) => {
    setCheckedMeds((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  };

  return (
    <main className="mx-auto max-w-6xl">
      <header className="mb-6 flex items-center justify-between rounded-2xl border border-blue-100 bg-white px-6 py-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Welcome, Maria!</h1>
          <p className="text-sm text-slate-600">Here is your recovery plan for today.</p>
        </div>
        <Link
          href="/"
          className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-100"
        >
          Logout
        </Link>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-blue-900">My Health Summary</h2>
            <p className="mt-3 text-slate-700">
              <span className="font-semibold">Diagnosis:</span> Heart Failure
            </p>
            <p className="mt-1 text-slate-700">
              <span className="font-semibold">Discharged:</span> 2 days ago
            </p>
          </article>

          <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-blue-900">My Medications</h2>
            <ul className="mt-4 space-y-3">
              {medicationItems.map((med) => (
                <li key={med} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checkedMeds.includes(med)}
                    onChange={() => toggleMedication(med)}
                    className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700">{med}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-blue-900">
              My Discharge Instructions
            </h2>
            <ul className="mt-4 space-y-2">
              {instructionItems.map((instruction) => (
                <li
                  key={instruction}
                  className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-slate-700"
                >
                  {instruction}
                </li>
              ))}
            </ul>
          </article>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-blue-900">Notifications</h3>
            <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Your doctor reviewed your report today.
            </p>
          </div>

          <Link
            href="/chat"
            className="block rounded-2xl bg-blue-700 px-5 py-4 text-center text-base font-semibold text-white transition hover:bg-blue-800"
          >
            Chat with AI Assistant
          </Link>
        </aside>
      </section>
    </main>
  );
}
