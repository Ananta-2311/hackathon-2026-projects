"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DoctorLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    if (email === "doctor@dischargeiq.com" && password === "doctor123") {
      setError("");
      router.push("/doctor-dashboard");
      return;
    }

    setError("Invalid credentials. Try doctor@dischargeiq.com / doctor123.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <main className="w-full max-w-md rounded-2xl border border-blue-100 bg-white p-8 shadow-lg">
        <p className="text-center text-3xl">🩺</p>
        <h1 className="mt-3 text-center text-2xl font-bold text-blue-900">
          Doctor Portal
        </h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Sign in to access patient risk monitoring.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="doctor-email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="doctor-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-blue-200 px-4 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              placeholder="doctor@dischargeiq.com"
              required
            />
          </div>
          <div>
            <label
              htmlFor="doctor-password"
              className="text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="doctor-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-xl border border-blue-200 px-4 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              placeholder="doctor123"
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
            className="w-full rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white transition hover:bg-blue-800"
          >
            Sign In
          </button>
        </form>

        <Link href="/" className="mt-4 block text-center text-sm text-blue-700 hover:underline">
          Back to home
        </Link>
      </main>
    </div>
  );
}
