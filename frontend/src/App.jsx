import { useCallback, useEffect, useState } from 'react'
import { api, fetchAttempt, fetchAttempts, fetchMe, verifyCheckoutSession } from './api.js'
import Landing from './pages/Landing.jsx'
import CategoryHub from './pages/CategoryHub.jsx'
import Quiz from './pages/Quiz.jsx'
import Results from './pages/Results.jsx'
import History from './pages/History.jsx'
import Legal from './pages/Legal.jsx'
import EssayHelp from './pages/EssayHelp.jsx'
import Admissions from './pages/Admissions.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import UpgradeModal from './components/UpgradeModal.jsx'
import { tracker } from './lib/tracker.js'

function getInitialRoute() {
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/'
  if (path === '/privacy') return { view: 'legal', tab: 'privacy' }
  if (path === '/terms') return { view: 'legal', tab: 'terms' }
  if (path === '/disclaimer') return { view: 'legal', tab: 'disclaimer' }
  if (path === '/legal') return { view: 'legal', tab: 'privacy' }
  if (path === '/admissions') return { view: 'admissions', tab: 'privacy' }
  if (path === '/admin') return { view: 'admin', tab: 'privacy' }
  return { view: 'landing', tab: 'privacy' }
}

export default function App() {
  const [initialRoute] = useState(getInitialRoute)
  const [view, setView] = useState(initialRoute.view)
  const [legalTab, setLegalTab] = useState(initialRoute.tab)
  const [user, setUser] = useState(null)
  const [sections, setSections] = useState([])
  const [questionCounts, setQuestionCounts] = useState({})
  const [startSectionId, setStartSectionId] = useState(null)
  const [resultsPayload, setResultsPayload] = useState(null)
  const [billingNotice, setBillingNotice] = useState(null)
  const [proCelebration, setProCelebration] = useState(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [resultsFocusKey, setResultsFocusKey] = useState(0)
  const [essayProgram, setEssayProgram] = useState(null)

  const refreshUser = useCallback(() => {
    return fetchMe().then(setUser).catch(() => setUser(null))
  }, [])

  useEffect(() => {
    tracker.init()
  }, [])

  useEffect(() => {
    const pagePath = view === 'landing' ? '/' : `/${view}`
    tracker.trackPageView(pagePath, view)
  }, [view])

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
    const authErr = params.get('auth') === 'error'
    const billingParam = params.get('billing') // 'success', 'cancel', 'error'
    const sessionIdParam = params.get('session_id')
    const attemptIdParam = params.get('attempt_id')

    if (!authOk && !authErr && !billingParam && !sessionIdParam) return

    window.history.replaceState({}, '', window.location.pathname)

    if (authErr) {
      setBillingNotice({
        type: 'error',
        title: 'Sign-in Failed',
        message: 'Could not complete authentication. Please try again.',
      })
      return
    }

    if (billingParam === 'cancel') {
      setBillingNotice({
        type: 'error',
        title: 'Payment Cancelled',
        message: 'Checkout was cancelled. Your card was not charged and PRO+ was not activated.',
        attemptId: attemptIdParam,
      })
      return
    }

    if (billingParam === 'error') {
      setBillingNotice({
        type: 'error',
        title: 'Payment Error',
        message: 'An error occurred during Stripe checkout. Please try again.',
        attemptId: attemptIdParam,
      })
      return
    }

    const validSessionId =
      sessionIdParam && sessionIdParam !== '{CHECKOUT_SESSION_ID}' ? sessionIdParam : undefined

    if (billingParam === 'success' || validSessionId) {
      verifyCheckoutSession({ sessionId: validSessionId, attemptId: attemptIdParam })
        .then(async (res) => {
          await refreshUser()
          if (res.success || res.status === 'paid') {
            const targetId = res.attempt_id || attemptIdParam
            let payload = res.attempt
            if (!payload && targetId) {
              try {
                payload = await fetchAttempt(targetId)
              } catch {
                /* ignore */
              }
            }
            if (payload) {
              setResultsPayload(payload)
              setView('results')
            }
            setBillingNotice({
              type: 'success',
              title: 'PRO+ Activated',
              message: 'Your payment was successful! All PRO+ features are unlocked.',
              attemptId: targetId,
            })
            setProCelebration({
              open: true,
              attemptId: targetId,
            })
          } else if (res.status === 'processing') {
            setBillingNotice({
              type: 'info',
              title: 'Payment Processing',
              message: res.message || 'Your payment is being processed by Stripe/Link. PRO+ will unlock as soon as it confirms.',
              details: res.error,
              attemptId: attemptIdParam,
            })
          } else {
            // Check fallback: if the attempt was already unlocked (e.g. by webhook)
            if (attemptIdParam) {
              try {
                const checkAttempt = await fetchAttempt(attemptIdParam)
                if (checkAttempt?.unlocked) {
                  setResultsPayload(checkAttempt)
                  setView('results')
                  setBillingNotice({
                    type: 'success',
                    title: 'PRO+ Activated',
                    message: 'Your PRO+ results are unlocked!',
                    attemptId: attemptIdParam,
                  })
                  return
                }
              } catch {
                /* ignore */
              }
            }
            setBillingNotice({
              type: 'error',
              title: 'Payment Notice',
              message: res.message || res.error || 'Could not verify payment completion.',
              details: res.error && res.message !== res.error ? res.error : undefined,
              attemptId: attemptIdParam,
            })
          }
        })
        .catch((err) => {
          setBillingNotice({
            type: 'error',
            title: 'Payment Notice',
            message: err.message || 'Could not verify payment status with Stripe.',
            attemptId: attemptIdParam,
          })
        })
      return
    }

    if (!authOk) return
    tracker.trackLogin('google')
    refreshUser().then(async () => {
      const raw = sessionStorage.getItem('pendingQuiz')
      if (!raw) return
      try {
        tracker.trackAccountCreated('google')
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
        // Guest clicked "Unlock PRO+" on the end-of-quiz paywall before signing
        // in; pick the upgrade flow back up now that an attempt exists.
        if (pending.upgradeIntent && !data.unlocked) {
          setUpgradeOpen(true)
        }
      } catch {
        sessionStorage.removeItem('pendingQuiz')
      }
    })
  }, [refreshUser])

  useEffect(() => {
    function onPopState() {
      const route = getInitialRoute()
      setView(route.view)
      setLegalTab(route.tab)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  async function openAttempt(attemptId) {
    try {
      const payload = await fetchAttempt(attemptId)
      setResultsPayload(payload)
      setView('results')
      return true
    } catch (err) {
      alert(err.message || 'Could not open that attempt.')
      return false
    }
  }

  async function openProFeatures(preferredId) {
    // Callers may pass this straight to onClick, in which case the arg is a MouseEvent.
    const explicitId =
      typeof preferredId === 'number' || typeof preferredId === 'string' ? preferredId : null
    const targetId = explicitId || resultsPayload?.attemptId
    let opened = false
    if (targetId) {
      opened = await openAttempt(targetId)
    } else {
      try {
        const attempts = await fetchAttempts()
        if (attempts && attempts.length > 0) {
          opened = await openAttempt(attempts[0].id)
        } else {
          startQuizFlow()
          return
        }
      } catch {
        startQuizFlow()
        return
      }
    }
    if (opened) {
      // Bump the key so Results scrolls to the PRO+ essay section, even if it
      // was already the active view.
      setResultsFocusKey(Date.now())
    }
  }

  function goHistory() {
    setView('history')
  }

  function goAdmissions() {
    setView('admissions')
    if (window.location.pathname !== '/admissions') {
      window.history.pushState({ view: 'admissions' }, '', '/admissions')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goAdmin() {
    setView('admin')
    if (window.location.pathname !== '/admin') {
      window.history.pushState({ view: 'admin' }, '', '/admin')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openEssayHelp(program) {
    if (!program) return
    setEssayProgram({
      university: program.university,
      major: program.major,
      college: program.college,
      rank: program.rank,
    })
    setView('essayHelp')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function startQuizFlow() {
    setStartSectionId(null)
    setView('hub')
  }

  function openLegal(tab = 'privacy') {
    setLegalTab(tab)
    setView('legal')
    const targetPath = `/${tab}`
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ view: 'legal', tab }, '', targetPath)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goHome() {
    setView('landing')
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** In-app views (quiz/results/history/essayHelp) live at "/" so refresh is safe. */
  function resetPathToRoot() {
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {billingNotice && (
        <div
          className={`border-b px-4 py-3 text-sm transition ${
            billingNotice.type === 'success'
              ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
              : billingNotice.type === 'error'
              ? 'border-rose-500/30 bg-rose-950/70 text-rose-200'
              : 'border-sky-500/30 bg-sky-950/70 text-sky-200'
          }`}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="text-base">
                {billingNotice.type === 'success' ? '⚡' : billingNotice.type === 'error' ? '⚠️' : 'ℹ️'}
              </span>
              <div>
                <span className="font-bold">{billingNotice.title}: </span>
                <span>{billingNotice.message}</span>
                {billingNotice.details && (
                  <p className="mt-0.5 text-xs font-mono text-rose-300 opacity-90">{billingNotice.details}</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {billingNotice.type === 'success' && (
                <button
                  onClick={() => openProFeatures(billingNotice.attemptId)}
                  className="rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 px-3.5 py-1 text-xs font-black uppercase tracking-wide text-slate-950 shadow-sm transition hover:scale-105"
                >
                  ✨ View PRO+ Features & Essay Help
                </button>
              )}
              {billingNotice.type === 'error' && (
                <button
                  onClick={() => setUpgradeOpen(true)}
                  className="rounded-full border border-rose-400/40 bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-100 hover:bg-rose-500/30"
                >
                  Try Again
                </button>
              )}
              <button
                onClick={() => setBillingNotice(null)}
                className="text-xs font-bold opacity-70 hover:opacity-100"
                title="Dismiss notice"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {proCelebration?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-md">
          <div className="animate-fade-up w-full max-w-lg rounded-3xl border border-amber-400/40 bg-gradient-to-b from-slate-900 to-slate-950 p-7 text-center shadow-2xl shadow-amber-500/20">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-3xl shadow-lg shadow-amber-400/30">
              ⚡
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-300">
              Payment Confirmed
            </div>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
              Welcome to PRO+!
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Your payment was successful and PRO+ is now activated on your account. All 15 college program matches and school-specific essay approach guides are unlocked.
            </p>

            <div className="my-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Now Unlocked with PRO+
              </div>
              <ul className="mt-2.5 space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">✓</span>
                  <span><strong>#1 Best-Fit Match</strong> — Full ranking and curriculum details</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">✓</span>
                  <span><strong>PRO+ Essay Help</strong> — Essay approach strategies & personal hooks</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">✓</span>
                  <span><strong>Deeper Rankings (#9+)</strong> — Full dataset match exploration</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">✓</span>
                  <span><strong>PRO+ Profile Badge</strong> — Displayed beside your account</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => {
                const attId = proCelebration.attemptId
                setProCelebration(null)
                openProFeatures(attId)
              }}
              className="w-full rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 px-6 py-4 text-base font-black uppercase tracking-wide text-slate-950 shadow-xl shadow-amber-400/30 transition hover:scale-[1.02] hover:shadow-amber-400/50"
            >
              ✨ Access PRO+ Features & Essay Help →
            </button>

            <button
              onClick={() => setProCelebration(null)}
              className="mt-3 text-xs font-medium text-slate-400 hover:text-white"
            >
              Close and explore later
            </button>
          </div>
        </div>
      )}

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        user={user}
        attemptId={resultsPayload?.attemptId}
        feature="Upgrade to PRO+ to unlock your #1 match, deeper rankings (#9+), AI-tailored questions, and Essay Help with graded feedback."
        onNavigateLegal={openLegal}
      />

      {view === 'landing' && (
        <Landing
          user={user}
          onRefreshUser={refreshUser}
          onMyResults={goHistory}
          onAdmissions={goAdmissions}
          onOpenProFeatures={openProFeatures}
          onAdmin={user?.is_admin ? goAdmin : undefined}
          onStart={startQuizFlow}
          onNavigateLegal={openLegal}
        />
      )}

      {view === 'hub' && (
        <CategoryHub
          sections={sections}
          counts={questionCounts}
          user={user}
          onExit={goHome}
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
          onNavigateLegal={openLegal}
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
          focusEssayKey={resultsFocusKey}
          onMyResults={user ? goHistory : undefined}
          onAdmissions={user ? goAdmissions : undefined}
          onEssayHelp={openEssayHelp}
          onAdmin={user?.is_admin ? goAdmin : undefined}
          onRetake={() => {
            setResultsPayload(null)
            setStartSectionId(null)
            setView('hub')
          }}
          onHome={() => {
            setResultsPayload(null)
            goHome()
          }}
          onNavigateLegal={openLegal}
        />
      )}

      {view === 'history' && (
        <History
          user={user}
          onRefreshUser={refreshUser}
          onHome={goHome}
          onStartQuiz={startQuizFlow}
          onOpenAttempt={openAttempt}
          onOpenProFeatures={openProFeatures}
          onAdmissions={goAdmissions}
          onAdmin={user?.is_admin ? goAdmin : undefined}
          onNavigateLegal={openLegal}
        />
      )}

      {view === 'essayHelp' && (
        <EssayHelp
          payload={resultsPayload}
          program={essayProgram}
          user={user}
          onRefreshUser={refreshUser}
          onHome={() => {
            setEssayProgram(null)
            goHome()
          }}
          onBack={() => {
            setEssayProgram(null)
            setView('results')
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          onProfileSaved={(updated) => {
            // Keep the AI answers / activities in sync everywhere else.
            setResultsPayload((prev) => ({ ...(prev || {}), ...updated }))
          }}
          onOpenProFeatures={openProFeatures}
          onAdmissions={goAdmissions}
          onAdmin={user?.is_admin ? goAdmin : undefined}
          onNavigateLegal={openLegal}
        />
      )}

      {view === 'admissions' && (
        <Admissions
          user={user}
          onRefreshUser={refreshUser}
          onHome={goHome}
          onStartQuiz={() => {
            resetPathToRoot()
            startQuizFlow()
          }}
          onMyResults={
            user
              ? () => {
                  resetPathToRoot()
                  goHistory()
                }
              : undefined
          }
          onOpenProFeatures={(id) => {
            resetPathToRoot()
            openProFeatures(id)
          }}
          onAdmin={user?.is_admin ? goAdmin : undefined}
          onNavigateLegal={openLegal}
        />
      )}

      {view === 'legal' && (
        <Legal
          user={user}
          initialTab={legalTab}
          onRefreshUser={refreshUser}
          onHome={goHome}
          onStartQuiz={startQuizFlow}
          onAdmin={user?.is_admin ? goAdmin : undefined}
          onNavigateLegal={openLegal}
        />
      )}

      {view === 'admin' && (
        <AdminDashboard
          user={user}
          onHome={goHome}
          onRefreshUser={refreshUser}
          onStartQuiz={startQuizFlow}
          onAdmissions={goAdmissions}
          onOpenProFeatures={openProFeatures}
          onNavigateLegal={openLegal}
        />
      )}
    </div>
  )
}
