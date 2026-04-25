"use client";

import PatientDashboardPanels from "@/components/patient/PatientDashboardPanels";
import RoleGate from "@/components/auth/RoleGate";

export default function PatientDashboardPage() {
  return (
    <RoleGate allowedRoles={["patient"]}>
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-sky-50 px-6 py-10">
        <PatientDashboardPanels />
      </div>
    </RoleGate>
  );
}
