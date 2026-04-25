const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

function parsePrescriptionText(text = "") {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [
      { name: "Metoprolol", dose: "5mg", schedule: "Take in the morning with food", dueTime: "8:00 AM" },
      { name: "Atorvastatin", dose: "20mg", schedule: "Take at night", dueTime: "9:00 PM" },
    ];
  }

  return lines.map((line, index) => {
    const [name = "Medication", dose = "10mg", schedule = "Take once daily"] = line.split("|");
    const defaultTimes = ["8:00 AM", "12:00 PM", "9:00 PM"];
    return {
      name: name.trim(),
      dose: dose.trim(),
      schedule: schedule.trim(),
      dueTime: defaultTimes[index % defaultTimes.length],
    };
  });
}

router.post("/extract", requireAuth, requireRole("doctor"), (req, res) => {
  const { patientId, prescriptionText = "" } = req.body || {};
  if (!patientId) return res.status(400).json({ message: "patientId is required" });

  const reminders = parsePrescriptionText(prescriptionText);
  const patients = req.app.locals.mockStore?.patients || [];
  const patient = patients.find((item) => item.id === String(patientId));
  if (!patient) return res.status(404).json({ message: "Patient not found" });

  patient.reminders = reminders;

  return res.status(201).json({
    patientId,
    extracted: reminders,
    confirmation: "Prescription parsed and medication reminders created.",
  });
});

module.exports = router;
