import { useCallback, useEffect, useState } from 'react'
import { api, fetchMe } from './api.js'
import Landing from './pages/Landing.jsx'
import CategoryHub from './pages/CategoryHub.jsx'
import Quiz from './pages/Quiz.jsx'
import Results from './pages/Results.jsx'

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
    if (!authOk && !billingOk) return

    window.history.replaceState({}, '', window.location.pathname)
    refreshUser().then(async () => {
      if (!authOk) return
      const raw = sessionStorage.getItem('pendingQuiz')
      if (!raw) return
      try {
        const pending = JSON.parse(raw)
        sessionStorage.removeItem('pendingQuiz')
        await api('/api/quiz/save', {
          method: 'POST',
          body: JSON.stringify({
            answers: pending.answers || {},
            results: pending.results || [],
          }),
        })
        setResultsPayload(pending)
        setView('results')
      } catch {
        sessionStorage.removeItem('pendingQuiz')
      }
    })
  }, [refreshUser])

  return (
    <div className="min-h-screen bg-slate-950">
      {view === 'landing' && (
        <Landing
          user={user}
          onRefreshUser={refreshUser}
          onStart={() => {
            setStartSectionId(null)
            setView('hub')
          }}
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
          onRefreshUser={refreshUser}
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
    </div>
  )
}
