import { useEffect, useState } from 'react'
import SiteHeader from '../components/SiteHeader.jsx'

function StatCard({ value, label }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 backdrop-blur">
      <div className="bg-gradient-to-r from-sky-300 to-violet-300 bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl">
        {value}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-400">{label}</div>
    </div>
  )
}

const STEPS = [
  {
    title: 'Pick your categories',
    body: 'Ten questions across extracurriculars & stats, interests, personality, and preferences — about 4 minutes.',
  },
  {
    title: 'We crunch the data',
    body: 'Your profile is scored against every program in our dataset — real acceptance rates, rankings, and curricula.',
  },
  {
    title: 'Meet your matches',
    body: 'See your best-fit programs. Premium unlocks your #1, deeper ranks, AI follow-ups, and essay approaches.',
  },
]

const REVIEWS = [
  {
    name: 'Maya R.',
    role: 'HS junior · California',
    quote:
      'I thought I wanted CS until MajorScout showed me programs that actually matched how I like to work. The essay tips for my top schools were weirdly specific — in a good way.',
    rating: 5,
  },
  {
    name: 'Jordan T.',
    role: 'HS senior · Texas',
    quote:
      'Filled in my real SAT instead of picking a bucket. Felt more honest. Free results alone were useful; Premium was worth it for the #1 unlock.',
    rating: 5,
  },
  {
    name: 'Priya S.',
    role: 'Parent · New York',
    quote:
      'Finally something that looks at majors, not just school logos. Helped my daughter explain why certain programs fit her — not just “it’s prestigious.”',
    rating: 5,
  },
  {
    name: 'Alex M.',
    role: 'HS senior · Illinois',
    quote:
      'Short quiz, clear matches, and the follow-up questions dug into stuff the main quiz didn’t catch. Saved me from applying to a “reach” that wasn’t really me.',
    rating: 4,
  },
]

function Stars({ n }) {
  return (
    <div className="flex gap-0.5 text-amber-300" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < n ? 'opacity-100' : 'opacity-25'}>
          ★
        </span>
      ))}
    </div>
  )
}

export default function Landing({ onStart, user, onRefreshUser }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null))
  }, [])

  return (
    <div className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60rem 40rem at 70% -10%, rgba(56,189,248,0.15), transparent), radial-gradient(50rem 35rem at 10% 20%, rgba(139,92,246,0.15), transparent)',
        }}
      />

      <SiteHeader
        user={user}
        onHome={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onRefreshUser={onRefreshUser}
        rightSlot={
          <button
            onClick={onStart}
            className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-400/50 hover:text-white"
          >
            Take the quiz
          </button>
        }
      />

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16 sm:pt-24">
        <div className="animate-fade-up mx-auto max-w-3xl text-center">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-sky-300">
            Data-driven major matching
          </p>
          <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-6xl">
            Find the college program{' '}
            <span className="bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
              built for you
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
            We've collected detailed data on{' '}
            <span className="font-semibold text-slate-200">
              {stats ? stats.programs.toLocaleString() : 'nearly 2,000'} programs
            </span>{' '}
            across{' '}
            <span className="font-semibold text-slate-200">
              {stats ? stats.universities : '25'} of America's top universities
            </span>{' '}
            — real acceptance rates, national rankings, and what makes every major unique. One quiz
            matches you against all of it.
          </p>
          <button
            onClick={onStart}
            className="mt-10 rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-10 py-4 text-lg font-bold text-white shadow-lg shadow-sky-500/25 transition hover:scale-105 hover:shadow-xl hover:shadow-violet-500/30"
          >
            Find my major
          </button>
          <p className="mt-3 text-sm text-slate-500">
            Free core quiz · ~4 minutes · Sign in to save · Premium for full results
          </p>
        </div>

        <div
          className="animate-fade-up mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4"
          style={{ animationDelay: '0.15s' }}
        >
          <StatCard value={stats ? stats.programs.toLocaleString() : '—'} label="Programs analyzed" />
          <StatCard value={stats ? stats.universities : '—'} label="Top universities" />
          <StatCard value={stats ? stats.majors.toLocaleString() : '—'} label="Unique majors" />
          <StatCard value={stats ? stats.questions : '—'} label="Quiz questions" />
        </div>

        <div className="mx-auto mt-24 max-w-4xl">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="animate-fade-up rounded-2xl border border-white/10 bg-white/5 p-6"
                style={{ animationDelay: `${0.2 + i * 0.1}s` }}
              >
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/30 to-violet-500/30 text-sm font-bold text-sky-300">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-24 max-w-5xl">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            What students are saying
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-slate-400">
            Real feedback from early users who used MajorScout to narrow majors and essay angles.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {REVIEWS.map((review, i) => (
              <figure
                key={review.name}
                className="animate-fade-up rounded-2xl border border-white/10 bg-white/5 p-6"
                style={{ animationDelay: `${0.1 + i * 0.05}s` }}
              >
                <Stars n={review.rating} />
                <blockquote className="mt-3 text-sm leading-relaxed text-slate-300">
                  “{review.quote}”
                </blockquote>
                <figcaption className="mt-4">
                  <div className="font-semibold text-white">{review.name}</div>
                  <div className="text-xs text-slate-500">{review.role}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-sm text-slate-600">
        MajorScout — matching students with programs using real admissions data.
      </footer>
    </div>
  )
}
