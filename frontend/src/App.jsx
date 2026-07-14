import { useState } from 'react'
import Landing from './pages/Landing.jsx'
import Quiz from './pages/Quiz.jsx'
import Results from './pages/Results.jsx'

export default function App() {
  const [view, setView] = useState('landing')
  const [results, setResults] = useState(null)

  return (
    <div className="min-h-screen bg-slate-950">
      {view === 'landing' && <Landing onStart={() => setView('quiz')} />}
      {view === 'quiz' && (
        <Quiz
          onComplete={(matches) => {
            setResults(matches)
            setView('results')
          }}
          onExit={() => setView('landing')}
        />
      )}
      {view === 'results' && (
        <Results
          results={results}
          onRetake={() => {
            setResults(null)
            setView('quiz')
          }}
          onHome={() => setView('landing')}
        />
      )}
    </div>
  )
}
