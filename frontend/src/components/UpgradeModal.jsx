import { useState } from 'react'
import { startCheckout, startGoogleLogin } from '../api.js'

export default function UpgradeModal({ open, onClose, user, attemptId, feature, onNavigateLegal }) {
  const [loading, setLoading] = useState(false)
  if (!open) return null

  async function upgrade() {
    try {
      setLoading(true)
      if (!user) {
        startGoogleLogin()
        return
      }
      await startCheckout(attemptId)
    } catch (err) {
      alert(err.message || 'Could not start checkout.')
      setLoading(false)
    }
  }

  let cta = 'Unlock PRO+ with Stripe'
  if (loading) cta = 'Starting checkout…'
  else if (!user) cta = 'Sign in for PRO+'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
      <div className="animate-fade-up w-full max-w-md rounded-2xl border border-amber-400/30 bg-slate-900 p-6 shadow-2xl shadow-amber-500/10">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-950 shadow-sm">
            <span>⚡</span> PRO+
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
            One-time unlock
          </span>
        </div>

        <h2 className="mt-3 text-2xl font-black text-white">Unlock PRO+ Features</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {feature ||
            'Upgrade to PRO+ to unlock your #1 match, deeper program rankings (#9+), AI-tailored questions, and Essay Help with graded feedback.'}
        </p>

        <ul className="mt-5 space-y-2.5 text-sm text-slate-300">
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 text-amber-400 font-bold">✓</span>
            <div>
              <strong className="text-white">#1 Best-Fit Match</strong> — Reveal your highest-scoring program and curriculum fit.
            </div>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 text-amber-400 font-bold">✓</span>
            <div>
              <strong className="text-white">AI-Tailored Questions</strong> — Follow-ups written from your answers, plus a guided extracurriculars &amp; awards profile.
            </div>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 text-amber-400 font-bold">✓</span>
            <div>
              <strong className="text-white">PRO+ Essay Help</strong> — Paste any prompt and draft for a graded rubric with fixes written in your own voice, plus school-specific hooks.
            </div>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 text-amber-400 font-bold">✓</span>
            <div>
              <strong className="text-white">Deeper Ranks (#9+)</strong> — Full extended list of matching colleges and programs.
            </div>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 text-amber-400 font-bold">✓</span>
            <div>
              <strong className="text-white">PRO+ Account Badge</strong> — Displayed next to your profile picture across MajorScout.
            </div>
          </li>
        </ul>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <button
            onClick={upgrade}
            disabled={loading}
            className="flex-1 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-400/20 transition hover:scale-[1.02] hover:shadow-amber-400/30 disabled:opacity-60"
          >
            {cta}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/5 disabled:opacity-60"
          >
            Not now
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-500">
          By upgrading to PRO+, you agree to our{' '}
          <button
            type="button"
            onClick={() => {
              onClose()
              onNavigateLegal?.('terms')
            }}
            className="text-slate-400 underline hover:text-amber-300"
          >
            Terms of Service
          </button>{' '}
          and{' '}
          <button
            type="button"
            onClick={() => {
              onClose()
              onNavigateLegal?.('privacy')
            }}
            className="text-slate-400 underline hover:text-amber-300"
          >
            Privacy Policy
          </button>
          .
        </p>
      </div>
    </div>
  )
}
