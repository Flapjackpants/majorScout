import { useEffect, useState } from 'react'
import { api, startGoogleLogin } from '../api.js'
import UpgradeModal from '../components/UpgradeModal.jsx'

const RING_RADIUS = 26
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function MatchRing({ percent, size = 'md' }) {
  const dims = size === 'lg' ? 'h-20 w-20' : 'h-16 w-16'
  const offset = RING_CIRCUMFERENCE * (1 - (percent || 0) / 100)
  return (
    <div className={`relative ${dims} shrink-0`}>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={RING_RADIUS}
          fill="none"
          stroke="url(#ringGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="animate-ring"
          style={{ '--ring-circumference': RING_CIRCUMFERENCE }}
        />
        <defs>
          <linearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-extrabold">
        {percent != null ? `${percent}%` : '—'}
      </div>
    </div>
  )
}

function StatChip({ children }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
      {children}
    </span>
  )
}

function LockedCard({ rank, matchPercent, onUnlock, featured }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-6 ${
        featured
          ? 'border-amber-400/40 bg-gradient-to-br from-amber-500/10 via-transparent to-violet-500/10'
          : 'border-white/10 bg-white/5'
      }`}
    >
      <div className="pointer-events-none absolute inset-0 backdrop-blur-[2px]" />
      <div className="relative">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-300">
          {rank === 1 ? 'Best match — Premium' : `Match #${rank} — Premium`}
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-500">#{rank}</div>
            <h3 className={`mt-1 font-bold text-slate-400 ${featured ? 'text-2xl' : 'text-lg'}`}>
              Hidden until you upgrade
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {rank === 1
                ? 'Your strongest overall fit is locked behind Premium.'
                : 'Deeper fits beyond the free top mid-range are Premium.'}
            </p>
          </div>
          <MatchRing percent={matchPercent} size={featured ? 'lg' : 'md'} />
        </div>
        <button
          onClick={onUnlock}
          className="mt-5 rounded-full bg-gradient-to-r from-amber-500 to-violet-500 px-6 py-2.5 text-sm font-bold text-white"
        >
          Unlock with Premium
        </button>
      </div>
    </div>
  )
}

function ProgramCard({ program, rank, featured, guidance, isPremium, onUnlock }) {
  if (program.locked) {
    return (
      <LockedCard
        rank={rank}
        matchPercent={program.match_percent}
        featured={featured}
        onUnlock={onUnlock}
      />
    )
  }

  const schoolGuidance = guidance?.find((g) => g.university === program.university)

  return (
    <div
      className={`animate-fade-up rounded-2xl border p-6 ${
        featured
          ? 'border-sky-400/40 bg-gradient-to-br from-sky-500/10 via-transparent to-violet-500/10 shadow-lg shadow-sky-500/10'
          : 'border-white/10 bg-white/5'
      }`}
      style={{ animationDelay: `${Math.min(rank, 8) * 0.07}s` }}
    >
      {featured && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-sky-400/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-sky-300">
          Best match
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-400">
            <span className="text-slate-500">#{rank}</span>
            {program.university}
          </div>
          <h3 className={`mt-1 font-bold leading-snug ${featured ? 'text-2xl' : 'text-lg'}`}>
            {program.major}
          </h3>
        </div>
        <MatchRing percent={program.match_percent} size={featured ? 'lg' : 'md'} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {program.ranking != null && <StatChip>#{program.ranking} U.S. News</StatChip>}
        {program.acceptance_display && <StatChip>{program.acceptance_display} acceptance</StatChip>}
        {program.college && <StatChip>{program.college}</StatChip>}
      </div>

      {program.description && (
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          {program.description.length > 300
            ? program.description.slice(0, 300).trimEnd() + '…'
            : program.description}
        </p>
      )}

      {program.why?.length > 0 && (
        <div className="mt-5 rounded-xl border border-white/5 bg-slate-950/40 p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-violet-300">
            Why it fits you
          </div>
          <ul className="mt-2 space-y-1.5">
            {program.why.map((reason, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-300">
                <span className="mt-0.5 text-sky-400">✓</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isPremium && schoolGuidance && (
        <details className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-widest text-amber-300">
            Essay approach for {program.university}
          </summary>
          <div className="mt-3 space-y-3 text-sm text-slate-300">
            {schoolGuidance.prompt_themes?.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Likely prompt themes
                </div>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {schoolGuidance.prompt_themes.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="leading-relaxed whitespace-pre-wrap">{schoolGuidance.approach}</p>
            {schoolGuidance.hooks?.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Hooks from your profile
                </div>
                <ul className="mt-1 space-y-1">
                  {schoolGuidance.hooks.map((h, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-amber-400">→</span>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      {!isPremium && featured === false && rank <= 8 && (
        <button
          onClick={onUnlock}
          className="mt-4 text-xs font-semibold text-amber-300/80 underline-offset-2 hover:underline"
        >
          Premium: unlock essay approaches for this school
        </button>
      )}
    </div>
  )
}

export default function Results({ payload, user, onRetake, onHome, onRefreshUser }) {
  const results = payload?.results || []
  const answers = payload?.answers || {}
  const isPremium = Boolean(user?.is_premium || payload?.isPremium)

  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [guidance, setGuidance] = useState(null)
  const [loadingGuidance, setLoadingGuidance] = useState(false)

  useEffect(() => {
    if (!isPremium || !results.length) return
    let cancelled = false
    setLoadingGuidance(true)
    api('/api/premium/essay-guidance', {
      method: 'POST',
      body: JSON.stringify({ answers, results }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.guidance) setGuidance(data.guidance)
      })
      .finally(() => {
        if (!cancelled) setLoadingGuidance(false)
      })
    return () => {
      cancelled = true
    }
  }, [isPremium])

  if (!results.length) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg text-slate-300">No matches to show yet.</p>
        <button
          onClick={onRetake}
          className="rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-8 py-3 font-bold text-white"
        >
          Take the quiz
        </button>
      </div>
    )
  }

  const ranked = results.map((r, i) => ({ ...r, rank: r.rank || i + 1 }))
  const top = ranked[0]
  const mid = ranked.filter((r) => r.rank >= 2 && r.rank <= 8)
  const deeper = ranked.filter((r) => r.rank >= 9)

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        user={user}
        feature="Unlock your #1 match, deeper rankings, AI follow-ups, and essay approaches."
      />

      <header className="flex items-center justify-between">
        <button onClick={onHome} className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-violet-500 text-sm font-black text-white">
            M
          </span>
          MajorScout
        </button>
        <div className="flex items-center gap-2">
          {!user && (
            <button
              onClick={() => {
                try {
                  sessionStorage.setItem('pendingQuiz', JSON.stringify(payload))
                } catch {
                  /* ignore */
                }
                startGoogleLogin()
              }}
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200"
            >
              Save results
            </button>
          )}
          <button
            onClick={onRetake}
            className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-400/50 hover:text-white"
          >
            Retake quiz
          </button>
        </div>
      </header>

      <div className="animate-fade-up mt-12 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Your results</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          {isPremium ? 'Your full program matches' : 'Your free program matches'}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-400">
          Ranked from nearly 2,000 programs using your interests, academics, and preferences.
          {!isPremium && ' Free results show ranks #2–#8; upgrade to see #1, #9+, and essay guides.'}
        </p>
        {loadingGuidance && (
          <p className="mt-2 text-sm text-amber-300/80">Writing essay approaches for your schools…</p>
        )}
      </div>

      <div className="mt-10">
        <ProgramCard
          program={top}
          rank={top.rank}
          featured
          guidance={guidance}
          isPremium={isPremium}
          onUnlock={() => setUpgradeOpen(true)}
        />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {mid.map((program) => (
          <ProgramCard
            key={`${program.id}-${program.rank}`}
            program={program}
            rank={program.rank}
            guidance={guidance}
            isPremium={isPremium}
            onUnlock={() => setUpgradeOpen(true)}
          />
        ))}
      </div>

      {deeper.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-center text-lg font-bold text-slate-300">Deeper fits (#9+)</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {deeper.map((program) => (
              <ProgramCard
                key={`${program.id}-${program.rank}`}
                program={program}
                rank={program.rank}
                guidance={guidance}
                isPremium={isPremium}
                onUnlock={() => setUpgradeOpen(true)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-14 text-center">
        <button
          onClick={onRetake}
          className="rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-10 py-4 text-lg font-bold text-white shadow-lg shadow-sky-500/25 transition hover:scale-105"
        >
          Retake the quiz
        </button>
      </div>
    </div>
  )
}
