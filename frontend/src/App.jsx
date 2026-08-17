import { useCallback, useEffect, useState } from 'react'
import { api, fetchAttempt, fetchMe } from './api.js'
import Landing from './pages/Landing.jsx'
import CategoryHub from './pages/CategoryHub.jsx'
import Quiz from './pages/Quiz.jsx'
import Results from './pages/Results.jsx'
import History from './pages/History.jsx'

export default function App() {
  const [view, setView] = useState('landing')
  const [user, setUser] = useState(null)
  const [sections, setSections] = useState([])
  const [questionCounts, setQuestionCounts] = useState({})
  const [startSectionId, setStartSectionId] = useState(null)
  const [resultsPayload, setResultsPayload] = useState(null)

  const refreshUser = useCallback(() => {
    return fetchMe().then(setUser).catch(() => setUser(null))
  }, [])

  useEffect(() => {
    refreshUser()
    fetch('/api/questions')
      .then((r) => r.json())
      .then((data) => {
        setSections(data.sections || [])
        const counts = {}
        for (const q of data.questions || []) {
          counts[q.section] = (counts[q.section] || 0) + 1
        }
        setQuestionCounts(counts)
      })
      .catch(() => {})
  }, [refreshUser])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const authOk = params.get('auth') === 'success'
    const billingOk = params.get('billing') === 'success'
    const attemptIdParam = params.get('attempt_id')
    if (!authOk && !billingOk) return

    window.history.replaceState({}, '', window.location.pathname)
    refreshUser().then(async () => {
      if (billingOk && attemptIdParam) {
        try {
          let payload = await fetchAttempt(attemptIdParam)
          // Webhook may lag briefly after Checkout redirect.
          for (let i = 0; i < 5 && !payload.unlocked; i++) {
            await new Promise((r) => setTimeout(r, 800))
            payload = await fetchAttempt(attemptIdParam)
          }
          setResultsPayload(payload)
          setView('results')
        } catch {
          /* ignore — user can open from history */
        }
        return
      }

      if (!authOk) return
      const raw = sessionStorage.getItem('pendingQuiz')
      if (!raw) return
      try {
        const pending = JSON.parse(raw)
        sessionStorage.removeItem('pendingQuiz')
        const res = await api('/api/quiz/save', {
          method: 'POST',
          body: JSON.stringify({
            answers: pending.answers || {},
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'save failed')
        setResultsPayload({
          results: data.results || pending.results || [],
          unlocked: data.unlocked,
          answers: pending.answers || {},
          attemptId: data.attempt_id,
          profileSummary: data.profile_summary || pending.profileSummary,
        })
        setView('results')
      } catch {
        sessionStorage.removeItem('pendingQuiz')
      }
    })
  }, [refreshUser])

  async function openAttempt(attemptId) {
    try {
      const payload = await fetchAttempt(attemptId)
      setResultsPayload(payload)
      setView('results')
    } catch (err) {
      alert(err.message || 'Could not open that attempt.')
    }
  }

  function goHistory() {
    setView('history')
  }

  function startQuizFlow() {
    setStartSectionId(null)
    setView('hub')
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {view === 'landing' && (
        <Landing
          user={user}
          onRefreshUser={refreshUser}
          onMyResults={goHistory}
          onStart={startQuizFlow}
        />
      )}

      {view === 'hub' && (
        <CategoryHub
          sections={sections}
          counts={questionCounts}
          user={user}
          onExit={() => setView('landing')}
          onStartAll={() => {
            setStartSectionId(null)
            setView('quiz')
          }}
          onStartCategory={(sectionId) => {
            setStartSectionId(sectionId)
            setView('quiz')
          }}
        />
      )}

      {view === 'quiz' && (
        <Quiz
          user={user}
          startSectionId={startSectionId}
          includePremiumFollowup
          onExit={() => setView('hub')}
          onComplete={(payload) => {
            setResultsPayload(payload)
            setView('results')
          }}
        />
      )}

      {view === 'results' && (
        <Results
          payload={resultsPayload}
          user={user}
          onMyResults={user ? goHistory : undefined}
          onRetake={() => {
            setResultsPayload(null)
            setStartSectionId(null)
            setView('hub')
          }}
          onHome={() => {
            setResultsPayload(null)
            setView('landing')
          }}
        />
      )}

      {view === 'history' && (
        <History
          user={user}
          onRefreshUser={refreshUser}
          onHome={() => setView('landing')}
          onStartQuiz={startQuizFlow}
          onOpenAttempt={openAttempt}
        />
      )}
    </div>
  )
}
