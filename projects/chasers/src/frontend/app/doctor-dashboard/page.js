"use client";

import DoctorDashboardPanels from "@/components/doctor/DoctorDashboardPanels";
import RoleGate from "@/components/auth/RoleGate";

export default function DoctorDashboardPage() {
  return (
    <RoleGate allowedRoles={["doctor"]}>
      <div className="min-h-screen px-6 py-10">
        <DoctorDashboardPanels />
      </div>
    </RoleGate>
  );
}
