const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { mockPatients } = require("../data/mockPatients");

const isTest = process.env.NODE_ENV === "test";
const dbFilePath = process.env.LOCAL_SQLITE_PATH || path.resolve(__dirname, "../local/dischargeiq.local.db");

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
  return db;
}

function initializeSchema(database) {
  database.exec(`
    create table if not exists patients (
      id text primary key,
      profile_id text,
      name text,
      age integer,
      diagnosis text,
      doctor text,
      risk_score real,
      risk_level text,
      prediction_percentage real,
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
}

function seedPatientsIfEmpty(database) {
  const countRow = database.prepare("select count(*) as count from patients").get();
  if ((countRow?.count || 0) > 0) return;

  const insert = database.prepare(`
    insert into patients (id, profile_id, name, age, diagnosis, doctor, risk_score, risk_level, prediction_percentage, created_at)
    values (@id, @profile_id, @name, @age, @diagnosis, @doctor, @risk_score, @risk_level, @prediction_percentage, @created_at)
  `);

  const nowIso = new Date().toISOString();
  const seedRows = mockPatients.map((patient, index) => ({
    id: String(patient.id),
    profile_id: `patient-${index + 1}`,
    name: patient.name || "",
    age: Number(patient.age || 0),
    diagnosis: patient.diagnosis || "",
    doctor: patient.doctorName || "Dr. Smith",
    risk_score: Number(patient.riskScore || 0),
    risk_level: patient.riskLevel || "Medium",
    prediction_percentage: Number(patient.riskScore || 0),
    created_at: nowIso,
  }));

  const transaction = database.transaction((rows) => rows.forEach((row) => insert.run(row)));
  transaction(seedRows);
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
