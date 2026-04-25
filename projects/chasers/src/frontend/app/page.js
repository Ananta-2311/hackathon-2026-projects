import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <main className="w-full max-w-4xl rounded-3xl border border-blue-100 bg-white p-8 text-center shadow-lg md:p-12">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-3xl">
          🏥
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-blue-900 md:text-5xl">
          DischargeIQ
        </h1>
        <p className="mt-3 text-lg font-medium text-blue-800">
          Preventing readmissions before they happen
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">Sign in to continue.</p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Link
            href="/login"
            className="rounded-2xl border border-blue-200 bg-blue-600 px-6 py-8 text-xl font-semibold text-white transition hover:bg-blue-700"
          >
            Go to Login
          </Link>
          <Link
            href="/doctor-login"
            className="rounded-2xl border border-blue-200 bg-blue-50 px-6 py-8 text-xl font-semibold text-blue-900 transition hover:bg-blue-100"
          >
            Doctor-only Login
          </Link>
        </div>
      </main>
    </div>
  );
}
