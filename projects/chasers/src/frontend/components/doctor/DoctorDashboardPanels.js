"use client";

import { useEffect, useMemo, useState } from "react";
import { getPatients, getAlerts } from "@/lib/api";
import LogoutButton from "@/components/auth/LogoutButton";

const fallbackPatients = [
  {
    id: 1,
    name: "Maria Thompson",
    age: 67,
    diagnosis: "Heart Failure",
    riskLevel: "high",
    riskScore: 88,
    reason:
      "Missed doses and shortness of breath trends suggest elevated readmission risk.",
    alert: "⚠️ Chest pain reported 2 hours ago",
  },
  {
    id: 2,
    name: "Daniel Cruz",
    age: 61,
    diagnosis: "COPD Exacerbation",
    riskLevel: "medium",
    riskScore: 56,
    reason:
      "Worsening cough and low inhaler adherence recorded in check-ins this week.",
  },
  {
    id: 3,
    name: "Linda Foster",
    age: 48,
    diagnosis: "Post-pneumonia Recovery",
    riskLevel: "low",
    riskScore: 24,
    reason: "Stable oxygen logs and consistent medication adherence over 5 days.",
  },
];

const fallbackNotifications = [
  "Maria Thompson: chest pain symptom flagged",
  "Daniel Cruz missed evening inhaler yesterday",
  "New symptom report submitted 15 minutes ago",
];

const badgeStyles = {
  low: "bg-emerald-100 text-emerald-800 border-emerald-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  high: "bg-red-100 text-red-800 border-red-200",
};

export default function DoctorDashboardPanels({ showLogout = true }) {
  const [patients, setPatients] = useState(fallbackPatients);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        const [patientData, alertData] = await Promise.all([
          getPatients(),
          getAlerts(),
        ]);
        if (!ignore) {
          const normalizedPatients = patientData.map((patient) => ({
            ...patient,
            riskLevel: String(patient.riskLevel || "low").toLowerCase(),
            reason: patient.reason || patient.notes || "No reason available.",
            alert: Array.isArray(patient.alerts) && patient.alerts.length > 0 ? patient.alerts[0] : null,
          }));
          setPatients(normalizedPatients);
          setAlerts(alertData);
        }
      } catch (error) {
        // Keep demo fallback data when backend is offline.
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, []);

  const notifications = useMemo(() => {
    if (alerts.length > 0) {
      return alerts
        .slice(0, 5)
        .map((item) => `${item.patientId}: ${item.message || "High severity alert"}`);
    }
    return fallbackNotifications;
  }, [alerts]);

  return (
    <main className="mx-auto max-w-6xl">
      <header className="mb-6 flex items-center justify-between rounded-2xl border border-blue-100 bg-white px-6 py-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Welcome, Dr. Smith</h1>
          <p className="text-sm text-slate-600">
            Here is your post-discharge risk overview.
          </p>
        </div>
        {showLogout ? (
          <LogoutButton
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-100"
          />
        ) : null}
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          {patients.map((patient) => (
            <article
              key={patient.id}
              className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"
            >
              {patient.alert ? (
                <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">
                  {patient.alert}
                </div>
              ) : null}

              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {patient.name}
                  </h2>
                  <p className="mt-1 text-slate-600">
                    Age {patient.age} • {patient.diagnosis}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-sm font-semibold capitalize ${badgeStyles[patient.riskLevel]}`}
                >
                  {patient.riskLevel} ({patient.riskScore}%)
                </span>
              </div>

              <p className="mt-4 text-slate-700">
                <span className="font-semibold text-blue-800">Reason:</span>{" "}
                {patient.reason}
              </p>
            </article>
          ))}
        </div>

        <aside className="h-fit rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-blue-900">Notifications</h3>
          <ul className="mt-4 space-y-3">
            {notifications.map((item) => (
              <li
                key={item}
                className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900"
              >
                {item}
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </main>
  );
}
