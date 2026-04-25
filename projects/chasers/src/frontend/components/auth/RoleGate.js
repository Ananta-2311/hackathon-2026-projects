"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export default function RoleGate({ allowedRoles, children }) {
  const router = useRouter();
  const { loading, session, profile } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (!profile || !allowedRoles.includes(profile.role)) {
      const fallback = profile?.role === "doctor" ? "/doctor-dashboard" : "/patient-dashboard";
      router.replace(fallback);
    }
  }, [loading, session, profile, allowedRoles, router]);

  if (loading || !session || !profile || !allowedRoles.includes(profile.role)) {
    return <div className="p-6 text-sm text-slate-600">Checking access...</div>;
  }

  return children;
}
