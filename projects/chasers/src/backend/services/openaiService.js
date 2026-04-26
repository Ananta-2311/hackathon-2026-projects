const OpenAI = require("openai");

let client = null;

function getApiKey() {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

function hasOpenAIKey() {
  return Boolean(getApiKey());
}

function getClient() {
  if (!hasOpenAIKey()) return null;
  if (!client) {
    client = new OpenAI({ apiKey: getApiKey() });
  }
  return client;
}

async function simplifyInstructionsWithAI(originalInstructions, language = "en") {
  const openai = getClient();
  if (!openai) return null;

  try {
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You simplify medical discharge instructions for patients at roughly a 6th grade reading level. Keep safety-critical details, medicine timing, warning signs, and follow-up steps.",
        },
        {
          role: "user",
          content: `Language: ${language}\n\nOriginal instructions:\n${originalInstructions}\n\nReturn only the simplified instructions.`,
        },
      ],
    });

    return response.output_text?.trim() || null;
  } catch (_error) {
    return null;
  }
}

function toSimpleSentence(text = "") {
  return String(text)
    .replace(/\badminister\b/gi, "give")
    .replace(/\bdiscontinue\b/gi, "stop")
    .replace(/\bmonitor\b/gi, "watch for")
    .replace(/\bdyspnea\b/gi, "trouble breathing")
    .replace(/\bPRN\b/g, "as needed")
    .replace(/\bsodium\b/gi, "salt")
    .replace(/\bedema\b/gi, "swelling")
    .replace(/\bhypertension\b/gi, "high blood pressure")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackSimplify(originalInstructions, language = "en") {
  const raw = String(originalInstructions || "").trim();
  if (!raw) {
    return "Take your medicines on time, rest, drink water, and call your doctor if you feel worse.";
  }

  if (language === "es") {
    return "Sigue estas instrucciones: toma tus medicinas a tiempo, descansa, toma agua y llama a tu doctor si te sientes peor.";
  }

  const parts = raw
    .split(/\n|[.;](?:\s+|$)/)
    .map((part) => toSimpleSentence(part))
    .filter(Boolean)
    .slice(0, 6);

  if (!parts.length) {
    return "Take your medicines on time, rest, drink water, and call your doctor if you feel worse.";
  }

  const numbered = parts.map((part, index) => `${index + 1}. ${part}`).join(" ");
  return `Follow these steps: ${numbered}`;
}

async function generateChatReplyWithAI({
  message = "",
  age = null,
  patientName = "",
  recentMessages = [],
  emergency = false,
}) {
  const openai = getClient();
  if (!openai) return null;

  const systemPrompt = emergency
    ? "You are a cautious post-discharge assistant. If emergency symptoms are present, tell the patient clearly to call 911/ER immediately, in short plain language."
    : "You are a compassionate post-discharge assistant. Use plain language for all ages. Keep reply under 80 words. Give practical next steps and safety advice.";

  const contextLines = recentMessages
    .slice(-8)
    .map((item) => `${item.sender || item.role || "user"}: ${item.message || ""}`)
    .join("\n");

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Patient name: ${patientName || "patient"}\nPatient age: ${age ?? "unknown"}\nEmergency red flag detected: ${
          emergency ? "yes" : "no"
        }\nRecent chat context:\n${contextLines || "none"}\n\nLatest patient message:\n${message}\n\nNever assume a different patient name than provided.`,
      },
    ],
  });

  return response.output_text?.trim() || null;
}

module.exports = {
  hasOpenAIKey,
  simplifyInstructionsWithAI,
  generateChatReplyWithAI,
  fallbackSimplify,
};
