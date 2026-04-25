import Link from "next/link";

export default function Home() {
  return (
    <div className="page-fade relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-slate-950 px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-10 top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute left-1/4 top-1/3 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute right-20 top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-16 right-1/4 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center">
        <h1
          className="mt-4 text-center text-7xl font-extrabold tracking-tight text-white sm:text-8xl lg:text-9xl"
          style={{ textShadow: "0 0 22px rgba(255, 255, 255, 0.35)" }}
        >
          DischargeIQ
        </h1>
        <p className="mt-5 text-center text-lg text-blue-100 sm:text-xl">
          AI-powered care that follows you home
        </p>

        <div className="mt-16 grid w-full gap-6 md:grid-cols-2">
          <Link
            href="/doctor-login"
            className="group flex min-h-[220px] flex-col justify-between rounded-3xl border border-white/25 bg-[#16335a]/55 p-8 text-white shadow-xl backdrop-blur-md transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_rgba(30,64,175,0.45)]"
          >
            <div>
              <h2 className="text-3xl font-extrabold tracking-wide">Doctor Portal</h2>
              <p className="mt-3 max-w-sm text-sm font-medium leading-relaxed text-slate-200">
                Monitor patient risk, prioritize alerts, and make rapid clinical decisions.
              </p>
            </div>
            <div className="mt-6 flex justify-end text-white">
              <span className="text-2xl font-semibold transition group-hover:translate-x-1">→</span>
            </div>
          </Link>

          <Link
            href="/patient-login"
            className="group flex min-h-[220px] flex-col justify-between rounded-3xl border border-emerald-700 bg-[#059669] p-8 text-white shadow-xl transition duration-300 hover:-translate-y-1.5 hover:bg-[#047857] hover:shadow-2xl"
          >
            <div>
              <h2 className="text-3xl font-extrabold tracking-wide">Patient Portal</h2>
              <p className="mt-3 max-w-sm text-sm font-medium leading-relaxed text-emerald-50">
                Follow your recovery plan, stay on track with medications, and get support.
              </p>
            </div>
            <div className="mt-6 flex justify-end text-white">
              <span className="text-2xl font-semibold transition group-hover:translate-x-1">→</span>
            </div>
          </Link>
        </div>
      </main>

      <footer className="relative z-10 mt-8 text-center text-sm text-blue-100/90">
        DischargeIQ 2026 - Reducing readmissions with AI
      </footer>
    </div>
  );
}
