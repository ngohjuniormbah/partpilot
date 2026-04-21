# PartPilot - Production-ready BOM backend for Vercel

## What changed
This project now includes a real Node.js backend around the supplied frontend:
- CSV / XLS / XLSX BOM upload API
- deterministic BOM parsing and risk analysis
- persisted scans and parts
- report and audit table APIs bound to scan IDs
- watchlist subscription endpoint
- parametric search endpoint
- demo scan flow

## Storage model
### Production
Set `DATABASE_URL` to a Postgres database. This is the intended production mode for Vercel.
Recommended providers:
- Supabase Postgres
- Neon
- Vercel Postgres

### Fallback
If `DATABASE_URL` is missing, the app uses a file-backed store in `/tmp`. That is fine for local testing, but **not durable in production**.

## Environment variables
Copy `.env.example` and set:
- `DATABASE_URL`
- `PGSSLMODE=require` for hosted Postgres

## API endpoints
- `GET /api/health`
- `GET /api/demo-scan`
- `GET /api/scan-status?scanId=...`
- `GET /api/report?scanId=...`
- `GET /api/parts?scanId=...`
- `GET /api/parametric-search?...`
- `POST /api/upload-bom`
- `POST /api/watch`

## Upload contract
Frontend sends JSON:
```json
{
  "filename": "bom.xlsx",
  "contentBase64": "..."
}
```

## Local development
```bash
npm install
vercel dev
```

## Deploy to Vercel
1. Push to GitHub
2. Import repo into Vercel
3. Add `DATABASE_URL` in project settings
4. Redeploy

## Notes
- The backend is aligned to the existing HTML/CSS/JS frontend you provided.
- The frontend now uploads BOM files, drives the processing screen, and hydrates report/table pages from backend APIs.
