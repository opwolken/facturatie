# Opwolken Facturatie

A Dutch invoicing (facturatie) application with a FastAPI backend and Next.js frontend, backed by Firebase.

## Project Structure

```
facturatie/
├── backend/          # FastAPI Python API
│   ├── app/
│   │   ├── main.py       # FastAPI app entry point
│   │   ├── config.py     # Configuration and env vars
│   │   ├── auth.py       # Firebase authentication
│   │   ├── models/       # Pydantic data models
│   │   ├── routers/      # API route handlers (invoices, expenses, customers, etc.)
│   │   └── services/     # Business logic (PDF generation, email, parsing)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/         # Next.js 14 TypeScript app
│   ├── src/
│   │   ├── app/          # Next.js App Router pages
│   │   ├── components/   # React components
│   │   ├── lib/          # Utility libraries
│   │   └── types/        # TypeScript type definitions
│   ├── package.json
│   └── tailwind.config.ts
└── firebase.json     # Firebase configuration
```

## Tech Stack

**Backend**
- Python + FastAPI
- Firebase Admin SDK (Firestore, Storage, Auth)
- ReportLab + PyPDF2 + pdfplumber (PDF generation and parsing)
- Jinja2 (template rendering)
- Google Generative AI
- Resend (email)

**Frontend**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Firebase (client SDK)
- Recharts (charts/dashboard)

## Development Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Requires environment variables (via `.env` or environment):
- `FIREBASE_CREDENTIALS_JSON` – Firebase service account JSON (or use `firebase-credentials.json` file)
- `FIREBASE_STORAGE_BUCKET` – Firebase Storage bucket name

### Frontend

```bash
cd frontend
npm install
npm run dev   # starts on http://localhost:3000
```

## Key Commands

### Frontend
```bash
cd frontend
npm run dev       # Development server
npm run build     # Production build
npm run lint      # ESLint (next lint)
```

### Backend
```bash
cd backend
uvicorn app.main:app --reload   # Development server
```

## API Routes

| Prefix | Description |
|--------|-------------|
| `/api/dashboard` | Dashboard statistics |
| `/api/invoices` | Invoice CRUD + PDF generation |
| `/api/expenses` | Expense tracking |
| `/api/customers` | Customer management |
| `/api/settings` | Business settings |
| `/api/preferences` | User preferences |
| `/api/import` | Data import |
| `/api/jaarcijfers` | Annual figures |
| `/api/bank-matching` | Bank transaction matching |
| `/api/health` | Health check |

## Tests

No automated tests currently. Manual testing via the dev servers.

## Deployment

See `deploy.sh` and `firebase.json` for deployment configuration. The backend is containerized via `backend/Dockerfile`.
