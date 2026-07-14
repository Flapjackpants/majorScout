import { useEffect, useState } from 'react'

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
    title: 'Take the quiz',
    body: '40 questions about your interests, academics, test scores, and activities. About 8 minutes.',
  },
  {
    title: 'We crunch the data',
    body: 'Your profile is scored against every program in our dataset — real acceptance rates, rankings, and curricula.',
  },
  {
    title: 'Meet your matches',
    body: 'Get your top 8 programs with a breakdown of exactly why each one fits you.',
  },
]

export default function Landing({ onStart }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null))
  }, [])

  return (
    <div className="relative isolate overflow-hidden">
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60rem 40rem at 70% -10%, rgba(56,189,248,0.15), transparent), radial-gradient(50rem 35rem at 10% 20%, rgba(139,92,246,0.15), transparent)',
        }}
      />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-violet-500 text-sm font-black text-white">
            M
          </span>
          MajorScout
        </div>
        <button
          onClick={onStart}
          className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-400/50 hover:text-white"
        >
          Take the quiz
        </button>
      </header>

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
            — real acceptance rates, national rankings, and what makes every major
            unique. One quiz matches you against all of it.
          </p>
          <button
            onClick={onStart}
            className="mt-10 rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-10 py-4 text-lg font-bold text-white shadow-lg shadow-sky-500/25 transition hover:scale-105 hover:shadow-xl hover:shadow-violet-500/30"
          >
            Find my major
          </button>
          <p className="mt-3 text-sm text-slate-500">Free · No sign-up · ~8 minutes</p>
        </div>

        <div className="animate-fade-up mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4" style={{ animationDelay: '0.15s' }}>
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
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-sm text-slate-600">
        MajorScout — matching students with programs using real admissions data.
      </footer>
    </div>
  )
}
