"use client";

import { useState } from "react";
import Link from "next/link";

const initialMessages = [
  {
    id: 1,
    role: "bot",
    text: "Hi Maria, I am your DischargeIQ assistant. How are you feeling right now?",
    time: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  },
];

const emergencyKeywords = ["chest pain", "can't breathe", "dizzy"];

const getTime = () =>
  new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function ChatPage() {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [showEmergencyAlert, setShowEmergencyAlert] = useState(false);

  const handleSend = (event) => {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;

    const normalizedText = value.toLowerCase();
    const isEmergency = emergencyKeywords.some((keyword) =>
      normalizedText.includes(keyword)
    );

    const patientMessage = {
      id: Date.now(),
      role: "patient",
      text: value,
      time: getTime(),
    };

    const botMessage = {
      id: Date.now() + 1,
      role: "bot",
      text: isEmergency
        ? "I detected urgent symptoms and alerted Dr. Smith. If symptoms are severe, call emergency services now."
        : "Thanks for sharing, Maria. Keep resting, stay hydrated, and take your medications on schedule.",
      time: getTime(),
    };

    setMessages((prev) => [...prev, patientMessage, botMessage]);
    setShowEmergencyAlert(isEmergency);
    setInput("");
  };

  return (
    <div className="min-h-screen px-6 py-10">
      <main className="mx-auto flex w-full max-w-4xl flex-col rounded-2xl border border-blue-100 bg-white shadow-sm">
        <header className="border-b border-blue-100 px-6 py-5">
          <h1 className="text-2xl font-bold text-blue-900">Patient Chat</h1>
          <p className="mt-1 text-sm text-slate-600">
            Share how you feel after discharge
          </p>
        </header>

        {showEmergencyAlert ? (
          <div className="mx-6 mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            🚨 Emergency! Alerting Dr. Smith now...
          </div>
        ) : null}

        <section className="flex-1 space-y-3 px-6 py-5">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "patient" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                  message.role === "patient"
                    ? "bg-blue-700 text-white"
                    : "bg-blue-50 text-blue-900"
                }`}
              >
                <p>{message.text}</p>
                <p
                  className={`mt-2 text-[11px] ${
                    message.role === "patient"
                      ? "text-blue-100"
                      : "text-blue-700/70"
                  }`}
                >
                  {message.time}
                </p>
              </div>
            </div>
          ))}
        </section>

        <form
          onSubmit={handleSend}
          className="flex gap-3 border-t border-blue-100 px-6 py-4"
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type how you feel..."
            className="flex-1 rounded-xl border border-blue-200 px-4 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
          <button
            type="submit"
            className="rounded-xl bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            Send
          </button>
        </form>
        <div className="px-6 pb-4">
          <Link href="/patient-dashboard" className="text-sm text-blue-700 hover:underline">
            Back to Patient Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
