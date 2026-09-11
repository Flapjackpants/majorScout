import { useEffect, useMemo, useRef, useState } from 'react'
import { addAdmission, deleteAdmission, fetchAdmissions, searchColleges, startGoogleLogin } from '../api.js'
import SiteHeader from '../components/SiteHeader.jsx'
import SiteFooter from '../components/SiteFooter.jsx'

const ROUNDS = [
  { id: 'EA', label: 'Early Action', short: 'EA' },
  { id: 'ED', label: 'Early Decision', short: 'ED' },
  { id: 'RD', label: 'Regular Decision', short: 'RD' },
]

const DECISIONS = [
  { id: 'accepted', label: 'Accepted', tone: 'emerald', emoji: '🎉' },
  { id: 'waitlisted', label: 'Waitlisted', tone: 'amber', emoji: '⏳' },
  { id: 'denied', label: 'Denied', tone: 'rose', emoji: '✕' },
]

const TONE = {
  emerald: {
    on: 'border-emerald-400 bg-emerald-400/15 text-emerald-100',
    chip: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30',
    dot: 'bg-emerald-400',
  },
  amber: {
    on: 'border-amber-400 bg-amber-400/15 text-amber-100',
    chip: 'bg-amber-400/15 text-amber-200 border-amber-400/30',
    dot: 'bg-amber-400',
  },
  rose: {
    on: 'border-rose-400 bg-rose-400/15 text-rose-100',
    chip: 'bg-rose-400/15 text-rose-200 border-rose-400/30',
    dot: 'bg-rose-400',
  },
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none ring-sky-400/40 placeholder:text-slate-600 focus:border-sky-400/50 focus:ring-2'
const labelClass = 'text-[11px] font-bold uppercase tracking-wider text-slate-500'

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
  } catch {
    return iso
  }
}

/** Debounced college autocomplete backed by /api/colleges/search. */
function CollegePicker({ value, onSelect, onClear }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [upstreamOk, setUpstreamOk] = useState(true)
  const [highlight, setHighlight] = useState(0)
  const abortRef = useRef(null)
  const boxRef = useRef(null)

  useEffect(() => {
    if (value) return undefined
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return undefined
    }
    setLoading(true)
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const data = await searchColleges(q, { signal: controller.signal })
        if (controller.signal.aborted) return
        setResults(data.results)
        setUpstreamOk(data.upstreamOk)
        setHighlight(0)
        setOpen(true)
      } catch (err) {
        if (err?.name !== 'AbortError') {
          setResults([])
          setUpstreamOk(false)
          setOpen(true)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query, value])

  useEffect(() => {
    function onDocClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const typed = query.trim()
  const exactMatch = results.some((r) => r.name.toLowerCase() === typed.toLowerCase())
  const options = useMemo(() => {
    const out = results.map((r) => ({ kind: 'result', ...r }))
    if (typed.length >= 2 && !exactMatch) {
      out.push({ kind: 'unverified', name: typed })
    }
    return out
  }, [results, typed, exactMatch])

  function choose(opt) {
    if (opt.kind === 'unverified') {
      onSelect({ name: opt.name, country: null, domain: null, verified: false, source: 'manual' })
    } else {
      onSelect({
        name: opt.name,
        country: opt.country,
        domain: opt.domain,
        verified: true,
        source: opt.source,
      })
    }
    setOpen(false)
    setQuery('')
  }

  function onKeyDown(e) {
    if (!open || options.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(options[highlight])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-400/40 bg-sky-400/10 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{value.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            {value.country && <span>{value.country}</span>}
            {value.verified ? (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 font-bold text-emerald-200">
                ✓ Verified{value.source === 'majorscout' ? ' · in our catalog' : ''}
              </span>
            ) : (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-bold text-amber-200">
                Unverified name
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-slate-300 hover:border-white/40"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => options.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Start typing a college name (US or international)…"
        autoComplete="off"
        className={inputClass}
      />
      {loading && (
        <div className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-700 border-t-sky-400" />
      )}
      {open && typed.length >= 2 && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
          {!upstreamOk && (
            <div className="border-b border-white/5 px-4 py-2 text-[11px] text-amber-300/90">
              Global college database is unreachable right now — showing schools from our catalog only.
            </div>
          )}
          {options.length === 0 && !loading && (
            <div className="px-4 py-3 text-sm text-slate-500">No matches yet — keep typing.</div>
          )}
          <ul className="max-h-72 overflow-y-auto">
            {options.map((opt, i) => (
              <li key={`${opt.kind}-${opt.name}-${opt.country || ''}`}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => choose(opt)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition ${
                    i === highlight ? 'bg-sky-400/10 text-white' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {opt.kind === 'unverified' ? (
                    <>
                      <span>
                        Use “<span className="font-semibold text-white">{opt.name}</span>” as typed
                      </span>
                      <span className="shrink-0 rounded-full border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                        Unverified
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{opt.name}</span>
                        {opt.country && <span className="block text-[11px] text-slate-500">{opt.country}</span>}
                      </span>
                      {opt.source === 'majorscout' && (
                        <span className="shrink-0 rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[10px] font-bold text-sky-200">
                          In catalog
                        </span>
                      )}
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Segmented({ options, value, onChange, toneFor }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((opt) => {
        const on = value === opt.id
        const tone = toneFor ? TONE[toneFor(opt)].on : 'border-sky-400 bg-sky-400/15 text-sky-100'
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${
              on ? tone : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/30'
            }`}
          >
            {opt.emoji ? <span className="mr-1.5">{opt.emoji}</span> : null}
            <span className="hidden sm:inline">{opt.label}</span>
            <span className="sm:hidden">{opt.short || opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function Admissions({
  user,
  onRefreshUser,
  onHome,
  onStartQuiz,
  onMyResults,
  onOpenProFeatures,
  onNavigateLegal,
}) {
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const [college, setCollege] = useState(null)
  const [round, setRound] = useState('RD')
  const [decision, setDecision] = useState('accepted')
  const [intendedMajor, setIntendedMajor] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    fetchAdmissions()
      .then((data) => {
        if (!cancelled) setRows(data)
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
  }, [user?.id])

  const counts = useMemo(() => {
    const c = { accepted: 0, waitlisted: 0, denied: 0 }
    for (const r of rows || []) c[r.decision] = (c[r.decision] || 0) + 1
    return c
  }, [rows])

  async function submit(e) {
    e.preventDefault()
    setFormError(null)
    if (!college) {
      setFormError('Pick a college from the list first.')
      return
    }
    setSaving(true)
    try {
      const saved = await addAdmission({
        college_name: college.name,
        college_country: college.country,
        college_domain: college.domain,
        college_verified: college.verified,
        round,
        decision,
        intended_major: intendedMajor.trim() || undefined,
        application_year: year ? Number(year) : undefined,
      })
      setRows((prev) => [saved, ...(prev || [])])
      setCollege(null)
      setIntendedMajor('')
    } catch (err) {
      setFormError(err.message || 'Could not save this result.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id) {
    if (!window.confirm('Remove this result?')) return
    try {
      await deleteAdmission(id)
      setRows((prev) => (prev || []).filter((r) => r.id !== id))
    } catch (err) {
      setError(err.message || 'Could not delete.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <SiteHeader
        user={user}
        onHome={onHome}
        onRefreshUser={onRefreshUser}
        onMyResults={onMyResults}
        onOpenProFeatures={onOpenProFeatures}
        rightSlot={
          <button
            onClick={onStartQuiz}
            className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-400/50 hover:text-white"
          >
            Take the quiz
          </button>
        }
      />

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-8">
        <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Account</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Admissions tracker</h1>
        <p className="mt-3 max-w-2xl text-slate-400">
          Log each decision as it arrives. College names are checked against a database of US and
          international schools. Your results stay private to your account and help us refine
          MajorScout's matching over time.
        </p>

        {!user && (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-slate-300">Sign in to start tracking your admissions results.</p>
            <button
              onClick={() => startGoogleLogin()}
              className="mt-5 rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-8 py-3 text-sm font-bold text-white"
            >
              Sign in with Google
            </button>
          </div>
        )}

        {user && (
          <>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {DECISIONS.map((d) => (
                <div key={d.id} className={`rounded-2xl border p-4 ${TONE[d.tone].chip}`}>
                  <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">{d.label}</div>
                  <div className="mt-1 text-3xl font-black">{counts[d.id] || 0}</div>
                </div>
              ))}
            </div>

            <form
              onSubmit={submit}
              className="mt-8 space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-sky-300">Add a result</div>
                <h2 className="mt-1 text-xl font-black text-white">Where did you hear back from?</h2>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>College</span>
                <CollegePicker value={college} onSelect={setCollege} onClear={() => setCollege(null)} />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <span className={labelClass}>Application round</span>
                  <Segmented options={ROUNDS} value={round} onChange={setRound} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className={labelClass}>Decision</span>
                  <Segmented
                    options={DECISIONS}
                    value={decision}
                    onChange={setDecision}
                    toneFor={(opt) => opt.tone}
                  />
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-[1fr_160px]">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Intended major (optional)</span>
                  <input
                    type="text"
                    value={intendedMajor}
                    onChange={(e) => setIntendedMajor(e.target.value)}
                    placeholder="e.g. Computer Science"
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Application year</span>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              {formError && <p className="text-sm text-rose-300">{formError}</p>}

              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition hover:scale-[1.02] disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save result'}
              </button>
            </form>

            <section className="mt-10">
              <h2 className="text-lg font-bold text-slate-200">Your results</h2>

              {loading && (
                <div className="mt-8 flex flex-col items-center gap-4">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-sky-400" />
                  <p className="text-sm text-slate-500">Loading…</p>
                </div>
              )}

              {error && !loading && (
                <p className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </p>
              )}

              {!loading && !error && rows?.length === 0 && (
                <p className="mt-6 rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center text-sm text-slate-500">
                  No decisions logged yet. Add your first one above.
                </p>
              )}

              {!loading && rows?.length > 0 && (
                <ul className="mt-4 space-y-3">
                  {rows.map((r) => {
                    const d = DECISIONS.find((x) => x.id === r.decision) || DECISIONS[0]
                    const roundLabel = ROUNDS.find((x) => x.id === r.round)?.label || r.round
                    return (
                      <li
                        key={r.id}
                        className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${TONE[d.tone].dot}`} />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-bold text-white">{r.college_name}</h3>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${TONE[d.tone].chip}`}>
                                {d.label}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                                {roundLabel}
                              </span>
                              {!r.college_verified && (
                                <span
                                  title="This name was entered manually and did not match the college database."
                                  className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200"
                                >
                                  Unverified
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {[r.college_country, r.intended_major, r.application_year, formatDate(r.created_at)]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => remove(r.id)}
                          className="shrink-0 text-xs font-semibold text-slate-500 hover:text-rose-300"
                        >
                          Remove
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <SiteFooter onNavigateLegal={onNavigateLegal} onHome={onHome} onStartQuiz={onStartQuiz} />
    </div>
  )
}
