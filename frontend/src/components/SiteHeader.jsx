import { logout, startGoogleLogin } from '../api.js'

export default function SiteHeader({
  user,
  onHome,
  rightSlot,
  onRefreshUser,
  onMyResults,
  unlockedBadge,
}) {
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
            {user.picture ? (
              <img src={user.picture} alt="" className="h-8 w-8 rounded-full border border-white/10" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                {(user.name || user.email || '?')[0].toUpperCase()}
              </div>
            )}
            <button
              onClick={async () => {
                // #region agent log
                fetch('http://127.0.0.1:7425/ingest/d3aede32-0091-4975-a520-4c72254a3255',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'028b02'},body:JSON.stringify({sessionId:'028b02',location:'SiteHeader.jsx:signOut',message:'sign out clicked',data:{host:location.host,hasRefresh:typeof onRefreshUser==='function'},timestamp:Date.now(),hypothesisId:'A',runId:'pre-fix'})}).catch(()=>{});
                // #endregion
                await logout()
                await onRefreshUser?.()
                // #region agent log
                fetch('http://127.0.0.1:7425/ingest/d3aede32-0091-4975-a520-4c72254a3255',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'028b02'},body:JSON.stringify({sessionId:'028b02',location:'SiteHeader.jsx:afterRefresh',message:'refresh after logout finished',data:{host:location.host},timestamp:Date.now(),hypothesisId:'E',runId:'pre-fix'})}).catch(()=>{});
                // #endregion
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
