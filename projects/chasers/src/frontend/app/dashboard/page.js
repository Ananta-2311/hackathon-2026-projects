import DoctorDashboardPanels from "@/components/doctor/DoctorDashboardPanels";

export default function DashboardPage() {
  return (
    <div className="min-h-screen px-6 py-10">
      <DoctorDashboardPanels showLogout={false} />
    </div>
  );
}
