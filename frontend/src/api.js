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
  return data.user
}

export function startGoogleLogin({ selectAccount = false } = {}) {
  const q = selectAccount ? '?prompt=select_account' : ''
  window.location.href = `/api/auth/google${q}`
}

export async function logout() {
  await api('/api/auth/logout', { method: 'POST', body: '{}' })
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
