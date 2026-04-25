DischargeIQ is an AI-driven platform that reduces hospital readmissions by improving post-discharge care. It predicts patient readmission risk using clinical data and provides explainable insights to help doctors intervene early. The system also converts complex medical instructions into clear, patient-friendly language and supports multiple languages for better accessibility. After discharge, an AI chatbot monitors patients and alerts care teams in real time if concerning symptoms are reported, helping prevent avoidable emergency visits.

## Run backend

```bash
cd src/backend
cp .env.example .env
npm install
npm run dev
```

## Run frontend

```bash
cd src/frontend
cp .env.example .env.local
npm install
npm run dev
```

## Auth + roles

- Supabase Auth email/password is used for login.
- Role is read from `profiles.role` (`doctor` or `patient`).
- Unified login page: `http://localhost:3000/login`.
- Doctor-only screens: clinician dashboard + alerts.
- Patient-only screens: discharge plan + chat.