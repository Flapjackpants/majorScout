import { startCheckout, startGoogleLogin } from '../api.js'

export default function UpgradeModal({ open, onClose, user, attemptId, feature }) {
  if (!open) return null

  async function upgrade() {
    try {
      if (!user) {
        startGoogleLogin()
        return
      }
      if (!attemptId) {
        alert('Sign in and save your quiz results first, then unlock this result set.')
        return
      }
      await startCheckout(attemptId)
    } catch (err) {
      alert(err.message || 'Could not start checkout.')
    }
  }

  let cta = 'Unlock with Stripe'
  if (!user) cta = 'Sign in to unlock'
  else if (!attemptId) cta = 'Save results to unlock'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
      <div className="animate-fade-up w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white">Unlock this result set</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {feature ||
            'One-time unlock for this quiz: your #1 match, deeper rankings (#9+), and essay approaches for every school.'}
        </p>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          <li className="flex gap-2">
            <span className="text-sky-400">✓</span> Best-fit #1 plus deeper #9+ matches
          </li>
          <li className="flex gap-2">
            <span className="text-sky-400">✓</span> Essay approach guides for each school
          </li>
          <li className="flex gap-2">
            <span className="text-sky-400">✓</span> Tied to your account — reopen anytime
          </li>
        </ul>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={upgrade}
            className="flex-1 rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-5 py-3 text-sm font-bold text-white"
          >
            {cta}
          </button>
          <button
            onClick={onClose}
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-slate-300"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
