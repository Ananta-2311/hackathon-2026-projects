const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { mockPatients } = require("../data/mockPatients");
const { predictRisk } = require("../services/riskService");

const isTest = process.env.NODE_ENV === "test";
const dbFilePath = process.env.LOCAL_SQLITE_PATH || path.resolve(__dirname, "../local/dischargeiq.local.db");
const fhirDataPath = path.resolve(__dirname, "../../ML/data/fhir");

let db = null;

function shouldUseLocalSql() {
  return !isTest;
}

function getDb() {
  if (!shouldUseLocalSql()) return null;
  if (db) return db;

  const parentDir = path.dirname(dbFilePath);
  if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
  db = new Database(dbFilePath);
  db.pragma("journal_mode = WAL");
  initializeSchema(db);
  seedPatientsIfEmpty(db);
  syncPatientsFromFhir(db, 50);
  return db;
}

function initializeSchema(database) {
  database.exec(`
    create table if not exists patients (
      id text primary key,
      profile_id text,
      name text,
      age integer,
      gender text,
      diagnosis text,
      conditions_count integer,
      medications_count integer,
      encounters_count integer,
      prior_admissions integer,
      doctor text,
      risk_score real,
      risk_level text,
      prediction_percentage real,
      risk_reasons text,
      follow_up_suggestion text,
      created_at text default (datetime('now'))
    );

    create table if not exists discharge_notes (
      id text primary key,
      patient_id text not null,
      original_note text,
      simplified_note text,
      language text default 'English',
      created_at text default (datetime('now')),
      foreign key(patient_id) references patients(id)
    );
  `);

  const migrations = [
    "alter table patients add column gender text",
    "alter table patients add column conditions_count integer",
    "alter table patients add column medications_count integer",
    "alter table patients add column encounters_count integer",
    "alter table patients add column prior_admissions integer",
    "alter table patients add column risk_reasons text",
    "alter table patients add column follow_up_suggestion text",
  ];
  migrations.forEach((sql) => {
    try {
      database.exec(sql);
    } catch (_error) {
      // Ignore duplicate-column failures for idempotent startup.
    }
  });
}

function seedPatientsIfEmpty(database) {
  const countRow = database.prepare("select count(*) as count from patients").get();
  if ((countRow?.count || 0) > 0) return;

  const insert = database.prepare(`
    insert into patients (
      id, profile_id, name, age, gender, diagnosis,
      conditions_count, medications_count, encounters_count, prior_admissions,
      doctor, risk_score, risk_level, prediction_percentage, risk_reasons, follow_up_suggestion, created_at
    )
    values (
      @id, @profile_id, @name, @age, @gender, @diagnosis,
      @conditions_count, @medications_count, @encounters_count, @prior_admissions,
      @doctor, @risk_score, @risk_level, @prediction_percentage, @risk_reasons, @follow_up_suggestion, @created_at
    )
  `);

  const nowIso = new Date().toISOString();
  const seedRows = mockPatients.map((patient, index) => ({
    id: String(patient.id),
    profile_id: `patient-${index + 1}`,
    name: patient.name || "",
    age: Number(patient.age || 0),
    gender: patient.gender || "female",
    diagnosis: patient.diagnosis || "",
    conditions_count: Number(patient.diagnosisCount || 0),
    medications_count: Number(patient.medicationCount || 0),
    encounters_count: Number(patient.lengthOfStay || 0),
    prior_admissions: Number(patient.previousAdmissions || 0),
    doctor: patient.doctorName || "Dr. Smith",
    risk_score: Number(patient.riskScore || 0),
    risk_level: patient.riskLevel || "Medium",
    prediction_percentage: Number(patient.riskScore || 0),
    risk_reasons: JSON.stringify(patient.riskReasons || []),
    follow_up_suggestion: patient.followUpSuggestion || "",
    created_at: nowIso,
  }));

  const transaction = database.transaction((rows) => rows.forEach((row) => insert.run(row)));
  transaction(seedRows);
}

function calculateAge(birthDate) {
  if (!birthDate) return 60;
  try {
    const year = Number(String(birthDate).split("-")[0]);
    const currentYear = new Date().getFullYear();
    if (!Number.isFinite(year) || year < 1900) return 60;
    return Math.max(0, currentYear - year);
  } catch (_error) {
    return 60;
  }
}

function normalizePatientName(resource = {}) {
  const name = Array.isArray(resource.name) ? resource.name[0] : null;
  if (!name) return "Patient";
  const given = Array.isArray(name.given) ? name.given.join(" ") : "";
  const family = name.family || "";
  return `${given} ${family}`.trim() || "Patient";
}

function extractFhirPatientSummary(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  const entries = Array.isArray(data?.entry) ? data.entry : [];

  let patientResource = null;
  let conditionsCount = 0;
  let medicationsCount = 0;
  let encountersCount = 0;
  let diagnosis = "";
  let doctor = "";

  for (const entry of entries) {
    const resource = entry?.resource || {};
    const type = resource.resourceType;
    if (type === "Patient") {
      patientResource = resource;
      continue;
    }
    if (type === "Condition") {
      conditionsCount += 1;
      if (!diagnosis) {
        diagnosis =
          resource?.code?.text ||
          resource?.code?.coding?.[0]?.display ||
          resource?.code?.coding?.[0]?.code ||
          "";
      }
      continue;
    }
    if (type === "MedicationRequest") {
      medicationsCount += 1;
      continue;
    }
    if (type === "Encounter") {
      encountersCount += 1;
      if (!doctor) {
        doctor = resource?.participant?.[0]?.individual?.display || "";
      }
    }
  }

  if (!patientResource) return null;

  const age = calculateAge(patientResource.birthDate);
  const genderRaw = String(patientResource.gender || "").toLowerCase();
  const gender = genderRaw === "female" ? 1 : 0;
  const priorAdmissions = Math.max(0, encountersCount - 1);
  const features = {
    age,
    gender,
    conditions_count: conditionsCount,
    medications_count: medicationsCount,
    encounters_count: encountersCount,
    prior_admissions: priorAdmissions,
  };
  const prediction = predictRisk(features);

  return {
    id: `fhir-${patientResource.id || path.basename(filePath, ".json")}`,
    profile_id: `fhir-${patientResource.id || path.basename(filePath, ".json")}`,
    name: normalizePatientName(patientResource),
    age,
    gender: gender === 1 ? "female" : "male",
    diagnosis: diagnosis || "General Medical Follow-up",
    conditions_count: conditionsCount,
    medications_count: medicationsCount,
    encounters_count: encountersCount,
    prior_admissions: priorAdmissions,
    doctor: doctor || "Dr. Smith",
    risk_score: Number(prediction.riskScore || 0),
    risk_level: prediction.riskLevel || "Medium",
    prediction_percentage: Number(prediction.riskScore || 0),
    risk_reasons: JSON.stringify(prediction.reasons || []),
    follow_up_suggestion: prediction.recommendation || "",
    created_at: new Date().toISOString(),
  };
}

function syncPatientsFromFhir(database, targetCount = 50) {
  if (!fs.existsSync(fhirDataPath)) return;
  const existingCount = database.prepare("select count(*) as c from patients").get()?.c || 0;
  if (existingCount >= targetCount) return;

  const files = fs
    .readdirSync(fhirDataPath)
    .filter(
      (file) =>
        file.endsWith(".json") &&
        !file.startsWith("hospitalInformation") &&
        !file.startsWith("practitionerInformation")
    )
    .slice(0, targetCount);
  if (!files.length) return;

  const insert = database.prepare(`
    insert or ignore into patients (
      id, profile_id, name, age, gender, diagnosis,
      conditions_count, medications_count, encounters_count, prior_admissions,
      doctor, risk_score, risk_level, prediction_percentage, risk_reasons, follow_up_suggestion, created_at
    )
    values (
      @id, @profile_id, @name, @age, @gender, @diagnosis,
      @conditions_count, @medications_count, @encounters_count, @prior_admissions,
      @doctor, @risk_score, @risk_level, @prediction_percentage, @risk_reasons, @follow_up_suggestion, @created_at
    )
  `);

  const rows = [];
  for (const file of files) {
    try {
      const summary = extractFhirPatientSummary(path.join(fhirDataPath, file));
      if (summary) rows.push(summary);
    } catch (_error) {
      // skip malformed file and continue
    }
  }
  if (!rows.length) return;

  const tx = database.transaction((items) => items.forEach((item) => insert.run(item)));
  tx(rows);
}

function listPatients() {
  const database = getDb();
  if (!database) return [];
  return database.prepare("select * from patients order by datetime(created_at) desc").all();
}

function getPatientById(id) {
  const database = getDb();
  if (!database) return null;
  return database.prepare("select * from patients where id = ?").get(String(id)) || null;
}

function getPatientByProfileId(profileId) {
  const database = getDb();
  if (!database) return null;
  return database.prepare("select * from patients where profile_id = ? limit 1").get(String(profileId)) || null;
}

function insertDischargeNote({ patientId, originalNote, simplifiedNote, language }) {
  const database = getDb();
  if (!database) return null;
  const row = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    patient_id: String(patientId),
    original_note: originalNote || "",
    simplified_note: simplifiedNote || "",
    language: language || "English",
    created_at: new Date().toISOString(),
  };
  database
    .prepare(
      "insert into discharge_notes (id, patient_id, original_note, simplified_note, language, created_at) values (@id, @patient_id, @original_note, @simplified_note, @language, @created_at)"
    )
    .run(row);
  return row;
}

function listDischargeNotes(patientId) {
  const database = getDb();
  if (!database) return [];
  return database
    .prepare("select * from discharge_notes where patient_id = ? order by datetime(created_at) desc")
    .all(String(patientId));
}

function getLatestDischargeNoteAnyPatient() {
  const database = getDb();
  if (!database) return null;
  return (
    database
      .prepare("select * from discharge_notes order by datetime(created_at) desc limit 1")
      .get() || null
  );
}

module.exports = {
  shouldUseLocalSql,
  listPatients,
  getPatientById,
  getPatientByProfileId,
  insertDischargeNote,
  listDischargeNotes,
  getLatestDischargeNoteAnyPatient,
};
