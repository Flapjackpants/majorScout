import { logout, startGoogleLogin } from '../api.js'

export default function SiteHeader({ user, onHome, rightSlot, onRefreshUser }) {
  return (
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
            {user.is_premium && (
              <span className="hidden rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300 sm:inline">
                Premium
              </span>
            )}
            {user.picture ? (
              <img src={user.picture} alt="" className="h-8 w-8 rounded-full border border-white/10" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                {(user.name || user.email || '?')[0].toUpperCase()}
              </div>
            )}
            <button
              onClick={async () => {
                await logout()
                onRefreshUser?.()
              }}
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
  )
}
