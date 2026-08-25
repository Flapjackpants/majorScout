/** Shared fetch that always sends session cookies. */
export async function api(path, options = {}) {
  const { headers: extraHeaders, ...rest } = options
  const res = await fetch(path, {
    credentials: 'include',
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(extraHeaders || {}),
    },
  })
  return res
}

export async function fetchMe() {
  const res = await api('/api/auth/me')
  if (!res.ok) return null
  const data = await res.json()
  // #region agent log
  fetch('http://127.0.0.1:7425/ingest/d3aede32-0091-4975-a520-4c72254a3255',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'028b02'},body:JSON.stringify({sessionId:'028b02',location:'api.js:fetchMe',message:'fetchMe result',data:{ok:res.ok,status:res.status,hasUser:!!data.user,host:location.host},timestamp:Date.now(),hypothesisId:'D',runId:'pre-fix'})}).catch(()=>{});
  // #endregion
  return data.user
}

export function startGoogleLogin() {
  window.location.href = '/api/auth/google'
}

export async function logout() {
  // #region agent log
  fetch('http://127.0.0.1:7425/ingest/d3aede32-0091-4975-a520-4c72254a3255',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'028b02'},body:JSON.stringify({sessionId:'028b02',location:'api.js:logout:start',message:'logout starting',data:{host:location.host,origin:location.origin},timestamp:Date.now(),hypothesisId:'B',runId:'pre-fix'})}).catch(()=>{});
  // #endregion
  const res = await api('/api/auth/logout', { method: 'POST', body: '{}' })
  let body = null
  try {
    body = await res.clone().json()
  } catch {
    body = null
  }
  // #region agent log
  fetch('http://127.0.0.1:7425/ingest/d3aede32-0091-4975-a520-4c72254a3255',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'028b02'},body:JSON.stringify({sessionId:'028b02',location:'api.js:logout:done',message:'logout response',data:{ok:res.ok,status:res.status,dbg:body&&body._dbg?body._dbg:null,host:location.host},timestamp:Date.now(),hypothesisId:'C',runId:'pre-fix'})}).catch(()=>{});
  // #endregion
  return res
}

export async function startCheckout(attemptId) {
  if (!attemptId) throw new Error('Save your quiz results first, then unlock.')
  const res = await api('/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ attempt_id: attemptId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Checkout failed')
  window.location.href = data.url
}

export async function fetchAttempts() {
  const res = await api('/api/quiz/attempts')
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not load attempts')
  return data.attempts || []
}

export async function fetchAttempt(attemptId) {
  const res = await api(`/api/quiz/attempts/${attemptId}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Could not load attempt')
  return {
    results: data.results,
    unlocked: data.unlocked,
    answers: data.answers,
    attemptId: data.attempt_id,
    profileSummary: data.profile_summary,
  }
}
