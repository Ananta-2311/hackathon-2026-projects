-- Run this in Supabase SQL Editor.
create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('doctor', 'patient')),
  created_at timestamptz default now()
);

create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  assigned_doctor_id uuid not null references profiles(id) on delete restrict,
  name text not null,
  age int not null,
  gender text,
  diagnosis text,
  diagnosis_count int default 0,
  medication_count int default 0,
  previous_admissions int default 0,
  length_of_stay int default 0,
  risk_score int default 0,
  risk_level text default 'Low',
  created_at timestamptz default now()
);

create table if not exists discharge_instructions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  original_text text not null,
  simplified_text text not null,
  language text default 'en',
  created_at timestamptz default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  sender text not null check (sender in ('patient', 'assistant')),
  message text not null,
  created_at timestamptz default now()
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  severity text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz default now()
);
