# MajorScout

**Stop guessing your major. Match against real programs — not vibes.**

MajorScout helps high school students find college majors that fit who they actually are.
Take a structured 40-question quiz across four clear categories, then get ranked against
nearly 2,000 programs at 25 top U.S. universities — with real acceptance rates, rankings,
and curricula. Sign in to save your results and reopen them anytime. Unlock a result set
with a one-time payment for your #1 match, deeper rankings, and personalized essay approaches.

---

## Pitch

Choosing a major is one of the highest-stakes decisions a student makes — and most tools
either ask vague personality quizzes or dump a school list with no program-level detail.

MajorScout is different:

1. **Program-level matching** — not “you might like Stanford,” but *which majors* at which
   schools fit your interests, academics, and preferences.
2. **Real admissions data** — acceptance rates and U.S. News rankings baked into the score,
   so reaches and safeties are grounded in numbers.
3. **Clear quiz structure** — 40 questions in four labeled categories (stats, interests,
   personality, preferences), including fill-in SAT/ACT/GPA instead of coarse buckets.
4. **Account + unlock that helps applications** — saved history on your account; one-time
   unlock per quiz for full ranks and per-school essay guidance. Signed-in users also get
   AI-tailored follow-up questions during the quiz.

**Free:** full 40-question quiz + ranks #2–#8  
**Account:** save / reopen past attempts; AI follow-ups while signed in  
**One-time unlock (per result set):** #1 + #9+, essay approaches for that attempt

---

## Technical breakdown

### Architecture

```
React (Vite)  ──/api proxy──►  Flask API  ──►  Turso / libSQL (users, quiz attempts)
                                    │
                                    ├── CSV program dataset (pandas)
                                    ├── Keyword tagging + cosine matching
                                    ├── Google OAuth (Authlib sessions)
                                    ├── Stripe Checkout one-time payment (webhooks)
                                    └── OpenAI gpt-4o-mini (account AI)
```

| Layer | Tech | Role |
|-------|------|------|
| Frontend | React 19, Tailwind 4, Vite | Landing, category hub, quiz, results, account history |
| Backend | Flask, flask-cors | REST API under `/api/*` |
| Database | SQLAlchemy + Turso (libSQL) | Users, unlocked attempts, saved quiz attempts |
| Auth | Google OAuth 2.0 (Authlib) | Session cookie via Vite-proxied callback |
| Billing | Stripe Checkout (`mode=payment`) + webhooks | One-time unlock → `QuizAttempt.unlocked` |
| AI | OpenAI `gpt-4o-mini` | Follow-up questions (signed-in) + essay guidance (unlocked) |
| Data | Per-university CSVs in `data/` | ~2,000 programs across 25 schools |

### Matching pipeline

1. **Load** — At startup, `data_loader.py` parses every CSV into program dicts (university,
   major, college, acceptance rate, ranking, description).
2. **Tag** — `matching.py` builds a weight vector over **14 interest dimensions**
   (computing, engineering, math, life science, health, business, arts, …) via keyword
   analysis of major name + description.
3. **Profile** — Quiz answers become a student vector: interest weights from MCQs,
   academic **strength** from SAT/ACT/GPA numerics + rigor items, and campus **prefs**
   (size / setting).
4. **Score** — Blend of cosine similarity (75%), selectivity fit (15%), preference fit (10%).
5. **Rank** — Top 15 programs, max 2 per university. Locked attempts see ranks #2–#8;
   #1 and #9+ are gated until that attempt is unlocked (or the user is an admin).

### Quiz model

40 questions in four sections ([`backend/questions.json`](backend/questions.json)):

| Category | IDs | Count | What’s covered |
|----------|-----|-------|----------------|
| Extracurriculars & Stats | q1–q10 | 10 | SAT/ACT/GPA fill-ins, rigor, ECs, depth |
| Interests | q11–q22 | 12 | Field affinity → interest dimension weights |
| Personality & Lifestyle | q23–q32 | 10 | Work style, communication, campus vibe |
| Other | q33–q40 | 8 | Size, setting, selectivity, program priorities |

Question types: `single` (MCQ), `number` (validated fill-in), `text` (signed-in AI follow-ups).

### Auth, unlock, and AI

- **Admin whitelist:** `ADMIN_EMAILS` → `is_admin` (admins see all attempts unlocked).
- **Unlock gates:** full #1 / #9+ results and essay guidance require a paid unlock on that
  `QuizAttempt` (account required).
- **AI follow-ups:** require sign-in (account), not a payment.
- **Persistence:** Signed-in quiz submits write `QuizAttempt` rows; “Save results” after
  anonymous quiz stores a pending payload and saves on Google callback. **My results**
  lists and reopens past attempts.

### Key API routes

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/stats` | Landing counts |
| GET | `/api/questions` | Public question bank (no scoring weights) |
| POST | `/api/match` | Answers → gated results (+ save if signed in) |
| GET | `/api/auth/google` · `/api/auth/callback` · `/api/auth/me` | OAuth + session |
| POST | `/api/auth/logout` · `/api/quiz/save` | Logout / persist attempt |
| GET | `/api/quiz/attempts` · `/api/quiz/attempts/<id>` | Account history |
| POST | `/api/billing/checkout` · `/webhook` | One-time unlock for `attempt_id` |
| POST | `/api/premium/followup` · `/essay-guidance` | Account AI / unlocked essay |

### Repo layout

```
majorScout/
├── backend/
│   ├── app.py            # Flask routes
│   ├── matching.py       # Tagging + scoring
│   ├── data_loader.py    # CSV → programs
│   ├── questions.json    # 40-question bank
│   ├── db.py             # SQLAlchemy + Turso models
│   ├── ai.py             # OpenAI helpers
│   └── .env.example
├── frontend/src/
│   ├── pages/            # Landing, CategoryHub, Quiz, Results, History
│   ├── components/       # SiteHeader, UpgradeModal
│   └── api.js            # Credentialed fetch helpers
└── data/                 # University program CSVs
```

---

## Setup

```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
npm install
npm install --prefix frontend
cp backend/.env.example backend/.env   # fill in keys
```

### Turso database

1. Install the [Turso CLI](https://docs.turso.tech/cli/installation) and sign in.
2. Create a database and token:

```bash
turso db create majorscout
turso db show majorscout --url
turso db tokens create majorscout
```

3. Put the URL and token in `backend/.env` as `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
   Tables are created automatically on API startup (`init_db`).

### Stripe one-time price

Create a **one-time** Price in the Stripe Dashboard and set `STRIPE_PRICE_ID` to that price id.
Checkout runs in `mode=payment` and unlocks a single quiz attempt via webhook.

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
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Required Turso remote database |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `ADMIN_EMAILS` | Comma-separated Gmails with admin + full unlock |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` | One-time unlock Checkout |
| `OPENAI_API_KEY` | AI follow-ups + essay guidance |
| `SECRET_KEY` | Flask session signing |
| `FRONTEND_URL` | OAuth redirect + Stripe return URL (default `http://localhost:5173`) |

Google Cloud Console: add authorized redirect URI  
`http://localhost:5173/api/auth/callback`.

Stripe webhook endpoint (local via Stripe CLI):  
`http://localhost:5001/api/billing/webhook`  
Event: `checkout.session.completed`.
