import { useEffect, useMemo, useState } from 'react'
import {
  deleteEssay,
  fetchEssays,
  fetchFollowupQuestions,
  gradeEssay,
  saveProfileAnswers,
} from '../api.js'
import ActivitiesEditor from '../components/ActivitiesEditor.jsx'
import {
  ACTIVITIES_QUESTION_ID as ACTIVITIES_ID,
  ACTIVITY_CATEGORIES,
  AWARD_LEVELS,
  activitiesSummary,
  cleanActivitiesValue,
  emptyActivitiesValue,
  normalizeActivitiesValue,
} from '../lib/activities.js'
import SiteHeader from '../components/SiteHeader.jsx'
import SiteFooter from '../components/SiteFooter.jsx'
import UpgradeModal from '../components/UpgradeModal.jsx'
const RING_RADIUS = 30
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function ScoreRing({ score }) {
  const pct = Math.max(0, Math.min(100, score || 0))
  const offset = RING_CIRCUMFERENCE * (1 - pct / 100)
  const tone = pct >= 80 ? '#34d399' : pct >= 60 ? '#38bdf8' : pct >= 40 ? '#fbbf24' : '#fb7185'
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
        <circle cx="36" cy="36" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <circle
          cx="36"
          cy="36"
          r={RING_RADIUS}
          fill="none"
          stroke={tone}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="animate-ring"
          style={{ '--ring-circumference': RING_CIRCUMFERENCE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black leading-none">{pct}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">/ 100</span>
      </div>
    </div>
  )
}

function RubricBar({ item }) {
  const pct = (Math.max(1, Math.min(10, item.score || 0)) / 10) * 100
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-200">{item.name}</span>
        <span className="font-bold text-slate-400">{item.score}/10</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {item.comment && <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{item.comment}</p>}
    </div>
  )
}

function wordCount(text) {
  return (text || '').trim() ? text.trim().split(/\s+/).length : 0
}

function labelFor(list, id) {
  return list.find((x) => x.id === id)?.label || id
}

function ProfileSummary({ answers, onEdit }) {
  const activities = normalizeActivitiesValue(answers?.[ACTIVITIES_ID])
  const { activityCount, awardCount } = activitiesSummary(activities)
  const writtenIds = Object.keys(answers || {}).filter(
    (k) => k.startsWith('ai_') && k !== ACTIVITIES_ID
  )
  return (
    <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-wider text-amber-300">Your PRO+ profile</div>
          <p className="mt-1 text-sm text-slate-300">
            {activityCount} activit{activityCount === 1 ? 'y' : 'ies'} · {awardCount} award
            {awardCount === 1 ? '' : 's'} · {writtenIds.length} AI follow-up answer
            {writtenIds.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          onClick={onEdit}
          className="rounded-full border border-amber-400/40 px-4 py-1.5 text-xs font-bold text-amber-200 transition hover:bg-amber-400/10"
        >
          Edit profile
        </button>
      </div>
      {activityCount > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {activities.activities.slice(0, 8).map((a, i) => (
            <li
              key={a.id || i}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
              title={a.description || ''}
            >
              {a.name}
              {a.role ? ` · ${a.role}` : ''}
              <span className="ml-1 text-slate-500">({labelFor(ACTIVITY_CATEGORIES, a.category)})</span>
            </li>
          ))}
          {activities.activities.length > 8 && (
            <li className="px-2 py-1 text-xs text-slate-500">+{activities.activities.length - 8} more</li>
          )}
        </ul>
      )}
      {awardCount > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {activities.awards.slice(0, 6).map((aw, i) => (
            <li
              key={aw.id || i}
              className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-100"
            >
              🏅 {aw.title}
              <span className="ml-1 text-amber-300/70">{labelFor(AWARD_LEVELS, aw.level)}</span>
            </li>
          ))}
        </ul>
      )}
      {writtenIds.length === 0 && (
        <p className="mt-3 text-xs text-slate-500">
          You haven't answered the AI follow-up questions yet — they sharpen your essay hooks.
        </p>
      )}
    </div>
  )
}

function ProfileStep({ payload, onSaved, onCancel, canCancel }) {
  const attemptId = payload?.attemptId
  const existing = payload?.answers || {}
  const [questions, setQuestions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [aiAnswers, setAiAnswers] = useState(() => {
    const init = {}
    for (const [k, v] of Object.entries(existing)) {
      if (k.startsWith('ai_') && k !== ACTIVITIES_ID) init[k] = v
    }
    return init
  })
  const [activities, setActivities] = useState(() =>
    existing[ACTIVITIES_ID] ? normalizeActivitiesValue(existing[ACTIVITIES_ID]) : emptyActivitiesValue()
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchFollowupQuestions({ attemptId })
      .then((qs) => {
        if (!cancelled) setQuestions(qs.filter((q) => q.type !== 'activities'))
      })
      .catch((err) => {
        if (!cancelled) {
          setQuestions([])
          setError(err.message || 'Could not load AI questions; you can still add activities.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [attemptId])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const merged = { ...aiAnswers, [ACTIVITIES_ID]: cleanActivitiesValue(activities) }
      const updated = await saveProfileAnswers(attemptId, merged)
      onSaved(updated)
    } catch (err) {
      setError(err.message || 'Could not save your profile.')
      setSaving(false)
    }
  }

  return (
    <div className="rounded-3xl border border-amber-400/30 bg-gradient-to-b from-amber-400/5 to-transparent p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-950">
            <span>⚡</span> Complete your PRO+ profile
          </div>
          <h2 className="mt-3 text-xl font-black text-white">Tell the AI about you</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            These answers are combined with your quiz responses every time you grade an essay, so
            suggestions can point to real experiences instead of generic advice.
          </p>
        </div>
        {canCancel && (
          <button onClick={onCancel} className="text-xs font-semibold text-slate-400 hover:text-white">
            Cancel
          </button>
        )}
      </div>

      {loading && (
        <div className="mt-6 flex items-center gap-3 text-sm text-slate-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-amber-400" />
          Generating tailored follow-up questions…
        </div>
      )}

      {!loading && questions?.length > 0 && (
        <div className="mt-6 space-y-6">
          {questions.map((q, i) => (
            <div key={q.id}>
              <div className="text-xs font-bold uppercase tracking-wider text-violet-300">
                Question {i + 1}
              </div>
              <h3 className="mt-1 text-base font-semibold text-white">{q.text}</h3>
              {q.type === 'single' ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {q.options.map((opt) => {
                    const on = aiAnswers[q.id] === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAiAnswers({ ...aiAnswers, [q.id]: opt.id })}
                        className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                          on
                            ? 'border-sky-400 bg-sky-400/10 text-white'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:border-sky-400/50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <textarea
                  rows={3}
                  value={aiAnswers[q.id] || ''}
                  onChange={(e) => setAiAnswers({ ...aiAnswers, [q.id]: e.target.value })}
                  placeholder={q.placeholder || 'Write a short answer…'}
                  className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white outline-none ring-sky-400/40 placeholder:text-slate-600 focus:border-sky-400/50 focus:ring-2"
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <div className="text-xs font-bold uppercase tracking-wider text-violet-300">Extracurriculars</div>
        <h3 className="mt-1 text-base font-semibold text-white">
          List the activities and awards from your high school years
        </h3>
        <div className="mt-4">
          <ActivitiesEditor value={activities} onChange={setActivities} compact />
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={saving || loading}
          className="rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 px-7 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-400/20 transition hover:scale-[1.02] disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save PRO+ profile'}
        </button>
        <span className="text-xs text-slate-500">You can edit this anytime.</span>
      </div>
    </div>
  )
}

function SuggestionCard({ suggestion, index, canApply, onApply }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-sky-300">Fix {index + 1}</span>
        {suggestion.rewrite && (
          <button
            onClick={onApply}
            disabled={!canApply}
            title={canApply ? 'Replace the quoted text in your draft' : 'Quoted text no longer appears in your draft'}
            className="rounded-full border border-sky-400/40 px-3 py-1 text-[11px] font-bold text-sky-200 transition hover:bg-sky-400/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Apply rewrite
          </button>
        )}
      </div>
      {suggestion.quote && (
        <blockquote className="mt-2 border-l-2 border-rose-400/50 pl-3 text-sm italic text-slate-400">
          “{suggestion.quote}”
        </blockquote>
      )}
      {suggestion.issue && <p className="mt-2 text-sm text-slate-300">{suggestion.issue}</p>}
      {suggestion.rewrite && (
        <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            In your voice
          </div>
          <p className="mt-1 text-sm leading-relaxed text-emerald-50">{suggestion.rewrite}</p>
        </div>
      )}
      {suggestion.why && <p className="mt-2 text-xs leading-relaxed text-slate-500">{suggestion.why}</p>}
    </div>
  )
}

export default function EssayHelp({
  payload,
  program,
  user,
  onBack,
  onHome,
  onRefreshUser,
  onProfileSaved,
  onOpenProFeatures,
  onAdmissions,
  onNavigateLegal,
}) {
  const attemptId = payload?.attemptId
  const unlocked = Boolean(payload?.unlocked || user?.is_admin || user?.is_pro)
  const answers = payload?.answers || {}
  const hasActivities = Boolean(answers[ACTIVITIES_ID])

  const [profileEditing, setProfileEditing] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(!unlocked)
  const [essays, setEssays] = useState([])
  const [activeEssayId, setActiveEssayId] = useState(null)
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [grading, setGrading] = useState(false)
  const [error, setError] = useState(null)

  const university = program?.university || 'your school'
  const major = program?.major

  useEffect(() => {
    if (!unlocked || !attemptId) return
    let cancelled = false
    fetchEssays(attemptId)
      .then((rows) => {
        if (!cancelled) setEssays(rows)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [unlocked, attemptId])

  const schoolEssays = useMemo(
    () => essays.filter((e) => !program?.university || e.university === program.university),
    [essays, program?.university]
  )
  const otherEssays = useMemo(
    () => essays.filter((e) => program?.university && e.university !== program.university),
    [essays, program?.university]
  )

  function loadEssay(e) {
    setActiveEssayId(e.id)
    setPrompt(e.prompt || '')
    setResponse(e.response || '')
    setFeedback(e.feedback || null)
    setError(null)
  }

  function newEssay() {
    setActiveEssayId(null)
    setPrompt('')
    setResponse('')
    setFeedback(null)
    setError(null)
  }

  async function grade() {
    if (!unlocked) {
      setUpgradeOpen(true)
      return
    }
    setError(null)
    if (!prompt.trim()) {
      setError('Paste the essay prompt first so the grader knows what to check against.')
      return
    }
    if (wordCount(response) < 20) {
      setError('Write at least 20 words before grading.')
      return
    }
    setGrading(true)
    try {
      const data = await gradeEssay({
        attemptId,
        university: program?.university,
        major,
        prompt: prompt.trim(),
        response: response.trim(),
        essayId: activeEssayId,
      })
      setFeedback(data.feedback)
      setActiveEssayId(data.essay_id)
      if (data.essay) {
        setEssays((prev) => {
          const rest = prev.filter((e) => e.id !== data.essay.id)
          return [data.essay, ...rest]
        })
      }
    } catch (err) {
      if (err.upgrade) setUpgradeOpen(true)
      setError(err.message || 'Could not grade the essay.')
    } finally {
      setGrading(false)
    }
  }

  async function removeEssay(id) {
    if (!window.confirm('Delete this saved essay?')) return
    try {
      await deleteEssay(id)
      setEssays((prev) => prev.filter((e) => e.id !== id))
      if (activeEssayId === id) newEssay()
    } catch (err) {
      setError(err.message || 'Could not delete.')
    }
  }

  function applyRewrite(s) {
    if (!s.quote || !s.rewrite || !response.includes(s.quote)) return
    setResponse(response.replace(s.quote, s.rewrite))
  }

  const showProfileStep = unlocked && (profileEditing || !hasActivities)
  const words = wordCount(response)

  return (
    <div className="min-h-screen bg-slate-950">
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => {
          setUpgradeOpen(false)
          if (!unlocked) onBack?.()
        }}
        user={user}
        attemptId={attemptId}
        feature={`Essay Help for ${university} is a PRO+ feature: paste a prompt and your draft to get a graded rubric with fixes written in your own voice.`}
        onNavigateLegal={onNavigateLegal}
      />

      <SiteHeader
        user={user}
        onHome={onHome}
        onRefreshUser={onRefreshUser}
        onOpenProFeatures={onOpenProFeatures}
        rightSlot={
          <div className="flex items-center gap-2">
            {onAdmissions && user && (
              <button
                onClick={onAdmissions}
                className="hidden rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-slate-300 transition hover:border-sky-400/50 hover:text-white sm:inline"
              >
                Admissions tracker
              </button>
            )}
            <button
              onClick={onBack}
              className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-slate-300 transition hover:border-sky-400/50 hover:text-white"
            >
              ← Back to results
            </button>
          </div>
        }
      />

      <main className={`mx-auto max-w-6xl px-6 pb-24 pt-4 ${unlocked ? '' : 'pointer-events-none select-none blur-sm'}`}>
        <div className="animate-fade-up">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-950 shadow-sm">
            <span>📝</span> PRO+ Essay Help
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Essays for <span className="bg-gradient-to-r from-sky-300 to-violet-300 bg-clip-text text-transparent">{university}</span>
          </h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            {major ? `Applying for ${major}. ` : ''}
            Paste the school's prompt and your draft. The grader reads your whole quiz profile —
            interests, strengths, activities, awards — and suggests fixes that keep your voice intact.
          </p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
          <div className="space-y-8">
            {showProfileStep ? (
              <ProfileStep
                payload={payload}
                canCancel={hasActivities}
                onCancel={() => setProfileEditing(false)}
                onSaved={(updated) => {
                  setProfileEditing(false)
                  onProfileSaved?.(updated)
                }}
              />
            ) : (
              unlocked && (
                <ProfileSummary answers={answers} onEdit={() => setProfileEditing(true)} />
              )
            )}

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-sky-300">Essay workspace</div>
                  <h2 className="mt-1 text-xl font-black text-white">
                    {activeEssayId ? 'Editing saved essay' : 'New essay'}
                  </h2>
                </div>
                {activeEssayId && (
                  <button onClick={newEssay} className="text-xs font-semibold text-slate-400 hover:text-white">
                    + Start another essay
                  </button>
                )}
              </div>

              <label className="mt-5 block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Essay prompt from {university}
                </span>
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  maxLength={2000}
                  placeholder={`e.g. "Why ${university}?" — paste the exact prompt, including any word limit.`}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm leading-relaxed text-white outline-none ring-sky-400/40 placeholder:text-slate-600 focus:border-sky-400/50 focus:ring-2"
                />
              </label>

              <label className="mt-4 block">
                <span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <span>Your draft</span>
                  <span className={words > 0 ? 'text-slate-400' : ''}>{words} words</span>
                </span>
                <textarea
                  rows={14}
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  maxLength={10000}
                  placeholder="Paste your response here. Rough drafts are fine — the grader is most useful early."
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-[15px] leading-relaxed text-white outline-none ring-sky-400/40 placeholder:text-slate-600 focus:border-sky-400/50 focus:ring-2"
                />
              </label>

              {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  onClick={grade}
                  disabled={grading}
                  className="rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 px-8 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-400/20 transition hover:scale-[1.02] disabled:opacity-60"
                >
                  {grading ? 'Grading your essay…' : feedback ? 'Re-grade my essay' : 'Grade my essay'}
                </button>
                <span className="text-xs text-slate-500">
                  Each grade is saved to this attempt so you can track revisions.
                </span>
              </div>
            </section>

            {grading && (
              <div className="flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-5 py-4 text-sm text-amber-200">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-amber-400" />
                Reading your draft against the prompt, your profile, and {university}…
              </div>
            )}

            {feedback && !grading && (
              <section className="animate-fade-up space-y-6 rounded-3xl border border-amber-400/30 bg-gradient-to-b from-amber-400/5 to-transparent p-6">
                <div className="flex flex-wrap items-center gap-6">
                  <ScoreRing score={feedback.overall_score} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black uppercase tracking-wider text-amber-300">Overall grade</div>
                    <h2 className="mt-1 text-2xl font-black text-white">
                      {feedback.overall_score >= 80
                        ? 'Strong draft — polish and submit.'
                        : feedback.overall_score >= 60
                          ? 'Solid foundation with clear upgrades.'
                          : 'Good start — the fixes below will move it most.'}
                    </h2>
                    {feedback.prompt_fit && (
                      <p className="mt-2 text-sm leading-relaxed text-slate-300">{feedback.prompt_fit}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Rubric</div>
                    {(feedback.rubric || []).map((r, i) => (
                      <RubricBar key={`${r.name}-${i}`} item={r} />
                    ))}
                  </div>
                  <div className="space-y-4">
                    {feedback.style_profile && (
                      <div className="rounded-2xl border border-violet-400/20 bg-violet-500/5 p-4">
                        <div className="text-xs font-bold uppercase tracking-widest text-violet-300">
                          Your voice, as the grader hears it
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-300">{feedback.style_profile}</p>
                        <p className="mt-2 text-[11px] text-slate-500">
                          Every rewrite below is written to match this style.
                        </p>
                      </div>
                    )}
                    {feedback.strengths?.length > 0 && (
                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                        <div className="text-xs font-bold uppercase tracking-widest text-emerald-300">
                          Keep doing this
                        </div>
                        <ul className="mt-2 space-y-1.5">
                          {feedback.strengths.map((s, i) => (
                            <li key={i} className="flex gap-2 text-sm text-slate-300">
                              <span className="mt-0.5 text-emerald-400">✓</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {feedback.suggestions?.length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      Suggested fixes, highest impact first
                    </div>
                    <div className="mt-3 grid gap-3">
                      {feedback.suggestions.map((s, i) => (
                        <SuggestionCard
                          key={i}
                          index={i}
                          suggestion={s}
                          canApply={Boolean(s.quote && s.rewrite && response.includes(s.quote))}
                          onApply={() => applyRewrite(s)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Saved essays</div>
                <button onClick={newEssay} className="text-xs font-semibold text-sky-300 hover:text-white">
                  + New
                </button>
              </div>
              {schoolEssays.length === 0 && (
                <p className="mt-3 text-sm text-slate-500">
                  Nothing saved for {university} yet. Your first grade will appear here.
                </p>
              )}
              <ul className="mt-3 space-y-2">
                {schoolEssays.map((e) => (
                  <li key={e.id}>
                    <div
                      className={`flex items-start justify-between gap-2 rounded-xl border px-3 py-2.5 transition ${
                        e.id === activeEssayId
                          ? 'border-amber-400/50 bg-amber-400/10'
                          : 'border-white/10 bg-slate-950/40 hover:border-sky-400/40'
                      }`}
                    >
                      <button onClick={() => loadEssay(e)} className="min-w-0 flex-1 text-left">
                        <div className="truncate text-sm font-semibold text-white">
                          {(e.prompt || 'Untitled prompt').slice(0, 60)}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {e.feedback?.overall_score != null ? `${e.feedback.overall_score}/100 · ` : ''}
                          {wordCount(e.response)} words
                        </div>
                      </button>
                      <button
                        onClick={() => removeEssay(e.id)}
                        title="Delete"
                        className="shrink-0 text-xs text-slate-500 hover:text-rose-300"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {otherEssays.length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-white">
                    {otherEssays.length} essay{otherEssays.length === 1 ? '' : 's'} for other schools
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {otherEssays.map((e) => (
                      <li key={e.id}>
                        <button
                          onClick={() => loadEssay(e)}
                          className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-left transition hover:border-sky-400/40"
                        >
                          <div className="truncate text-xs font-semibold text-slate-200">{e.university}</div>
                          <div className="truncate text-[11px] text-slate-500">{(e.prompt || '').slice(0, 50)}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-xs leading-relaxed text-slate-500">
              <div className="font-bold uppercase tracking-widest text-slate-400">How grading works</div>
              <p className="mt-2">
                The grader scores prompt fit, specificity, voice, structure, and mechanics. It quotes the
                exact lines to change and rewrites them in your register — no thesaurus upgrades, no
                invented facts. Details come only from your quiz answers and listed activities.
              </p>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter onNavigateLegal={onNavigateLegal} onHome={onHome} onStartQuiz={onBack} />
    </div>
  )
}
