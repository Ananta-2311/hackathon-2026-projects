"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PatientLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const allowed = [
      "patient@dischargeiq.com",
      "john@dischargeiq.com",
      "aisha@dischargeiq.com",
    ];

    if (allowed.includes(normalizedEmail) && (password === "patient123" || password === "password123")) {
      setError("");
      if (typeof window !== "undefined") {
        window.localStorage.setItem("demoPatientEmail", normalizedEmail);
      }
      router.push("/patient-dashboard");
      return;
    }

    setError(
      "Invalid credentials. Use patient@dischargeiq.com, john@dischargeiq.com, or aisha@dischargeiq.com with patient123."
    );
  };

  return (
    <div className="page-fade flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 sm:px-6">
      <main className="w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-8 shadow-sm">
        <h1 className="mt-1 text-center text-3xl font-bold text-emerald-700">
          ❤️ Patient Portal
        </h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Sign in to view your recovery plan.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="patient-email"
              className="text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="patient-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-emerald-200 px-4 py-2.5 text-sm outline-none ring-emerald-500 focus:ring-2"
              placeholder="patient@dischargeiq.com"
              required
            />
          </div>
          <div>
            <label
              htmlFor="patient-password"
              className="text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="patient-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-xl border border-emerald-200 px-4 py-2.5 text-sm outline-none ring-emerald-500 focus:ring-2"
              placeholder="patient123"
              required
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-emerald-700"
          >
            Sign In
          </button>
        </form>

        <Link href="/" className="mt-4 block text-center text-sm text-emerald-700 hover:underline">
          Back to home
        </Link>
      </main>
    </div>
  );
}
