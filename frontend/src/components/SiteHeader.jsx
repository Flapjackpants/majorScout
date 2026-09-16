import { useState } from 'react'
import { logout, startGoogleLogin } from '../api.js'
import logo from '../assets/logo.png'

function UserAvatar({ user, onClick }) {
  const [imgFailed, setImgFailed] = useState(false)
  const initial = (user.name || user.email || '?')[0].toUpperCase()

  const proRing = user.is_pro ? 'ring-2 ring-amber-400/80' : ''
  const className =
    `flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 ${proRing} transition hover:border-sky-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60`

  if (!user.picture || imgFailed) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={user.is_pro ? 'PRO+ Account · Switch account' : 'Switch account'}
        aria-label="Switch account"
        className={`${className} bg-white/10 text-xs font-bold`}
      >
        {initial}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={user.is_pro ? 'PRO+ Account · Switch account' : 'Switch account'}
      aria-label="Switch account"
      className={className}
    >
      <img
        src={user.picture}
        alt=""
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover"
        onError={() => setImgFailed(true)}
      />
    </button>
  )
}

export default function SiteHeader({
  user,
  onHome,
  rightSlot,
  onRefreshUser,
  onMyResults,
  onAdmissions,
  onOpenProFeatures,
  onAdmin,
  unlockedBadge,
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function confirmSignOut() {
    setSigningOut(true)
    try {
      await logout()
      await onRefreshUser?.()
      setConfirmOpen(false)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <button onClick={onHome} className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
          <img
            src={logo}
            alt="MajorScout logo"
            className="h-9 w-9 shrink-0 rounded-full object-contain"
          />
          MajorScout
        </button>
        <div className="flex items-center gap-3">
          {rightSlot}
          {user ? (
            <div className="flex items-center gap-3">
              {user.is_admin && onAdmin && (
                <button
                  type="button"
                  onClick={onAdmin}
                  className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 text-xs font-bold text-sky-200 shadow-sm transition hover:scale-105 hover:bg-sky-500/25 hover:border-sky-400"
                  title="Open Admin Analytics Dashboard"
                >
                  <svg className="h-3.5 w-3.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                  <span className="hidden sm:inline">Admin</span> Dashboard
                </button>
              )}
              {unlockedBadge && (
                <span className="hidden rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300 sm:inline">
                  ⚡ PRO+
                </span>
              )}
              {onOpenProFeatures && user.is_pro && (
                <button
                  onClick={() => onOpenProFeatures()}
                  className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-md shadow-amber-400/25 transition hover:scale-105 hover:shadow-amber-400/40"
                >
                  <span>✨</span> PRO+ Features & Essay Help
                </button>
              )}
              {onAdmissions && (
                <button
                  onClick={onAdmissions}
                  className="hidden rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-slate-300 transition hover:border-sky-400/50 hover:text-white lg:inline"
                >
                  Admissions tracker
                </button>
              )}
              {onMyResults && (
                <button
                  onClick={onMyResults}
                  className="hidden rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-slate-300 transition hover:border-sky-400/50 hover:text-white sm:inline"
                >
                  My results
                </button>
              )}
              <div className="flex items-center gap-2">
                <UserAvatar
                  user={user}
                  onClick={() => startGoogleLogin({ selectAccount: true })}
                />
                {user.is_pro && (
                  <span
                    title="PRO+ Account Active"
                    className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-slate-950 shadow-md shadow-amber-400/25 ring-1 ring-amber-300/50"
                  >
                    <span>⚡</span> PRO+
                  </span>
                )}
              </div>
              <button
                onClick={() => setConfirmOpen(true)}
                className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-slate-300 transition hover:border-sky-400/50 hover:text-white"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={startGoogleLogin}
              className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-400/50 hover:text-white"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <div className="animate-fade-up w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white">Sign out?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              You can sign back in anytime with Google.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={confirmSignOut}
                disabled={signingOut}
                className="flex-1 rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={signingOut}
                className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-slate-300 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
