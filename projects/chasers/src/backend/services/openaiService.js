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

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "You simplify medical discharge instructions for patients at roughly a 6th grade reading level. Keep safety-critical details.",
      },
      {
        role: "user",
        content: `Language: ${language}\n\nOriginal instructions:\n${originalInstructions}\n\nReturn only the simplified instructions.`,
      },
    ],
  });

  return response.output_text?.trim() || null;
}

function fallbackSimplify(originalInstructions, language = "en") {
  if (!originalInstructions) return "Please take your medicines, rest, drink water, and call your doctor if symptoms get worse.";

  if (language === "es") {
    return "Toma tus medicinas a tiempo, descansa, toma agua y llama a tu doctor si te sientes peor.";
  }

  return "Take your medicines on time, rest, drink water, and call your doctor if you feel worse.";
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
