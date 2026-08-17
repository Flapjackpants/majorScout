import { useEffect, useState } from 'react'
import { fetchAttempts } from '../api.js'
import SiteHeader from '../components/SiteHeader.jsx'

function formatDate(iso) {
  if (!iso) return 'Unknown date'
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export default function History({ user, onRefreshUser, onHome, onOpenAttempt, onStartQuiz }) {
  const [attempts, setAttempts] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchAttempts()
      .then((rows) => {
        if (!cancelled) setAttempts(rows)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load your results.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-950">
      <SiteHeader
        user={user}
        onHome={onHome}
        onRefreshUser={onRefreshUser}
        rightSlot={
          <button
            onClick={onStartQuiz}
            className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-400/50 hover:text-white"
          >
            Take the quiz
          </button>
        }
      />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Account</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">My results</h1>
        <p className="mt-3 text-slate-400">
          Reopen past quiz attempts. Unlock a result set once to see your #1 match, deeper ranks,
          and essay guides for that attempt.
        </p>

        {loading && (
          <div className="mt-16 flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-sky-400" />
            <p className="text-sm text-slate-500">Loading your attempts…</p>
          </div>
        )}

        {error && !loading && (
          <p className="mt-10 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        )}

        {!loading && !error && attempts?.length === 0 && (
          <div className="mt-16 text-center">
            <p className="text-slate-400">No saved quiz results yet.</p>
            <button
              onClick={onStartQuiz}
              className="mt-6 rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-8 py-3 text-sm font-bold text-white"
            >
              Take the quiz
            </button>
          </div>
        )}

        {!loading && attempts?.length > 0 && (
          <ul className="mt-10 space-y-4">
            {attempts.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => onOpenAttempt(a.id)}
                  className="flex w-full items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left transition hover:border-sky-400/40 hover:bg-white/10"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          a.unlocked
                            ? 'bg-amber-400/15 text-amber-300'
                            : 'bg-slate-500/20 text-slate-400'
                        }`}
                      >
                        {a.unlocked ? 'Unlocked' : 'Locked'}
                      </span>
                      <span className="text-xs text-slate-500">{formatDate(a.created_at)}</span>
                    </div>
                    <h2 className="mt-2 text-lg font-bold text-white">
                      {a.unlocked
                        ? a.top_major || 'Full results'
                        : a.top_major
                          ? `Includes ${a.top_major}`
                          : 'Saved result set'}
                    </h2>
                    {a.top_university && (
                      <p className="mt-1 text-sm text-slate-400">
                        {a.unlocked ? 'Best match · ' : 'Sample mid-rank · '}
                        {a.top_university}
                        {a.match_percent != null ? ` · ${a.match_percent}%` : ''}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-sky-300">View →</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
