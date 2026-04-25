"use client";

import PatientDashboardPanels from "@/components/patient/PatientDashboardPanels";
import RoleGate from "@/components/auth/RoleGate";

export default function PatientDashboardPage() {
  return (
    <RoleGate allowedRoles={["patient"]}>
      <div className="min-h-screen bg-gradient-to-br from-[#1e3a8a] to-[#1e40af] px-4 py-8 sm:px-6">
        <PatientDashboardPanels />
      </div>
    </RoleGate>
  );
}
