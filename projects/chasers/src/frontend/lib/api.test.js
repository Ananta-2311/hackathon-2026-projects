import { describe, expect, test, vi, beforeEach } from "vitest";
import {
  getPatients,
  getPatientById,
  predictRisk,
  simplifyInstructions,
  sendChatMessage,
  getAlerts,
} from "./api";

describe("frontend api helper", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("getPatients calls patients endpoint", async () => {
    const mockResponse = [{ id: "1" }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await getPatients();
    expect(result).toEqual([expect.objectContaining({ id: "1" })]);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:5001/api/patients",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-user-role": "doctor",
          "x-user-id": "doctor-1",
        }),
        cache: "no-store",
      })
    );
  });

  test("predictRisk posts payload", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ riskLevel: "High" }),
    });

    const payload = { age: 75 };
    await predictRisk(payload);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:5001/api/risk/predict",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  });

  test("all helper functions resolve", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await getPatientById("1");
    await simplifyInstructions({ originalInstructions: "abc", language: "en" });
    await sendChatMessage({ patientId: "1", message: "hello" });
    await getAlerts();

    expect(global.fetch).toHaveBeenCalledTimes(4);
  });
});
