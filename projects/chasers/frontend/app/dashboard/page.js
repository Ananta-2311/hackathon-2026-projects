const patients = [
  {
    id: 1,
    name: "Maria Thompson",
    age: 67,
    diagnosis: "Congestive Heart Failure",
    riskLevel: "high",
    riskScore: 87,
    riskReason:
      "Missed medications and recent shortness of breath increase readmission risk.",
    alert: "⚠️ Chest pain reported",
  },
  {
    id: 2,
    name: "James Patel",
    age: 59,
    diagnosis: "Type 2 Diabetes",
    riskLevel: "medium",
    riskScore: 54,
    riskReason:
      "Unstable glucose trend and low follow-up adherence in the last two weeks.",
  },
  {
    id: 3,
    name: "Eleanor Brooks",
    age: 44,
    diagnosis: "Pneumonia Recovery",
    riskLevel: "low",
    riskScore: 26,
    riskReason:
      "Symptoms improving with strong medication adherence and family support.",
  },
];

const badgeStyles = {
  low: "bg-emerald-100 text-emerald-800 border-emerald-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  high: "bg-red-100 text-red-800 border-red-200",
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen px-6 py-10">
      <main className="mx-auto w-full max-w-5xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-blue-900">Doctor Dashboard</h1>
          <p className="mt-2 text-slate-600">
            Real-time post-discharge risk monitoring (mock data)
          </p>
        </header>

        <section className="grid gap-4">
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
                  <h2 className="text-xl font-semibold text-slate-800">
                    {patient.name}
                  </h2>
                  <p className="mt-1 text-slate-600">
                    Age {patient.age} • {patient.diagnosis}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-sm font-semibold capitalize ${badgeStyles[patient.riskLevel]}`}
                >
                  {patient.riskLevel} risk ({patient.riskScore}%)
                </span>
              </div>

              <p className="mt-4 text-slate-700">
                <span className="font-semibold text-blue-800">Risk reason:</span>{" "}
                {patient.riskReason}
              </p>

              <button
                type="button"
                className="mt-5 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                View Details
              </button>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
