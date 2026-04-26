const { spawnSync } = require("child_process");
const path = require("path");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildRecommendation(riskLevel) {
  if (riskLevel === "High") {
    return "Consider extended monitoring, schedule a 3-day follow-up call, and verify caregiver support.";
  }
  if (riskLevel === "Medium") {
    return "Schedule a 7-day follow-up appointment and confirm medication understanding.";
  }
  return "Standard discharge with a 14-day follow-up.";
}

function _normalizeInput(input = {}) {
  return {
    age: Number(input.age || 0),
    gender: Number(input.gender ?? (String(input.gender || "").toLowerCase().startsWith("f") ? 1 : 0)),
    conditions_count: Number(input.conditions_count ?? input.conditionsCount ?? input.diagnosisCount ?? 0),
    medications_count: Number(input.medications_count ?? input.medicationsCount ?? input.medicationCount ?? 0),
    encounters_count: Number(input.encounters_count ?? input.encountersCount ?? input.lengthOfStay ?? 0),
    prior_admissions: Number(input.prior_admissions ?? input.priorAdmissions ?? input.previousAdmissions ?? 0),
  };
}

function predictRiskWithPythonModel(input) {
  const normalized = _normalizeInput(input);
  const mlDir = path.resolve(__dirname, "../../ML");
  const scriptPath = path.join(mlDir, "predict.py");
  const venvPython = path.join(mlDir, ".venv", "bin", "python");
  const pythonExecutable = require("fs").existsSync(venvPython) ? venvPython : "python3";
  const pythonCode = [
    "import json, sys, importlib.util",
    `spec = importlib.util.spec_from_file_location('ml_predict_module', r'''${scriptPath}''')`,
    "module = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(module)",
    "payload = json.loads(sys.argv[1])",
    "result = module.predict(payload)",
    "print(json.dumps(result))",
  ].join("; ");

  const run = spawnSync(pythonExecutable, ["-c", pythonCode, JSON.stringify(normalized)], {
    encoding: "utf-8",
    timeout: 60000,
  });
  if (run.status !== 0) {
    const stderr = (run.stderr || "").trim();
    throw new Error(stderr || "python model execution failed");
  }
  const parsed = JSON.parse((run.stdout || "").trim() || "{}");
  return {
    riskScore: Number(parsed.readmission_probability || 0),
    riskLevel: parsed.risk_level || "Medium",
    reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
    recommendation: buildRecommendation(parsed.risk_level || "Medium"),
    modelSource: "python-ml",
  };
}

function predictRiskHeuristic(input) {
  const {
    age = 0,
    diagnosisCount = 0,
    medicationCount = 0,
    previousAdmissions = 0,
    lengthOfStay = 0,
  } = input || {};

  let score = 10;
  const reasons = [];

  if (age > 70) {
    score += 20;
    reasons.push("Age over 70 increases readmission risk.");
  }
  if (medicationCount > 5) {
    score += 20;
    reasons.push("Complex medication regimen (more than 5 medications).");
  }
  if (previousAdmissions > 0) {
    score += Math.min(previousAdmissions * 12, 24);
    reasons.push("Prior admissions indicate higher risk of readmission.");
  }
  if (lengthOfStay >= 7) {
    score += 15;
    reasons.push("Longer inpatient stay suggests higher clinical complexity.");
  }
  if (diagnosisCount >= 3) {
    score += 15;
    reasons.push("Multiple active diagnoses increase post-discharge risk.");
  }

  const riskScore = clamp(Math.round(score), 0, 100);

  let riskLevel = "Low";
  if (riskScore >= 70) riskLevel = "High";
  else if (riskScore >= 40) riskLevel = "Medium";

  return {
    riskScore,
    riskLevel,
    reasons,
    recommendation: buildRecommendation(riskLevel),
    modelSource: "heuristic-fallback",
  };
}

function predictRisk(input) {
  try {
    return predictRiskWithPythonModel(input);
  } catch (_error) {
    return predictRiskHeuristic(input);
  }
}

module.exports = { predictRisk };
