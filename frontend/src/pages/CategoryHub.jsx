const ACCENT = {
  orange: {
    border: 'border-l-orange-400',
    iconBg: 'bg-orange-400/15 text-orange-300',
    dot: 'bg-orange-400',
    link: 'text-orange-300 hover:text-orange-200',
  },
  rose: {
    border: 'border-l-rose-400',
    iconBg: 'bg-rose-400/15 text-rose-300',
    dot: 'bg-rose-400',
    link: 'text-rose-300 hover:text-rose-200',
  },
  sky: {
    border: 'border-l-sky-400',
    iconBg: 'bg-sky-400/15 text-sky-300',
    dot: 'bg-sky-400',
    link: 'text-sky-300 hover:text-sky-200',
  },
  emerald: {
    border: 'border-l-emerald-400',
    iconBg: 'bg-emerald-400/15 text-emerald-300',
    dot: 'bg-emerald-400',
    link: 'text-emerald-300 hover:text-emerald-200',
  },
}

function CategoryIcon({ name }) {
  const common = 'h-5 w-5'
  if (name === 'bolt') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M13 2 4 14h6l-1 8 10-14h-6l1-6z" />
      </svg>
    )
  }
  if (name === 'target') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </svg>
    )
  }
  if (name === 'brain') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M9.5 2a4 4 0 0 0-3.9 4.9A4 4 0 0 0 4 13c0 1.5.8 2.8 2 3.5V20h4v-2.2c.6.1 1.3.2 2 .2s1.4-.1 2-.2V20h4v-3.5A4.1 4.1 0 0 0 20 13a4 4 0 0 0-1.6-6.1A4 4 0 0 0 14.5 2c-1.2 0-2.3.5-3 1.4A4 4 0 0 0 9.5 2z" />
      </svg>
    )
  }
  return (
    <svg className={common} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z" />
    </svg>
  )
}

export default function CategoryHub({ sections, counts, onStartCategory, onStartAll, onExit, user }) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(50rem 35rem at 80% 0%, rgba(56,189,248,0.12), transparent), radial-gradient(40rem 30rem at 10% 40%, rgba(139,92,246,0.12), transparent)',
        }}
      />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-between">
          <button
            onClick={onExit}
            className="rounded-full border border-white/10 px-4 py-1.5 text-sm text-slate-400 transition hover:border-white/30 hover:text-white"
          >
            ← Home
          </button>
          {user?.name && (
            <p className="text-sm text-slate-500">
              Signed in as <span className="text-slate-300">{user.name}</span>
            </p>
          )}
        </div>

        <div className="animate-fade-up mt-12 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Your assessment</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Choose a category to begin</h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">
            Ten questions across four areas. Start anywhere — we combine everything into one match profile.
          </p>
          <button
            onClick={onStartAll}
            className="mt-6 rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20"
          >
            Start full quiz
          </button>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map((section, i) => {
            const accent = ACCENT[section.accent] || ACCENT.sky
            const count = counts[section.id] || 0
            return (
              <button
                key={section.id}
                onClick={() => onStartCategory(section.id)}
                className={`animate-fade-up group flex flex-col rounded-2xl border border-white/10 border-l-4 ${accent.border} bg-white/5 p-5 text-left transition hover:bg-white/10`}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${accent.iconBg}`}>
                  <CategoryIcon name={section.icon} />
                </div>
                <h2 className="text-lg font-bold text-white">{section.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{section.blurb}</p>
                <div className="mt-5 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-400">
                    <span className={`h-2 w-2 rounded-full ${accent.dot}`} />
                    {count} question{count === 1 ? '' : 's'}
                  </span>
                  <span className={`font-semibold ${accent.link}`}>
                    Start <span aria-hidden>→</span>
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
