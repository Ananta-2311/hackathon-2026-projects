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

function predictRisk(input) {
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
  };
}

module.exports = { predictRisk };
