# Opwolken Facturatie

Administratie- en facturatieplatform voor [opwolken.com](https://opwolken.com).

## Stack

| Laag | Technologie |
|------|-------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts |
| Backend | Python, FastAPI |
| Database | Google Cloud Firestore |
| Auth | Firebase Authentication (Google sign-in) |
| Storage | Firebase Storage (PDF bestanden) |

## Projectstructuur

```
├── frontend/                Next.js applicatie
│   └── src/
│       ├── app/
│       │   ├── login/           Inloggen met Google
│       │   └── (dashboard)/     Alle pagina's met sidebar
│       │       ├── page.tsx         Dashboard
│       │       ├── facturen/        Facturen beheer
│       │       ├── uitgaven/        Uitgaven beheer
│       │       ├── klanten/         Klanten beheer
│       │       └── instellingen/    Bedrijfsinstellingen
│       ├── components/          UI componenten
│       ├── lib/                 Firebase, API client, utils
│       └── types/               TypeScript types
│
├── backend/                 Python FastAPI
│   └── app/
│       ├── main.py              App entrypoint
│       ├── auth.py              Firebase token verificatie
│       ├── routers/
│       │   ├── dashboard.py     KPI's en grafieken
│       │   ├── invoices.py      Facturen CRUD + PDF + e-mail
│       │   ├── expenses.py      Uitgaven CRUD + PDF upload
│       │   ├── customers.py     Klanten CRUD
│       │   └── settings.py      Bedrijfsinstellingen
│       ├── models/              Pydantic schemas
│       └── services/
│           ├── pdf_generator.py PDF factuur generatie
│           ├── pdf_parser.py    Automatisch uitlezen van PDF's
│           └── email_service.py Factuur verzending per e-mail
```

## Features

- **Dashboard** — KPI-kaarten (omzet, openstaand, uitgaven, winst), staafdiagram per maand, taartdiagram per categorie
- **Facturen** — Aanmaken met regelitems en BTW-berekening, PDF genereren, per e-mail versturen, statusbeheer
- **Uitgaven** — PDF uploaden via drag & drop, automatisch uitlezen van leverancier/bedragen/datum, categoriseren
- **Klanten** — Beheer met bedrijfsnaam, contactpersoon, adres, KVK- en BTW-nummer
- **Instellingen** — Bedrijfsgegevens, IBAN, factuurprefix

## Aan de slag

### 1. Firebase project opzetten

1. Maak een project aan in de [Firebase Console](https://console.firebase.google.com)
2. Schakel **Authentication** in met Google als sign-in methode
3. Maak een **Firestore Database** aan
4. Maak een **Storage** bucket aan
5. Voeg een **Web app** toe en kopieer de config
6. Genereer een **Service Account Key** via Project Settings → Service accounts

### 2. Environment variabelen

Kopieer de voorbeeldbestanden en vul je Firebase gegevens in:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

**`backend/.env`**
```
FIREBASE_PROJECT_ID=jouw-project-id
FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json
```

**`frontend/.env.local`**
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=jouw-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=jouw-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=jouw-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 3. Backend starten

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

De API draait op `http://localhost:8000`.

### 4. Frontend starten

```bash
cd frontend
npm install
npm run dev
```

De app draait op `http://localhost:3000`. API calls worden automatisch geproxied naar de backend via `next.config.js`.

## Firestore collections

| Collection | Inhoud |
|---|---|
| `customers` | Klantgegevens (bedrijf, contact, adres, KVK, BTW) |
| `invoices` | Facturen met regelitems en status |
| `expenses` | Uitgaven met PDF-link en categorie |
| `company_settings` | Bedrijfsinstellingen per gebruiker |

## Design

- **Fonts**: Inter (UI) + DM Serif Display (headings)
- **Stijl**: Minimaal, veel witruimte, subtiele borders, afgeronde hoeken
- **Kleuren**: Grijstinten met emerald (betaald), amber (openstaand), rood (verlopen)
