"use client";

import PatientInstructionsView from "@/components/patient/PatientInstructionsView";
import RoleGate from "@/components/auth/RoleGate";

export default function PatientPage() {
  return (
    <RoleGate allowedRoles={["patient"]}>
      <div className="min-h-screen px-6 py-10">
        <PatientInstructionsView />
      </div>
    </RoleGate>
  );
}
