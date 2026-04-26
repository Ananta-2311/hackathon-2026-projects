"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPatientDashboardData, sendChatMessage } from "@/lib/api";

const getTime = () =>
  new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showEmergencyAlert, setShowEmergencyAlert] = useState(false);
  const handleEmergencyCall = () => {
    if (typeof window !== "undefined") {
      window.location.href = "tel:911";
    }
  };

  const [isBotTyping, setIsBotTyping] = useState(false);
  const [patientId, setPatientId] = useState("");

  useEffect(() => {
    getPatientDashboardData()
      .then((data) => setPatientId(data?.patient?.id || ""))
      .catch(() => setPatientId(""));
  }, []);

  useEffect(() => {
    setMessages([
      {
        id: 1,
        role: "bot",
        text: "Hi Maria, I am your DischargeIQ assistant. How are you feeling today?",
        time: getTime(),
      },
    ]);
  }, []);

  const handleSend = async (event) => {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;

    const patientMessage = {
      id: Date.now(),
      role: "patient",
      text: value,
      time: getTime(),
    };

    setMessages((prev) => [...prev, patientMessage]);
    setIsBotTyping(true);
    setInput("");

    let botText = "I could not generate a response right now.";
    try {
      const response = await sendChatMessage({ patient_id: patientId, message: value });
      botText = response.reply || botText;
      setShowEmergencyAlert(Boolean((response.alerts_created || 0) > 0));
    } catch (_error) {
      await new Promise((resolve) => {
        setTimeout(resolve, 700);
      });
    }

    const botMessage = {
      id: Date.now() + 1,
      role: "bot",
      text: botText,
      time: getTime(),
    };

    setMessages((prev) => [...prev, botMessage]);
    setIsBotTyping(false);
  };

  return (
    <div className="page-fade flex min-h-screen bg-slate-100 px-3 py-4 sm:px-6 sm:py-8">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col rounded-2xl border border-blue-100 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-blue-100 px-5 py-4 sm:px-6">
          <h1 className="text-xl font-bold text-blue-900 sm:text-2xl">AI Health Assistant</h1>
          <Link
            href="/patient-dashboard"
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-900 transition hover:bg-blue-100"
          >
            Back
          </Link>
        </header>

        {showEmergencyAlert ? (
          <div className="mx-5 mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 sm:mx-6">
            <p className="animate-pulse">🚨 Emergency detected! Alerting Dr. Smith now...</p>
            <button
              type="button"
              onClick={handleEmergencyCall}
              className="mt-3 rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white hover:bg-red-800"
            >
              Call 911 Now
            </button>
          </div>
        ) : null}

        <section className="flex-1 space-y-3 overflow-y-auto px-5 py-5 sm:px-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "patient" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm sm:max-w-[75%] ${
                  message.role === "patient"
                    ? "bg-blue-800 text-white"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                <p>{message.text}</p>
                <p
                  className={`mt-2 text-[11px] ${
                    message.role === "patient"
                      ? "text-blue-100"
                      : "text-slate-500"
                  }`}
                >
                  {message.time}
                </p>
              </div>
            </div>
          ))}

          {isBotTyping ? (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-slate-100 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.2s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.1s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500" />
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <p className="border-t border-blue-100 px-5 py-3 text-xs text-slate-500 sm:px-6">
          This AI does not replace medical advice. In emergencies call 911.
        </p>

        <form
          onSubmit={handleSend}
          className="flex gap-3 border-t border-blue-100 px-5 py-4 sm:px-6"
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type how you feel..."
            className="flex-1 rounded-xl border border-blue-200 px-4 py-2.5 text-sm outline-none ring-blue-500 focus:ring-2"
          />
          <button
            type="submit"
            className="rounded-xl bg-blue-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-900"
          >
            Send
          </button>
        </form>
      </main>
    </div>
  );
}
