-- DischargeIQ FINAL schema

create extension if not exists "pgcrypto";

-- PROFILES
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text check (role in ('doctor', 'patient')) not null,
  created_at timestamp default now()
);

-- PATIENTS
create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  assigned_doctor_id uuid references profiles(id) on delete set null,

  name text,
  age int,
  gender text,
  email text,
  phone text,
  address text,

  diagnosis text,
  medical_history text,

  conditions_count int,
  medications_count int,
  encounters_count int,
  prior_admissions int,

  prescription text,
  patient_report text,

  risk_level text,
  risk_score float,
  readmission_probability float,
  prediction_percentage float,

  doctor text,
  current_appointment text,
  next_appointment_date timestamp,
  discharge_date timestamp default now(),

  created_at timestamp default now()
);

alter table patients add column if not exists assigned_doctor_id uuid references profiles(id) on delete set null;
alter table patients add column if not exists risk_score float;

-- ALERTS
create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete cascade,
  patient_name text,
  message text,
  severity text,
  status text default 'open',
  created_at timestamp default now()
);

-- CHAT
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete cascade,
  sender text,
  message text,
  created_at timestamp default now()
);

-- DISCHARGE NOTES
create table if not exists discharge_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete cascade,
  original_note text,
  simplified_note text,
  language text default 'English',
  created_at timestamp default now()
);