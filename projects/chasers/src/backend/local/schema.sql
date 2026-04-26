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
