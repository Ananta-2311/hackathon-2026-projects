-- SAFE seed.sql (uses REAL auth users)

-- Insert profiles using real auth users
insert into profiles (id, full_name, role)
select id, 'Demo Doctor', 'doctor'
from auth.users
where email = 'doctor@dischargeiq.com'
on conflict (id) do update
set role = 'doctor';

insert into profiles (id, full_name, role)
select id, 'Demo Patient', 'patient'
from auth.users
where email = 'patient@dischargeiq.com'
on conflict (id) do update
set role = 'patient';

-- Insert Maria ONLY if not exists
insert into patients (
  profile_id,
  name,
  age,
  gender,
  diagnosis,
  conditions_count,
  medications_count,
  encounters_count,
  prior_admissions,
  risk_level,
  readmission_probability
)
select
  (select id from profiles where role = 'patient' limit 1),
  'Maria Gomez',
  74,
  'Female',
  'Heart Failure',
  6,
  9,
  12,
  4,
  'High',
  95.0
where not exists (
  select 1 from patients where name = 'Maria Gomez'
);