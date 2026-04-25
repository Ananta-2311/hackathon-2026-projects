# DischargeIQ Backend

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Server runs on `http://localhost:5001`.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in SQL editor.
3. Create auth users (email/password) for one doctor and two patients.
4. Replace UUIDs and run `supabase/seed.sql`.
5. Fill `.env` with:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## API Routes

- `GET /api/health`
- `GET /api/auth/me` (auth required)
- `GET /api/patients`
- `GET /api/patients/:id`
- `POST /api/risk/predict`
- `GET /api/instructions/:patientId`
- `POST /api/instructions`
- `POST /api/instructions/simplify`
- `GET /api/chat/history/:patientId`
- `POST /api/chat`
- `GET /api/alerts`
- `POST /api/alerts`
