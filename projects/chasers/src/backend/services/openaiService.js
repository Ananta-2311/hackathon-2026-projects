const OpenAI = require("openai");

let client = null;

function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function getClient() {
  if (!hasOpenAIKey()) return null;
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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

module.exports = {
  hasOpenAIKey,
  simplifyInstructionsWithAI,
  fallbackSimplify,
};
