"use client";

import { useState } from "react";

const instructionsByLanguage = {
  en: [
    {
      emoji: "💊",
      text: "Take your blood pressure medication every morning after breakfast.",
    },
    {
      emoji: "💧",
      text: "Drink at least 6-8 glasses of water unless your doctor advised fluid restriction.",
    },
    {
      emoji: "🚶",
      text: "Walk for 15-20 minutes daily and avoid heavy lifting for one week.",
    },
    {
      emoji: "📅",
      text: "Schedule your follow-up visit within 3 days of discharge.",
    },
    {
      emoji: "📞",
      text: "Call your care team if you notice swelling, dizziness, or worsening shortness of breath.",
    },
  ],
  es: [
    {
      emoji: "💊",
      text: "Toma tu medicamento para la presion arterial cada manana despues del desayuno.",
    },
    {
      emoji: "💧",
      text: "Bebe de 6 a 8 vasos de agua al dia, a menos que tu medico haya recomendado restriccion de liquidos.",
    },
    {
      emoji: "🚶",
      text: "Camina de 15 a 20 minutos al dia y evita levantar objetos pesados durante una semana.",
    },
    {
      emoji: "📅",
      text: "Programa tu cita de seguimiento dentro de los 3 dias despues del alta.",
    },
    {
      emoji: "📞",
      text: "Llama a tu equipo medico si notas hinchazon, mareo o falta de aire que empeora.",
    },
  ],
};

export default function PatientInstructionsView() {
  const [language, setLanguage] = useState("en");
  const translatedInstructions = instructionsByLanguage[language];

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-blue-900">Patient View</h1>
          <p className="mt-2 text-slate-600">Hi Maria, here is what to do at home</p>
        </div>
        <button
          type="button"
          onClick={() => setLanguage((prev) => (prev === "en" ? "es" : "en"))}
          className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-100"
        >
          {language === "en" ? "Español" : "English"}
        </button>
      </header>

      <section className="space-y-4">
        {translatedInstructions.map((instruction, index) => (
          <article
            key={instruction.text}
            className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"
          >
            <p className="font-semibold text-blue-800">Instruction {index + 1}</p>
            <p className="mt-1 text-slate-700">
              <span className="mr-2 text-xl" role="img" aria-label="instruction icon">
                {instruction.emoji}
              </span>
              {instruction.text}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
