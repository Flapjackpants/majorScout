# MajorScout

A college major matching site. Prospective students take a 40-question quiz about
their interests, academics, SAT scores, extracurriculars, and preferences, and get
matched with their top 8 college programs — drawn from ~2,000 programs across 25
top U.S. universities, with real acceptance rates and rankings.

## Stack

- **Backend:** Python + Flask, pandas for CSV parsing (`backend/`)
- **Frontend:** React + Tailwind CSS via Vite (`frontend/`)
- **Data:** per-university program CSVs in `data/`

## Setup

One-time install (backend venv + root + frontend deps):

```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
npm install
npm install --prefix frontend
```

### Run both at once

```bash
npm run dev:all
```

Backend on http://localhost:5001, frontend on http://localhost:5173 (proxies `/api` to the backend).

### Or run separately

```bash
npm run dev:backend    # Flask on :5001
npm run dev:frontend   # Vite on :5173
```

## How matching works

At startup the backend parses every CSV in `data/` and tags each program with a
weight vector over 14 interest dimensions (computing, engineering, life sciences,
arts, …) using keyword analysis of the major name and description. Quiz answers
build a student vector over the same dimensions; programs are ranked by cosine
similarity, blended with a selectivity fit (SAT/GPA/rigor vs. acceptance rate)
and campus preference fit. Results are capped at 2 programs per university so the
top 8 spans multiple schools.

## API

- `GET /api/stats` — dataset counts for the landing page
- `GET /api/questions` — the quiz question bank
- `POST /api/match` — `{ "answers": { "q1": "a", ... } }` → top 8 programs
