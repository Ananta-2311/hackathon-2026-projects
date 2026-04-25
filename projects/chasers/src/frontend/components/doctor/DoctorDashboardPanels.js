 "use client";

import { useEffect, useMemo, useState } from "react";
import { getAlerts, getPatients } from "@/lib/api";
import LogoutButton from "@/components/auth/LogoutButton";
import { useAuth } from "@/components/auth/AuthProvider";

const fallbackPatients = [
  { id: 1, name: "Maria Thompson", age: 67, diagnosis: "Heart Failure", riskLevel: "high", riskScore: 88, reason: "Missed doses and shortness of breath", alert: "Chest pain reported 2 hours ago" },
  { id: 2, name: "Daniel Cruz", age: 61, diagnosis: "COPD Exacerbation", riskLevel: "medium", riskScore: 56, reason: "Worsening cough and low inhaler adherence" },
  { id: 3, name: "Linda Foster", age: 48, diagnosis: "Post-pneumonia Recovery", riskLevel: "low", riskScore: 24, reason: "Stable oxygen logs and consistent medication" },
];

const recentActivity = [
  { text: "Maria Thompson reported chest pain", time: "2 hours ago" },
  { text: "Daniel Cruz missed evening inhaler", time: "5 hours ago" },
  { text: "Linda Foster completed daily check-in", time: "8 hours ago" },
  { text: "Maria Thompson high risk score updated", time: "Yesterday" },
];

const activityDotColors = ["bg-red-500", "bg-amber-500", "bg-emerald-500", "bg-blue-500"];

const badgeStyles = {
  low: "bg-emerald-100 text-emerald-800 border-emerald-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  high: "bg-red-100 text-red-800 border-red-200",
};

export default function DoctorDashboardPanels({ showLogout = true }) {
  const { profile } = useAuth();
  const [patients, setPatients] = useState(fallbackPatients);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        const [patientData, alertData] = await Promise.all([getPatients(), getAlerts()]);
        if (ignore) return;
        const normalized = (patientData || []).map((patient) => ({
          id: patient.id,
          name: patient.name,
          age: patient.age,
          diagnosis: patient.diagnosis,
          riskLevel: String(patient.riskLevel || patient.risk_level || "low").toLowerCase(),
          riskScore: patient.riskScore ?? patient.risk_score ?? 0,
          reason: patient.reason || patient.notes || "No reason available",
          alert:
            (Array.isArray(patient.alerts) && patient.alerts[0]) ||
            patient.alert ||
            null,
        }));
        setPatients(normalized.length > 0 ? normalized : fallbackPatients);
        setAlerts(alertData || []);
      } catch {
        setPatients(fallbackPatients);
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, []);

  const highRiskCount = useMemo(
    () => patients.filter((p) => p.riskLevel === "high").length,
    [patients]
  );

  const notifications = useMemo(() => {
    if (alerts.length > 0) {
      return alerts.slice(0, 5).map((item) => ({
        text: `${item.patient_id || item.patientId}: ${item.message || "Alert"}`,
        time: item.created_at ? new Date(item.created_at).toLocaleString() : "Recent",
        dotColor: item.severity?.toLowerCase() === "high" ? "bg-red-500" : "bg-amber-500",
      }));
    }
    return [
      { text: "Maria Thompson: chest pain symptom flagged", time: "2 hours ago", dotColor: "bg-red-500" },
      { text: "Daniel Cruz missed evening inhaler", time: "Yesterday", dotColor: "bg-amber-500" },
    ];
  }, [alerts]);

  const decoratedPatients = useMemo(
    () =>
      patients.map((patient) => ({
        ...patient,
        progressColor:
          patient.riskLevel === "high"
            ? "bg-red-500"
            : patient.riskLevel === "medium"
              ? "bg-amber-500"
              : "bg-emerald-500",
        cardAccent:
          patient.riskLevel === "high"
            ? "border-l-red-500"
            : patient.riskLevel === "medium"
              ? "border-l-amber-500"
              : "border-l-emerald-500",
      })),
    [patients]
  );

  return (
    <main className="page-fade mx-auto max-w-7xl">
      <header className="mb-6 flex items-center justify-between rounded-2xl border border-blue-100 bg-white px-6 py-4 shadow-lg">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">
            Welcome, {profile?.full_name || "Doctor"}
          </h1>
          <p className="text-sm text-slate-600">
            Here is your post-discharge risk overview.
          </p>
        </div>
        {showLogout ? (
          <LogoutButton
            className="rounded-xl border border-white/80 bg-white px-4 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-50"
          />
        ) : null}
      </header>

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-blue-100 border-t-4 border-t-blue-400 bg-white p-5 shadow-lg">
          <p className="text-sm font-medium text-slate-700">Total Patients</p>
          <p className="mt-2 text-3xl font-bold text-blue-900">{patients.length}</p>
        </article>
        <article className="rounded-2xl border border-blue-100 border-t-4 border-t-red-500 bg-white p-5 shadow-lg">
          <p className="text-sm font-medium text-slate-700">High Risk</p>
          <p className="mt-2 text-3xl font-bold text-red-600">{highRiskCount}</p>
        </article>
        <article className="rounded-2xl border border-blue-100 border-t-4 border-t-amber-500 bg-white p-5 shadow-lg">
          <p className="text-sm font-medium text-slate-700">Alerts Today</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{notifications.length}</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-5">
          {decoratedPatients.map((patient) => (
            <article
              key={patient.id}
              className={`rounded-2xl border border-blue-100 border-l-4 bg-white p-6 shadow-lg ${patient.cardAccent}`}
            >
              {patient.alert ? (
                <div className="mb-4 animate-pulse rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
                  🚨 {patient.alert}
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
                  Risk: {patient.riskLevel} {patient.riskScore}%
                </span>
              </div>

              <p className="mt-4 text-slate-700">
                <span className="font-semibold text-blue-800">Reason:</span>{" "}
                {patient.reason}
              </p>
              <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${patient.progressColor}`}
                  style={{ width: `${patient.riskScore}%` }}
                  aria-label={`${patient.riskScore} percent risk`}
                />
              </div>
            </article>
          ))}

          <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-blue-900">Recent Activity</h3>
            <ul className="mt-4 space-y-3">
              {recentActivity.map((item, index) => (
                <li
                  key={`${item.text}-${item.time}`}
                  className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${activityDotColors[index]}`}
                      aria-hidden
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{item.text}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.time}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <aside className="h-full rounded-2xl border border-blue-100 bg-white p-5 shadow-lg">
          <h3 className="text-lg font-semibold text-blue-900">Notifications</h3>
          <ul className="mt-4 space-y-3">
            {notifications.map((item) => (
              <li
                key={item.text}
                className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-3"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.dotColor}`}
                    aria-hidden
                  />
                  <div>
                    <p className="text-sm text-blue-900">{item.text}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.time}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </main>
  );
}
