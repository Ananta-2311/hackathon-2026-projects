const request = require("supertest");
const { createApp } = require("../server");

describe("backend API", () => {
  const app = createApp();
  const asDoctor = { "x-test-role": "doctor" };
  const asPatient = { "x-test-role": "patient" };

  test("GET /api/health returns running status", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  test("GET /api/patients returns patient list", async () => {
    const response = await request(app).get("/api/patients").set(asDoctor);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body[0]).toHaveProperty("id");
    expect(response.body[0]).toHaveProperty("riskScore");
  });

  test("GET /api/patients/:id returns details", async () => {
    const response = await request(app).get("/api/patients/1").set(asDoctor);
    expect(response.status).toBe(200);
    expect(response.body.id).toBe("1");
    expect(response.body).toHaveProperty("medications");
  });

  test("POST /api/risk/predict returns prediction payload", async () => {
    const response = await request(app).post("/api/risk/predict").set(asDoctor).send({
      age: 74,
      diagnosisCount: 3,
      medicationCount: 6,
      previousAdmissions: 1,
      lengthOfStay: 8,
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("riskScore");
    expect(["Low", "Medium", "High"]).toContain(response.body.riskLevel);
    expect(Array.isArray(response.body.reasons)).toBe(true);
  });

  test("POST /api/instructions/simplify returns fallback text", async () => {
    const response = await request(app).post("/api/instructions/simplify").set(asDoctor).send({
      originalInstructions: "Take medications twice daily.",
      language: "en",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("simplifiedInstructions");
    expect(response.body.language).toBe("en");
  });

  test("POST /api/chat creates alert for red-flag symptom", async () => {
    const response = await request(app)
      .post("/api/chat")
      .set(asPatient)
      .send({ message: "I have chest pain" });

    expect(response.status).toBe(200);
    expect(response.body.alertCreated).toBe(true);
    expect(response.body.alert).not.toBeNull();
  });

  test("GET /api/alerts returns created alerts", async () => {
    const response = await request(app).get("/api/alerts").set(asDoctor);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });
});
