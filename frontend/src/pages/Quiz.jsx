import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

const OPTION_KEYS = ['1', '2', '3', '4']

export default function Quiz({
  onComplete,
  onExit,
  user,
  startSectionId,
  includePremiumFollowup,
}) {
  const [bank, setBank] = useState(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [selected, setSelected] = useState(null)
  const [numberValue, setNumberValue] = useState('')
  const [textValue, setTextValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingFollowup, setLoadingFollowup] = useState(false)
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
      ? { title: 'Premium follow-up', blurb: 'Tailored from your answers so far.' }
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
    } else {
      setSelected(existing || null)
      setNumberValue('')
      setTextValue('')
    }
  }, [question?.id])

  async function submit(finalAnswers) {
    setSubmitting(true)
    setError(null)
    try {
      const res = await api('/api/match', {
        method: 'POST',
        body: JSON.stringify({ answers: finalAnswers }),
      })
      if (!res.ok) throw new Error('match failed')
      const data = await res.json()
      onComplete({
        results: data.results,
        isPremium: data.is_premium,
        answers: finalAnswers,
        attemptId: data.attempt_id,
        profileSummary: data.profile_summary,
      })
    } catch {
      setError('Something went wrong computing your matches. Please try again.')
      setSubmitting(false)
    }
  }

  async function maybeLoadFollowup(currentAnswers) {
    if (!includePremiumFollowup || !user?.is_premium) {
      await submit(currentAnswers)
      return
    }
    setLoadingFollowup(true)
    try {
      const res = await api('/api/premium/followup', {
        method: 'POST',
        body: JSON.stringify({ answers: currentAnswers }),
      })
      if (res.status === 403) {
        await submit(currentAnswers)
        return
      }
      if (!res.ok) throw new Error('followup failed')
      const data = await res.json()
      const extra = data.questions || []
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

  function advance(nextAnswers) {
    setSelected(null)
    if (index + 1 < questions.length) {
      setIndex(index + 1)
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

  function goBack() {
    if (index === 0) {
      onExit()
    } else {
      setIndex(index - 1)
    }
  }

  useEffect(() => {
    function onKey(e) {
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

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-8">
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
      </div>

      {qtype === 'single' && (
        <p className="mt-8 text-center text-xs text-slate-600">
          Tip: press 1–4 to answer, Backspace to go back
        </p>
      )}
    </div>
  )
}
