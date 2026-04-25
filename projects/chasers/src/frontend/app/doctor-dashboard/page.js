"use client";

import DoctorDashboardPanels from "@/components/doctor/DoctorDashboardPanels";
import RoleGate from "@/components/auth/RoleGate";

export default function DoctorDashboardPage() {
  return (
    <RoleGate allowedRoles={["doctor"]}>
      <div className="min-h-screen bg-gradient-to-br from-[#1e3a8a] to-[#1e40af] px-4 py-8 sm:px-6">
        <DoctorDashboardPanels />
      </div>
    </RoleGate>
  );
}
