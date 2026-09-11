/** Helper to safely parse responses and avoid "JSON.parse: unexpected character" errors. */
async function parseJsonSafe(res) {
  try {
    const text = await res.text()
    if (!text) {
      return { ok: res.ok, status: res.status, error: res.ok ? null : `Server error (${res.status})` }
    }
    const data = JSON.parse(text)
    return { ok: res.ok, status: res.status, ...data }
  } catch {
    const errorMsg =
      res.status === 404
        ? 'Endpoint not found (404). Please ensure the backend server is running.'
        : res.status === 502 || res.status === 504
        ? 'Backend service unavailable. Please check that the backend is running.'
        : `Server returned non-JSON error (${res.status})`
    return { ok: false, status: res.status, error: errorMsg }
  }
}

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
  try {
    const res = await api('/api/auth/me')
    if (!res.ok) return null
    const data = await parseJsonSafe(res)
    return data?.user || null
  } catch {
    return null
  }
}

export function startGoogleLogin({ selectAccount = false } = {}) {
  const q = selectAccount ? '?prompt=select_account' : ''
  window.location.href = `/api/auth/google${q}`
}

export async function logout() {
  await api('/api/auth/logout', { method: 'POST', body: '{}' })
}

export async function startCheckout(attemptId) {
  const res = await api('/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify(attemptId ? { attempt_id: attemptId } : {}),
  })
  const data = await parseJsonSafe(res)
  if (!res.ok || !data.url) throw new Error(data.error || 'Checkout failed')
  window.location.href = data.url
}

export async function verifyCheckoutSession({ sessionId, attemptId } = {}) {
  try {
    const res = await api('/api/billing/verify-session', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId || undefined,
        attempt_id: attemptId || undefined,
      }),
    })
    return await parseJsonSafe(res)
  } catch (err) {
    return {
      ok: false,
      success: false,
      status: 'network_error',
      error: err.message || 'Could not connect to server.',
      message: 'Could not connect to payment verification server.',
    }
  }
}

export async function fetchAttempts() {
  const res = await api('/api/quiz/attempts')
  const data = await parseJsonSafe(res)
  if (!res.ok) throw new Error(data.error || 'Could not load attempts')
  return data.attempts || []
}

export async function fetchAttempt(attemptId) {
  const res = await api(`/api/quiz/attempts/${attemptId}`)
  const data = await parseJsonSafe(res)
  if (!res.ok) throw new Error(data.error || 'Could not load attempt')
  return {
    results: data.results,
    unlocked: data.unlocked,
    answers: data.answers,
    attemptId: data.attempt_id,
    profileSummary: data.profile_summary,
  }
}
