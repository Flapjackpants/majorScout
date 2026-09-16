import { useEffect, useMemo, useState } from 'react'
import { api, fetchFollowupQuestions, startCheckout, startGoogleLogin } from '../api.js'
import ActivitiesEditor from '../components/ActivitiesEditor.jsx'
import { activitiesSummary, cleanActivitiesValue, emptyActivitiesValue } from '../lib/activities.js'
import { tracker } from '../lib/tracker.js'

const OPTION_KEYS = ['1', '2', '3', '4']

/**
 * End-of-quiz popup for non-PRO+ users. Explains what the AI-tailored
 * questions unlock and offers to pay now or continue to free results.
 */
function AiQuestionsPaywall({ open, user, busy, error, onUnlock, onContinue, onNavigateLegal }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4 backdrop-blur-sm">
      <div className="animate-fade-up w-full max-w-lg rounded-3xl border border-amber-400/30 bg-gradient-to-b from-slate-900 to-slate-950 p-7 shadow-2xl shadow-amber-500/10">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-950 shadow-sm">
            PRO+
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Quiz complete
          </span>
        </div>
        <h2 className="mt-4 text-2xl font-black text-white sm:text-3xl">
          Go deeper with AI-tailored questions
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          You've finished the core quiz. PRO+ members continue with a short set of questions
          written by AI from your answers, plus a guided extracurriculars &amp; awards profile.
          Everything you enter feeds directly into your essay grading and school-specific hooks.
        </p>

        <ul className="mt-5 space-y-2.5 text-sm text-slate-300">
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 font-bold text-amber-400">✓</span>
            <div>
              <strong className="text-white">AI follow-up questions</strong> — generated from your
              answers to sharpen your matches and your story.
            </div>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 font-bold text-amber-400">✓</span>
            <div>
              <strong className="text-white">Extracurriculars &amp; awards profile</strong> — a guided
              editor for activities, commitment, and award levels.
            </div>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 font-bold text-amber-400">✓</span>
            <div>
              <strong className="text-white">Essay Help</strong> — paste any prompt + draft and get a
              graded rubric with fixes written in your own voice.
            </div>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 font-bold text-amber-400">✓</span>
            <div>
              <strong className="text-white">#1 match + deeper ranks</strong> — the full 15-program list.
            </div>
          </li>
        </ul>

        {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <button
            onClick={onUnlock}
            disabled={busy}
            className="flex-1 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-400/20 transition hover:scale-[1.02] disabled:opacity-60"
          >
            {busy ? 'One moment…' : user ? 'Unlock PRO+ & continue' : 'Sign in to unlock PRO+'}
          </button>
          <button
            onClick={onContinue}
            disabled={busy}
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/5 disabled:opacity-60"
          >
            See my free results
          </button>
        </div>
        <p className="mt-4 text-center text-[11px] text-slate-500">
          You can unlock PRO+ later from your results and complete these questions from Essay Help.
          {onNavigateLegal && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => onNavigateLegal('terms')}
                className="underline hover:text-amber-300"
              >
                Terms
              </button>
              .
            </>
          )}
        </p>
      </div>
    </div>
  )
}

export default function Quiz({
  onComplete,
  onExit,
  user,
  startSectionId,
  includePremiumFollowup,
  onNavigateLegal,
}) {
  const [bank, setBank] = useState(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [selected, setSelected] = useState(null)
  const [numberValue, setNumberValue] = useState('')
  const [textValue, setTextValue] = useState('')
  const [activitiesValue, setActivitiesValue] = useState(emptyActivitiesValue)
  const [submitting, setSubmitting] = useState(false)
  const [loadingFollowup, setLoadingFollowup] = useState(false)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [paywallBusy, setPaywallBusy] = useState(false)
  const [error, setError] = useState(null)
  const [phase, setPhase] = useState('base') // base | followup

  useEffect(() => {
    fetch('/api/questions')
      .then((r) => r.json())
      .then((data) => {
        let questions = data.questions
        if (startSectionId) {
          const first = questions.findIndex((q) => q.section === startSectionId)
          if (first >= 0) {
            // Reorder: selected section first, then the rest in original order
            const selectedQs = questions.filter((q) => q.section === startSectionId)
            const rest = questions.filter((q) => q.section !== startSectionId)
            questions = [...selectedQs, ...rest]
          }
        }
        setBank({ ...data, questions })
        tracker.trackQuizStart(questions.length, startSectionId)
      })
      .catch(() => setError('Could not load the quiz. Is the backend running?'))
  }, [startSectionId])

  const questions = bank?.questions ?? []
  const question = questions[index]
  const sectionsById = useMemo(() => {
    const map = {}
    for (const s of bank?.sections ?? []) map[s.id] = s
    return map
  }, [bank])

  const section = question
    ? question.section === 'premium'
      ? { title: 'Follow-up', blurb: 'Tailored from your answers so far.' }
      : sectionsById[question.section]
    : null
  const isFirstOfSection =
    question && (index === 0 || questions[index - 1].section !== question.section)

  useEffect(() => {
    if (!question) return
    const existing = answers[question.id]
    if (question.type === 'number') {
      setNumberValue(existing != null ? String(existing) : '')
      setTextValue('')
      setSelected(null)
    } else if (question.type === 'text') {
      setTextValue(existing != null ? String(existing) : '')
      setNumberValue('')
      setSelected(null)
    } else if (question.type === 'activities') {
      setActivitiesValue(existing && typeof existing === 'object' ? existing : emptyActivitiesValue())
      setNumberValue('')
      setTextValue('')
      setSelected(null)
    } else {
      setSelected(existing || null)
      setNumberValue('')
      setTextValue('')
    }
  }, [question?.id])

  /** Score the answers; returns the results payload without navigating. */
  async function computeMatch(finalAnswers) {
    const res = await api('/api/match', {
      method: 'POST',
      body: JSON.stringify({ answers: finalAnswers }),
    })
    if (!res.ok) throw new Error('match failed')
    const data = await res.json()
    return {
      results: data.results,
      unlocked: data.unlocked,
      answers: finalAnswers,
      attemptId: data.attempt_id,
      profileSummary: data.profile_summary,
    }
  }

  async function submit(finalAnswers) {
    setSubmitting(true)
    setError(null)
    try {
      tracker.trackQuizComplete({
        total_answers: Object.keys(finalAnswers || {}).length,
        total_questions: questions.length,
      })
      onComplete(await computeMatch(finalAnswers))
    } catch {
      setError('Something went wrong computing your matches. Please try again.')
      setSubmitting(false)
    }
  }

  async function maybeLoadFollowup(currentAnswers) {
    if (!includePremiumFollowup) {
      await submit(currentAnswers)
      return
    }
    // AI follow-ups are PRO+ only. Free / guest users get the paywall popup.
    if (!user?.is_pro) {
      tracker.sendEvent('quiz_paywall_view', { step: index + 1, total_questions: questions.length })
      setPaywallOpen(true)
      return
    }
    setLoadingFollowup(true)
    try {
      const extra = await fetchFollowupQuestions({ answers: currentAnswers })
      if (extra.length === 0) {
        await submit(currentAnswers)
        return
      }
      setBank((prev) => ({
        ...prev,
        questions: [...prev.questions, ...extra],
      }))
      setPhase('followup')
      setIndex((i) => i + 1)
      setLoadingFollowup(false)
    } catch {
      await submit(currentAnswers)
    }
  }

  /**
   * Paywall "Unlock PRO+": guests sign in first (quiz is stashed and saved
   * after OAuth); signed-in users get an attempt created and go to Stripe.
   */
  async function unlockFromPaywall() {
    setPaywallBusy(true)
    setError(null)
    tracker.trackUpgradeClick('pro', 'quiz_paywall')
    try {
      if (!user) {
        try {
          sessionStorage.setItem(
            'pendingQuiz',
            JSON.stringify({ answers, upgradeIntent: true })
          )
        } catch {
          /* ignore */
        }
        startGoogleLogin()
        return
      }
      const payload = await computeMatch(answers)
      if (!payload.attemptId) {
        onComplete(payload)
        return
      }
      // After Stripe redirects back, App.jsx verifies the session and reopens
      // this attempt, so nothing else needs to be stashed here.
      await startCheckout(payload.attemptId)
    } catch (err) {
      setPaywallBusy(false)
      setError(err?.message || 'Could not start PRO+ checkout. Please try again.')
    }
  }

  function advance(nextAnswers) {
    setSelected(null)
    const nextIdx = index + 1
    if (nextIdx < questions.length) {
      const nextQ = questions[nextIdx]
      tracker.trackQuizStep(nextIdx, questions.length, nextQ?.id, nextQ?.section)
      setIndex(nextIdx)
    } else if (phase === 'base' && includePremiumFollowup) {
      maybeLoadFollowup(nextAnswers)
    } else {
      submit(nextAnswers)
    }
  }

  function choose(optionId) {
    if (submitting || loadingFollowup) return
    setSelected(optionId)
    const nextAnswers = { ...answers, [question.id]: optionId }
    setAnswers(nextAnswers)
    setTimeout(() => advance(nextAnswers), 220)
  }

  function submitNumber() {
    if (submitting) return
    const meta = question.input || {}
    const raw = numberValue.trim()
    if (!raw) {
      if (meta.optional) {
        const nextAnswers = { ...answers }
        delete nextAnswers[question.id]
        setAnswers(nextAnswers)
        advance(nextAnswers)
        return
      }
      setError('Please enter a number, or go back.')
      return
    }
    const n = Number(raw)
    if (Number.isNaN(n)) {
      setError('Enter a valid number.')
      return
    }
    if (meta.min != null && n < meta.min) {
      setError(`Value must be at least ${meta.min}.`)
      return
    }
    if (meta.max != null && n > meta.max) {
      setError(`Value must be at most ${meta.max}.`)
      return
    }
    setError(null)
    const nextAnswers = { ...answers, [question.id]: n }
    setAnswers(nextAnswers)
    advance(nextAnswers)
  }

  function submitText() {
    if (submitting) return
    const raw = textValue.trim()
    if (!raw) {
      setError('Please write a short answer.')
      return
    }
    setError(null)
    const nextAnswers = { ...answers, [question.id]: raw }
    setAnswers(nextAnswers)
    advance(nextAnswers)
  }

  function submitActivities() {
    if (submitting) return
    const { activityCount, awardCount } = activitiesSummary(activitiesValue)
    if (activityCount === 0 && awardCount === 0) {
      const ok = window.confirm(
        'Continue without listing any activities? You can add them later from Essay Help.'
      )
      if (!ok) return
    }
    setError(null)
    const nextAnswers = { ...answers, [question.id]: cleanActivitiesValue(activitiesValue) }
    setAnswers(nextAnswers)
    advance(nextAnswers)
  }

  function goBack() {
    if (index === 0) {
      onExit()
    } else {
      setIndex(index - 1)
    }
  }

  useEffect(() => {
    function onKey(e) {
      if (paywallOpen) return
      if (question?.type !== 'single') return
      const i = OPTION_KEYS.indexOf(e.key)
      if (i !== -1 && question?.options?.[i]) choose(question.options[i].id)
      if (e.key === 'Backspace' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        goBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (error && !bank) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg text-rose-300">{error}</p>
        <button
          onClick={onExit}
          className="rounded-full border border-white/15 px-6 py-2 text-sm font-semibold hover:border-sky-400/50"
        >
          Back home
        </button>
      </div>
    )
  }

  if (!bank || submitting || loadingFollowup) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-sky-400" />
        <p className="text-slate-400">
          {loadingFollowup
            ? 'Generating tailored follow-up questions…'
            : submitting
              ? 'Scoring you against 1,900+ programs…'
              : 'Loading the quiz…'}
        </p>
      </div>
    )
  }

  const progress = (index / Math.max(questions.length, 1)) * 100
  const qtype = question.type || 'single'
  const wide = qtype === 'activities'

  return (
    <div className={`mx-auto flex min-h-screen flex-col px-6 py-8 ${wide ? 'max-w-3xl' : 'max-w-2xl'}`}>
      <AiQuestionsPaywall
        open={paywallOpen}
        user={user}
        busy={paywallBusy}
        error={error}
        onUnlock={unlockFromPaywall}
        onContinue={() => {
          setPaywallOpen(false)
          submit(answers)
        }}
        onNavigateLegal={onNavigateLegal}
      />
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={goBack}
          className="rounded-full border border-white/10 px-4 py-1.5 text-sm text-slate-400 transition hover:border-white/30 hover:text-white"
        >
          ← Back
        </button>
        <div className="text-sm font-medium text-slate-500">
          {index + 1} / {questions.length}
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div key={question.id} className="animate-fade-up mt-12 flex-1">
        {isFirstOfSection && section && (
          <div className="mb-6">
            <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-violet-300">
              {section.title}
              {section.questionRange ? ` · Q${section.questionRange}` : ''}
            </span>
            <p className="mt-2 text-sm text-slate-500">{section.blurb}</p>
          </div>
        )}
        {!isFirstOfSection && section && (
          <div className="mb-6 text-xs font-bold uppercase tracking-widest text-slate-600">
            {section.title}
            {section.questionRange ? ` · Q${section.questionRange}` : ''}
          </div>
        )}

        <h2 className="text-2xl font-bold leading-snug sm:text-3xl">{question.text}</h2>

        {qtype === 'single' && (
          <div className="mt-8 space-y-3">
            {question.options.map((opt, i) => {
              const isChosen = selected === opt.id || (!selected && answers[question.id] === opt.id)
              return (
                <button
                  key={opt.id}
                  onClick={() => choose(opt.id)}
                  className={`group flex w-full items-center gap-4 rounded-xl border px-5 py-4 text-left transition ${
                    isChosen
                      ? 'border-sky-400 bg-sky-400/10'
                      : 'border-white/10 bg-white/5 hover:border-sky-400/50 hover:bg-white/10'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${
                      isChosen
                        ? 'border-sky-400 bg-sky-400 text-slate-950'
                        : 'border-white/20 text-slate-500 group-hover:border-sky-400/50 group-hover:text-sky-300'
                    }`}
                  >
                    {OPTION_KEYS[i]}
                  </span>
                  <span className="text-[15px] leading-snug text-slate-200">{opt.label}</span>
                </button>
              )
            })}
          </div>
        )}

        {qtype === 'number' && (
          <div className="mt-8 space-y-4">
            <input
              type="number"
              value={numberValue}
              onChange={(e) => setNumberValue(e.target.value)}
              placeholder={question.input?.placeholder || 'Enter a number'}
              min={question.input?.min}
              max={question.input?.max}
              step={question.input?.step || 1}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-lg text-white outline-none ring-sky-400/40 placeholder:text-slate-600 focus:border-sky-400/50 focus:ring-2"
            />
            {error && <p className="text-sm text-rose-300">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={submitNumber}
                className="rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-8 py-3 text-sm font-bold text-white"
              >
                Continue
              </button>
              {question.input?.optional && (
                <button
                  onClick={() => {
                    const nextAnswers = { ...answers }
                    delete nextAnswers[question.id]
                    setAnswers(nextAnswers)
                    advance(nextAnswers)
                  }}
                  className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-slate-400"
                >
                  Skip
                </button>
              )}
            </div>
          </div>
        )}

        {qtype === 'text' && (
          <div className="mt-8 space-y-4">
            <textarea
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              rows={5}
              placeholder={question.placeholder || 'Write a short answer…'}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-[15px] leading-relaxed text-white outline-none ring-sky-400/40 placeholder:text-slate-600 focus:border-sky-400/50 focus:ring-2"
            />
            {error && <p className="text-sm text-rose-300">{error}</p>}
            <button
              onClick={submitText}
              className="rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-8 py-3 text-sm font-bold text-white"
            >
              Continue
            </button>
          </div>
        )}

        {qtype === 'activities' && (
          <div className="mt-6 space-y-6">
            {question.placeholder && (
              <p className="text-sm text-slate-400">{question.placeholder}</p>
            )}
            <ActivitiesEditor value={activitiesValue} onChange={setActivitiesValue} />
            {error && <p className="text-sm text-rose-300">{error}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={submitActivities}
                className="rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-8 py-3 text-sm font-bold text-white"
              >
                Continue
              </button>
              <span className="text-xs text-slate-500">
                Saved to your PRO+ profile — editable later from Essay Help.
              </span>
            </div>
          </div>
        )}
      </div>


      {qtype === 'single' && (
        <p className="mt-8 text-center text-xs text-slate-600">
          Tip: press 1–4 to answer, Backspace to go back
        </p>
      )}
    </div>
  )
}
