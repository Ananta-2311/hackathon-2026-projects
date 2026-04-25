"use client";

import { useState } from "react";
import { useEffect } from "react";
import { simplifyInstructions } from "@/lib/api";

const instructionsByLanguage = {
  en: [
    {
      text: "Take your blood pressure medication every morning after breakfast.",
    },
    {
      text: "Drink at least 6-8 glasses of water unless your doctor advised fluid restriction.",
    },
    {
      text: "Walk for 15-20 minutes daily and avoid heavy lifting for one week.",
    },
    {
      text: "Schedule your follow-up visit within 3 days of discharge.",
    },
    {
      text: "Call your care team if you notice swelling, dizziness, or worsening shortness of breath.",
    },
  ],
  es: [
    {
      text: "Toma tu medicamento para la presion arterial cada manana despues del desayuno.",
    },
    {
      text: "Bebe de 6 a 8 vasos de agua al dia, a menos que tu medico haya recomendado restriccion de liquidos.",
    },
    {
      text: "Camina de 15 a 20 minutos al dia y evita levantar objetos pesados durante una semana.",
    },
    {
      text: "Programa tu cita de seguimiento dentro de los 3 dias despues del alta.",
    },
    {
      text: "Llama a tu equipo medico si notas hinchazon, mareo o falta de aire que empeora.",
    },
  ],
};

export default function PatientInstructionsView() {
  const [language, setLanguage] = useState("en");
  const [translatedInstructions, setTranslatedInstructions] = useState(
    instructionsByLanguage.en
  );

  useEffect(() => {
    let ignore = false;

    async function loadSimplifiedInstructions() {
      const baseText = instructionsByLanguage[language]
        .map((item, index) => `${index + 1}. ${item.text}`)
        .join("\n");

      try {
        const response = await simplifyInstructions({
          originalInstructions: baseText,
          language,
        });

        const lines = String(response.simplifiedInstructions || "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

        if (!ignore && lines.length > 0) {
          const mapped = lines.map((line, index) => ({
            emoji: instructionsByLanguage[language][index % instructionsByLanguage[language].length].emoji,
            text: line.replace(/^\d+[\).\s-]*/, ""),
          }));
          setTranslatedInstructions(mapped);
          return;
        }
      } catch (error) {
        // Keep local mock instructions when backend is unavailable.
      }

      if (!ignore) {
        setTranslatedInstructions(instructionsByLanguage[language]);
      }
    }

    loadSimplifiedInstructions();

    return () => {
      ignore = true;
    };
  }, [language]);

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
            <p className="mt-1 text-slate-700">{instruction.text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
