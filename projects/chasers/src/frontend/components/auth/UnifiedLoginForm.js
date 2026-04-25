"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPassword } from "@/lib/auth";
import { getCurrentUserProfile } from "@/lib/api";

export default function UnifiedLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await signInWithPassword({ email, password });
      const me = await getCurrentUserProfile();
      const role = me?.profile?.role;
      if (role === "doctor") {
        router.push("/doctor-dashboard");
        return;
      }
      if (role === "patient") {
        router.push("/patient-dashboard");
        return;
      }
      setError("No valid role found for this account.");
    } catch (err) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <main className="w-full max-w-md rounded-2xl border border-blue-100 bg-white p-8 shadow-lg">
        <h1 className="text-center text-2xl font-bold text-blue-900">Sign in to DischargeIQ</h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Uses Supabase Auth. Doctors and patients are redirected by role.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-blue-200 px-4 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              placeholder="your email"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-xl border border-blue-200 px-4 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              placeholder="your password"
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
      </main>
    </div>
  );
}
