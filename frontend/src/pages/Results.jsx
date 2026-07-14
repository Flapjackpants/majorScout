const RING_RADIUS = 26
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function MatchRing({ percent, size = 'md' }) {
  const dims = size === 'lg' ? 'h-20 w-20' : 'h-16 w-16'
  const offset = RING_CIRCUMFERENCE * (1 - percent / 100)
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
        {percent}%
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

function ProgramCard({ program, rank, featured }) {
  return (
    <div
      className={`animate-fade-up rounded-2xl border p-6 ${
        featured
          ? 'border-sky-400/40 bg-gradient-to-br from-sky-500/10 via-transparent to-violet-500/10 shadow-lg shadow-sky-500/10'
          : 'border-white/10 bg-white/5'
      }`}
      style={{ animationDelay: `${rank * 0.07}s` }}
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
        <StatChip>{program.acceptance_display} acceptance</StatChip>
        {program.college && <StatChip>{program.college}</StatChip>}
      </div>

      <p className="mt-4 text-sm leading-relaxed text-slate-400">
        {program.description.length > 300
          ? program.description.slice(0, 300).trimEnd() + '…'
          : program.description}
      </p>

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
    </div>
  )
}

export default function Results({ results, onRetake, onHome }) {
  if (!results?.length) {
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

  const [top, ...rest] = results

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <header className="flex items-center justify-between">
        <button
          onClick={onHome}
          className="flex items-center gap-2 text-lg font-bold tracking-tight"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-violet-500 text-sm font-black text-white">
            M
          </span>
          MajorScout
        </button>
        <button
          onClick={onRetake}
          className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-400/50 hover:text-white"
        >
          Retake quiz
        </button>
      </header>

      <div className="animate-fade-up mt-12 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Your results</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          Your top 8 program matches
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-400">
          Ranked from nearly 2,000 programs using your interests, academic profile, and
          preferences.
        </p>
      </div>

      <div className="mt-10">
        <ProgramCard program={top} rank={1} featured />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {rest.map((program, i) => (
          <ProgramCard key={program.id} program={program} rank={i + 2} />
        ))}
      </div>

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
