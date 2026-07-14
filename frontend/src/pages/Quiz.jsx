import { useEffect, useMemo, useState } from 'react'

const OPTION_KEYS = ['1', '2', '3', '4']

export default function Quiz({ onComplete, onExit }) {
  const [bank, setBank] = useState(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [selected, setSelected] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/questions')
      .then((r) => r.json())
      .then(setBank)
      .catch(() => setError('Could not load the quiz. Is the backend running?'))
  }, [])

  const questions = bank?.questions ?? []
  const question = questions[index]
  const sectionsById = useMemo(() => {
    const map = {}
    for (const s of bank?.sections ?? []) map[s.id] = s
    return map
  }, [bank])

  const section = question ? sectionsById[question.section] : null
  const isFirstOfSection =
    question && (index === 0 || questions[index - 1].section !== question.section)

  async function submit(finalAnswers) {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: finalAnswers }),
      })
      if (!res.ok) throw new Error('match failed')
      const data = await res.json()
      onComplete(data.results)
    } catch {
      setError('Something went wrong computing your matches. Please try again.')
      setSubmitting(false)
    }
  }

  function choose(optionId) {
    if (submitting) return
    setSelected(optionId)
    const nextAnswers = { ...answers, [question.id]: optionId }
    setAnswers(nextAnswers)
    // Brief pause so the selection state is visible before advancing.
    setTimeout(() => {
      setSelected(null)
      if (index + 1 < questions.length) {
        setIndex(index + 1)
      } else {
        submit(nextAnswers)
      }
    }, 220)
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
      const i = OPTION_KEYS.indexOf(e.key)
      if (i !== -1 && question?.options[i]) choose(question.options[i].id)
      if (e.key === 'Backspace') goBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (error) {
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

  if (!bank || submitting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-sky-400" />
        <p className="text-slate-400">
          {submitting ? 'Scoring you against 1,900+ programs…' : 'Loading the quiz…'}
        </p>
      </div>
    )
  }

  const progress = (index / questions.length) * 100

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-8">
      {/* Top bar */}
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
            </span>
            <p className="mt-2 text-sm text-slate-500">{section.blurb}</p>
          </div>
        )}
        {!isFirstOfSection && section && (
          <div className="mb-6 text-xs font-bold uppercase tracking-widest text-slate-600">
            {section.title}
          </div>
        )}

        <h2 className="text-2xl font-bold leading-snug sm:text-3xl">{question.text}</h2>

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
      </div>

      <p className="mt-8 text-center text-xs text-slate-600">
        Tip: press 1–4 to answer, Backspace to go back
      </p>
    </div>
  )
}
