import { openBillingPortal, startCheckout, startGoogleLogin } from '../api.js'

export default function UpgradeModal({ open, onClose, user, feature }) {
  if (!open) return null

  async function upgrade() {
    try {
      if (!user) {
        startGoogleLogin()
        return
      }
      await startCheckout()
    } catch (err) {
      alert(err.message || 'Could not start checkout.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
      <div className="animate-fade-up w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white">Unlock MajorScout Premium</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {feature ||
            'Get your #1 match, extended rankings (#9+), AI follow-up questions, and personalized essay approaches for every school.'}
        </p>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          <li className="flex gap-2">
            <span className="text-sky-400">✓</span> AI-tailored multiple-choice &amp; written questions
          </li>
          <li className="flex gap-2">
            <span className="text-sky-400">✓</span> Best-fit #1 plus deeper #9+ matches
          </li>
          <li className="flex gap-2">
            <span className="text-sky-400">✓</span> Essay approach guides for each school
          </li>
        </ul>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={upgrade}
            className="flex-1 rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-5 py-3 text-sm font-bold text-white"
          >
            {user ? 'Subscribe with Stripe' : 'Sign in to upgrade'}
          </button>
          <button
            onClick={onClose}
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-slate-300"
          >
            Not now
          </button>
        </div>
        {user?.is_premium && (
          <button
            onClick={() => openBillingPortal().catch(() => {})}
            className="mt-3 w-full text-center text-xs text-slate-500 underline"
          >
            Manage subscription
          </button>
        )}
      </div>
    </div>
  )
}
