const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const patientsRoute = require("./routes/patients");
const riskRoute = require("./routes/risk");
const instructionsRoute = require("./routes/instructions");
const chatRoute = require("./routes/chat");
const alertsRoute = require("./routes/alerts");
const authRoute = require("./routes/auth");
const prescriptionsRoute = require("./routes/prescriptions");
const { mockPatients } = require("./data/mockPatients");

function createApp() {
  const app = express();
  const isProduction = process.env.NODE_ENV === "production";
  const allowedOrigins = (process.env.CORS_ORIGIN ||
    "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const localDevOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        if (!isProduction && localDevOriginPattern.test(origin)) {
          return callback(null, true);
        }

        return callback(new Error(`Not allowed by CORS: ${origin}`));
      },
    })
  );
  app.use(express.json());
  app.locals.mockStore = {
    patients: mockPatients.map((patient) => ({ ...patient })),
    alerts: [],
    chats: {},
  };

  app.get("/", (req, res) => {
    res.json({
      name: "DischargeIQ Backend API",
      message: "Backend is running. Use /api/health to check status.",
      health: "/api/health",
    });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "DischargeIQ backend running" });
  });

  app.use("/api/patients", patientsRoute);
  app.use("/api/risk", riskRoute);
  app.use("/api/instructions", instructionsRoute);
  app.use("/api/chat", chatRoute);
  app.use("/api/alerts", alertsRoute);
  app.use("/api/auth", authRoute);
  app.use("/api/prescriptions", prescriptionsRoute);

  return app;
}

if (require.main === module) {
  const PORT = process.env.PORT || 5001;
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`DischargeIQ backend listening on http://localhost:${PORT}`);
  });
}

module.exports = { createApp };
