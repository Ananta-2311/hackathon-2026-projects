const { predictRisk } = require("../services/riskService");

describe("riskService", () => {
  test("returns high risk for severe profile", () => {
    const result = predictRisk({
      age: 78,
      diagnosisCount: 4,
      medicationCount: 7,
      previousAdmissions: 2,
      lengthOfStay: 10,
    });

    expect(result.riskLevel).toBe("High");
    expect(result.riskScore).toBeGreaterThanOrEqual(70);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  test("returns low risk for stable profile", () => {
    const result = predictRisk({
      age: 35,
      diagnosisCount: 1,
      medicationCount: 2,
      previousAdmissions: 0,
      lengthOfStay: 2,
    });

    expect(result.riskLevel).toBe("Low");
    expect(result.recommendation).toMatch(/14-day follow-up/i);
  });
});
