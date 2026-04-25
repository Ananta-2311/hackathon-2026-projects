# DischargeIQ Frontend

Next.js + Tailwind frontend prototype for reducing hospital readmissions.

## Local Development

From the `frontend` folder:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## App Routes

- `/` - Home page with links to all views
- `/dashboard` - Doctor dashboard with patient risk card and critical alert
- `/patient` - Patient-friendly discharge instruction cards
- `/chat` - Simple patient chat interface with hardcoded bot response

## Notes

- Built with the Next.js App Router (`app` directory)
- Uses hardcoded mock data for current hackathon prototype
- Styling uses a clean blue/white Tailwind theme
