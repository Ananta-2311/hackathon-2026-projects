-- Replace UUIDs with your real auth.users IDs.
-- Example users:
-- doctor@dischargeiq.com
-- patient1@dischargeiq.com
-- patient2@dischargeiq.com

insert into profiles (id, full_name, role)
values
  ('00000000-0000-0000-0000-000000000001', 'Dr. Smith', 'doctor'),
  ('00000000-0000-0000-0000-000000000002', 'Maria Thompson', 'patient'),
  ('00000000-0000-0000-0000-000000000003', 'Daniel Cruz', 'patient')
on conflict (id) do nothing;

insert into patients (
  id, profile_id, assigned_doctor_id, name, age, gender, diagnosis,
  diagnosis_count, medication_count, previous_admissions, length_of_stay,
  risk_score, risk_level
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Maria Thompson',
    67,
    'female',
    'Heart Failure',
    3,
    6,
    2,
    8,
    88,
    'High'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Daniel Cruz',
    61,
    'male',
    'COPD Exacerbation',
    2,
    4,
    1,
    5,
    56,
    'Medium'
  )
on conflict (id) do nothing;

insert into discharge_instructions (patient_id, original_text, simplified_text, language)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'Take your blood pressure medication every morning after breakfast. Drink at least 6-8 glasses of water unless fluid restriction.',
    'Take your blood pressure medicine every morning after breakfast. Drink water during the day unless your doctor told you not to.',
    'en'
  )
on conflict do nothing;
