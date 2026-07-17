# MajorScout

A college major matching site. Prospective students take a short categorized quiz
about extracurriculars & stats, interests, personality, and preferences — then get
matched with college programs drawn from ~2,000 programs across 25 top U.S.
universities, with real acceptance rates and rankings.

## Stack

- **Backend:** Python + Flask, SQLAlchemy (SQLite), pandas (`backend/`)
- **Frontend:** React + Tailwind CSS via Vite (`frontend/`)
- **Auth:** Google OAuth (Authlib) + server sessions
- **Billing:** Stripe subscriptions
- **AI:** OpenAI `gpt-4o-mini` for premium follow-ups and essay guidance
- **Data:** per-university program CSVs in `data/`

## Setup

```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
npm install
npm install --prefix frontend
cp backend/.env.example backend/.env   # fill in keys
```

### Run both at once

```bash
npm run dev:all
```

Backend on http://localhost:5001, frontend on http://localhost:5173 (proxies `/api`).

### Or run separately

```bash
npm run dev:backend    # Flask on :5001
npm run dev:frontend   # Vite on :5173
```

## Environment

See [`backend/.env.example`](backend/.env.example):

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `ADMIN_EMAILS` | Comma-separated Gmails with admin + premium |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` | Subscriptions |
| `OPENAI_API_KEY` | Premium AI features |
| `SECRET_KEY` | Flask session signing |
| `FRONTEND_URL` | OAuth redirect + Stripe return URL (default `http://localhost:5173`) |

Google Cloud Console: add authorized redirect URI  
`http://localhost:5173/api/auth/callback`.

Stripe webhook endpoint (local via Stripe CLI):  
`http://localhost:5001/api/billing/webhook`  
Events: `checkout.session.completed`, `customer.subscription.*`.

## Product notes

- **Free:** 10-question core quiz; results ranks **#2–#8**
- **Premium:** AI follow-up MCQ + written questions; ranks **#1** and **#9+**; per-school essay approaches
- Quiz answers for signed-in users are saved to SQLite (`backend/majorscout.db`)

## How matching works

At startup the backend parses every CSV in `data/` and tags each program with a
weight vector over 14 interest dimensions. Quiz answers (including numeric SAT/ACT)
build a student vector; programs are ranked by cosine similarity blended with
selectivity and campus preference fit. Results are capped at 2 programs per
university.

## API (high level)

- `GET /api/stats` — landing stats
- `GET /api/questions` — quiz bank
- `POST /api/match` — `{ "answers": { ... } }` → gated results
- `GET /api/auth/google` · `/api/auth/callback` · `/api/auth/me` · `POST /api/auth/logout`
- `POST /api/billing/checkout` · `/api/billing/portal` · `/api/billing/webhook`
- `POST /api/premium/followup` · `/api/premium/essay-guidance` (premium)
