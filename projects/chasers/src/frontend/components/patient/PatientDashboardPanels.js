"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import LogoutButton from "@/components/auth/LogoutButton";
import { useAuth } from "@/components/auth/AuthProvider";

const medicationItems = [
  { name: "Lisinopril 10mg", dosage: "Once daily", time: "Morning" },
  { name: "Furosemide 20mg", dosage: "After lunch", time: "Afternoon" },
  { name: "Metoprolol 25mg", dosage: "After dinner", time: "Evening" },
];

const instructionItems = [
  "Take your medications at the same time every day.",
  "Drink water regularly unless your doctor says otherwise.",
  "Use low-salt meals to reduce fluid buildup.",
  "Take a short 15-minute walk daily if you feel well.",
  "Call your care team if swelling or breathing gets worse.",
];

const notifications = [
  {
    message: "Your doctor flagged a concern",
    time: "2 hrs ago",
    dotColor: "bg-red-500",
  },
  {
    message: "Medication reminder: Furosemide 20mg",
    time: "5 hours ago",
    dotColor: "bg-blue-500",
  },
  {
    message: "Follow-up appointment confirmed",
    time: "Yesterday",
    dotColor: "bg-emerald-500",
  },
];

const medicationTimeBadgeStyles = {
  Morning: "bg-blue-100 text-blue-800 border-blue-200",
  Afternoon: "bg-orange-100 text-orange-800 border-orange-200",
  Evening: "bg-purple-100 text-purple-800 border-purple-200",
};

export default function PatientDashboardPanels() {
  const [nowMs] = useState(() => Date.now());
  const { patient, profile } = useAuth();
  const discharged = patient?.created_at
    ? `${Math.max(
        1,
        Math.round((nowMs - new Date(patient.created_at).getTime()) / (1000 * 60 * 60 * 24))
      )} days ago`
    : "2 days ago";
  const nextAppointmentDate = "Friday 10am";
  const doctorName = "Assigned care team";

  const healthSummaryItems = useMemo(
    () => [
      { label: "Diagnosis", value: patient?.diagnosis || "Heart Failure" },
      { label: "Discharged", value: discharged },
      { label: "Doctor", value: doctorName },
      { label: "Next appointment", value: nextAppointmentDate },
    ],
    [patient, discharged]
  );

  const medicationCards = medicationItems.map((medication) => {
    const badgeStyle =
      medicationTimeBadgeStyles[medication.time] ?? medicationTimeBadgeStyles.Morning;

    return (
      <article
        key={`${medication.name}-${medication.time}`}
        className="rounded-2xl border border-blue-100 bg-white p-4 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-slate-900">{medication.name}</p>
            <p className="mt-1 text-sm text-slate-500">Dosage: {medication.dosage}</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeStyle}`}>
            {medication.time}
          </span>
        </div>
      </article>
    );
  });

  const instructionCards = instructionItems.map((instruction) => {
    return (
      <article
        key={instruction}
        className="rounded-xl border border-blue-100 border-l-4 border-l-blue-300 bg-white px-4 py-3 shadow-lg"
      >
        <p className="text-base leading-relaxed text-slate-700">{instruction}</p>
      </article>
    );
  });

  const notificationCards = notifications.map((notification) => {
    return (
      <article
        key={`${notification.message}-${notification.time}`}
        className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3"
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.dotColor}`}
            aria-hidden
          />
          <div>
            <p className="text-sm font-medium text-slate-800">{notification.message}</p>
            <p className="mt-1 text-xs text-slate-500">{notification.time}</p>
          </div>
        </div>
      </article>
    );
  });

  return (
    <main className="page-fade mx-auto w-full max-w-none">
      <header className="mb-6 flex items-center justify-between rounded-2xl border border-blue-100 bg-white px-6 py-4 shadow-lg">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">
            Welcome, {profile?.full_name || "Patient"}!
          </h1>
          <p className="text-sm text-slate-600">Here is your recovery plan for today.</p>
        </div>
        <LogoutButton
          className="rounded-xl border border-white/80 bg-white px-4 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-50"
        />
      </header>

      <section className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-lg">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-blue-900">My Health Summary</h2>
              <span className="rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                Days since discharge: 2
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {healthSummaryItems.map((item) => (
                <div key={item.label} className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{item.value}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-blue-900">Notifications</h2>
            <div className="mt-4 space-y-3">{notificationCards}</div>
          </article>
        </div>

        <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-blue-900">My Medications</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{medicationCards}</div>
        </article>

        <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-blue-900">My Discharge Instructions</h2>
          <div className="mt-4 space-y-3">{instructionCards}</div>
        </article>

        <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-blue-900">Recovery Timeline</h2>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
              Discharge
            </div>
            <div className="h-px flex-1 bg-blue-200 sm:mx-2 sm:h-0.5" />
            <div className="rounded-xl border border-blue-300 bg-blue-100 px-4 py-3 text-sm font-semibold text-blue-900">
              Day 2 (Today)
            </div>
            <div className="h-px flex-1 bg-blue-200 sm:mx-2 sm:h-0.5" />
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
              Follow-up
            </div>
          </div>
        </article>

        <div className="sticky bottom-4 z-10 flex justify-end">
          <Link
            href="/chat"
            aria-label="Chat with your AI Health Assistant"
            className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-xl"
          >
            <span aria-hidden className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              AI
            </span>
            <span>Chat with your Health AI Assistant</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
