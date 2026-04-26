-- final_seed.sql
-- Links Supabase auth users to profiles and patients without fake UUIDs.

-- 1) Ensure profiles exist for known emails.
insert into profiles (id, full_name, role)
select id, 'Demo Doctor', 'doctor'
from auth.users
where email = 'doctor@dischargeiq.com'
on conflict (id) do update
set full_name = excluded.full_name,
    role = excluded.role;

insert into profiles (id, full_name, role)
select id, 'Maria Gomez', 'patient'
from auth.users
where email = 'patient@dischargeiq.com'
on conflict (id) do update
set full_name = excluded.full_name,
    role = excluded.role;

insert into profiles (id, full_name, role)
select id, 'John Smith', 'patient'
from auth.users
where email = 'john@dischargeiq.com'
on conflict (id) do update
set full_name = excluded.full_name,
    role = excluded.role;

insert into profiles (id, full_name, role)
select id, 'Aisha Khan', 'patient'
from auth.users
where email = 'aisha@dischargeiq.com'
on conflict (id) do update
set full_name = excluded.full_name,
    role = excluded.role;

-- 2) Update existing patient rows with profile links and full details.
update patients
set
  profile_id = (select id from auth.users where email = 'patient@dischargeiq.com' limit 1),
  email = 'patient@dischargeiq.com',
  phone = coalesce(phone, '+1-555-0100'),
  address = coalesce(address, '101 Healing Way, Austin, TX'),
  diagnosis = coalesce(diagnosis, 'Heart Failure'),
  medical_history = coalesce(medical_history, 'Hypertension; prior CHF exacerbation'),
  prescription = coalesce(prescription, 'Metoprolol|25mg|Morning and Evening'),
  patient_report = coalesce(patient_report, 'Mild fatigue, no severe symptoms today'),
  doctor = coalesce(doctor, 'Dr. Smith')
where name = 'Maria Gomez';

update patients
set
  profile_id = (select id from auth.users where email = 'john@dischargeiq.com' limit 1),
  email = 'john@dischargeiq.com',
  phone = '+1-555-0101',
  address = '22 Oak Street, Dallas, TX',
  diagnosis = 'COPD',
  medical_history = 'COPD; hypertension',
  prescription = 'Tiotropium|18mcg|Morning',
  patient_report = 'Occasional shortness of breath on exertion',
  doctor = 'Dr. Smith',
  age = coalesce(age, 62),
  gender = coalesce(gender, 'Male'),
  conditions_count = coalesce(conditions_count, 3),
  medications_count = coalesce(medications_count, 4),
  encounters_count = coalesce(encounters_count, 7),
  prior_admissions = coalesce(prior_admissions, 1)
where name = 'John Smith';

update patients
set
  profile_id = (select id from auth.users where email = 'aisha@dischargeiq.com' limit 1),
  email = 'aisha@dischargeiq.com',
  phone = '+1-555-0102',
  address = '75 Cedar Lane, Houston, TX',
  diagnosis = 'Diabetes Type 2',
  medical_history = 'Type 2 diabetes; obesity',
  prescription = 'Metformin|500mg|Morning and Evening',
  patient_report = 'Reports stable glucose checks',
  doctor = 'Dr. Smith',
  age = coalesce(age, 45),
  gender = coalesce(gender, 'Female'),
  conditions_count = coalesce(conditions_count, 1),
  medications_count = coalesce(medications_count, 2),
  encounters_count = coalesce(encounters_count, 3),
  prior_admissions = coalesce(prior_admissions, 0)
where name = 'Aisha Khan';

-- 3) Insert John and Aisha if missing (using auth user ids).
insert into patients (
  profile_id,
  name,
  age,
  gender,
  email,
  phone,
  address,
  diagnosis,
  medical_history,
  conditions_count,
  medications_count,
  encounters_count,
  prior_admissions,
  prescription,
  patient_report,
  doctor
)
select
  (select id from auth.users where email = 'john@dischargeiq.com' limit 1),
  'John Smith',
  62,
  'Male',
  'john@dischargeiq.com',
  '+1-555-0101',
  '22 Oak Street, Dallas, TX',
  'COPD',
  'COPD; hypertension',
  3,
  4,
  7,
  1,
  'Tiotropium|18mcg|Morning',
  'Occasional shortness of breath on exertion',
  'Dr. Smith'
where not exists (select 1 from patients where name = 'John Smith');

insert into patients (
  profile_id,
  name,
  age,
  gender,
  email,
  phone,
  address,
  diagnosis,
  medical_history,
  conditions_count,
  medications_count,
  encounters_count,
  prior_admissions,
  prescription,
  patient_report,
  doctor
)
select
  (select id from auth.users where email = 'aisha@dischargeiq.com' limit 1),
  'Aisha Khan',
  45,
  'Female',
  'aisha@dischargeiq.com',
  '+1-555-0102',
  '75 Cedar Lane, Houston, TX',
  'Diabetes Type 2',
  'Type 2 diabetes; obesity',
  1,
  2,
  3,
  0,
  'Metformin|500mg|Morning and Evening',
  'Reports stable glucose checks',
  'Dr. Smith'
where not exists (select 1 from patients where name = 'Aisha Khan');
