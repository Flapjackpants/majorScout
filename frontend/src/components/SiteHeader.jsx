import { useState } from 'react'
import { logout, startGoogleLogin } from '../api.js'

function UserAvatar({ user, onClick }) {
  const [imgFailed, setImgFailed] = useState(false)
  const initial = (user.name || user.email || '?')[0].toUpperCase()

  const className =
    'flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 transition hover:border-sky-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60'

  if (!user.picture || imgFailed) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Switch account"
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
      title="Switch account"
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
        <button onClick={onHome} className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-violet-500 text-sm font-black text-white">
            M
          </span>
          MajorScout
        </button>
        <div className="flex items-center gap-3">
          {rightSlot}
          {user ? (
            <div className="flex items-center gap-3">
              {unlockedBadge && (
                <span className="hidden rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300 sm:inline">
                  Unlocked
                </span>
              )}
              {onMyResults && (
                <button
                  onClick={onMyResults}
                  className="hidden rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-slate-300 transition hover:border-sky-400/50 hover:text-white sm:inline"
                >
                  My results
                </button>
              )}
              <UserAvatar
                user={user}
                onClick={() => startGoogleLogin({ selectAccount: true })}
              />
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
