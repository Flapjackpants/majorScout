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

function normalizeAttempt(data) {
  return {
    results: data.results,
    unlocked: data.unlocked,
    answers: data.answers,
    attemptId: data.attempt_id,
    profileSummary: data.profile_summary,
  }
}

export async function fetchAttempt(attemptId) {
  const res = await api(`/api/quiz/attempts/${attemptId}`)
  const data = await parseJsonSafe(res)
  if (!res.ok) throw new Error(data.error || 'Could not load attempt')
  return normalizeAttempt(data)
}

/** Error carrying the HTTP status + whether the server asked for an upgrade. */
class ApiError extends Error {
  constructor(message, { status, upgrade } = {}) {
    super(message)
    this.status = status
    this.upgrade = Boolean(upgrade)
  }
}

async function jsonOrThrow(res, fallbackMessage) {
  const data = await parseJsonSafe(res)
  if (!res.ok) {
    throw new ApiError(data.error || fallbackMessage, { status: res.status, upgrade: data.upgrade })
  }
  return data
}

// ── PRO+ AI questions / profile ─────────────────────────────────────────────

export async function fetchFollowupQuestions({ answers, attemptId } = {}) {
  const res = await api('/api/premium/followup', {
    method: 'POST',
    body: JSON.stringify({
      answers: answers || undefined,
      attempt_id: attemptId || undefined,
    }),
  })
  const data = await jsonOrThrow(res, 'Could not load AI questions')
  return data.questions || []
}

export async function saveProfileAnswers(attemptId, answers) {
  const res = await api('/api/premium/profile', {
    method: 'POST',
    body: JSON.stringify({ attempt_id: attemptId, answers }),
  })
  const data = await jsonOrThrow(res, 'Could not save your PRO+ profile')
  return normalizeAttempt(data)
}

// ── Essays ──────────────────────────────────────────────────────────────────

export async function gradeEssay({ attemptId, university, major, prompt, response, essayId } = {}) {
  const res = await api('/api/essays/grade', {
    method: 'POST',
    body: JSON.stringify({
      attempt_id: attemptId,
      university,
      major,
      prompt,
      response,
      essay_id: essayId || undefined,
    }),
  })
  return jsonOrThrow(res, 'Could not grade the essay')
}

export async function fetchEssays(attemptId) {
  const q = attemptId ? `?attempt_id=${encodeURIComponent(attemptId)}` : ''
  const res = await api(`/api/essays${q}`)
  const data = await jsonOrThrow(res, 'Could not load essays')
  return data.essays || []
}

export async function deleteEssay(essayId) {
  const res = await api(`/api/essays/${essayId}`, { method: 'DELETE' })
  return jsonOrThrow(res, 'Could not delete essay')
}

// ── Colleges + admissions tracker ───────────────────────────────────────────

export async function searchColleges(q, { signal } = {}) {
  const res = await api(`/api/colleges/search?q=${encodeURIComponent(q)}`, { signal })
  const data = await jsonOrThrow(res, 'College search failed')
  return { results: data.results || [], upstreamOk: data.upstream_ok !== false }
}

export async function fetchAdmissions() {
  const res = await api('/api/admissions')
  const data = await jsonOrThrow(res, 'Could not load admissions results')
  return data.results || []
}

export async function addAdmission(entry) {
  const res = await api('/api/admissions', {
    method: 'POST',
    body: JSON.stringify(entry),
  })
  const data = await jsonOrThrow(res, 'Could not save result')
  return data.result
}

export async function deleteAdmission(id) {
  const res = await api(`/api/admissions/${id}`, { method: 'DELETE' })
  return jsonOrThrow(res, 'Could not delete result')
}

// ── Admin Dashboard & Analytics ─────────────────────────────────────────────

export async function fetchAdminMetrics(range = '7d') {
  const res = await api(`/api/admin/metrics?range=${encodeURIComponent(range)}`)
  return jsonOrThrow(res, 'Could not load admin metrics')
}

export async function fetchAdminFunnel(range = '7d') {
  const res = await api(`/api/admin/funnel?range=${encodeURIComponent(range)}`)
  return jsonOrThrow(res, 'Could not load quiz funnel data')
}

export async function fetchAdminSessions({ page = 1, limit = 25, search = '', device = '' } = {}) {
  const params = new URLSearchParams()
  params.set('page', page)
  params.set('limit', limit)
  if (search) params.set('search', search)
  if (device) params.set('device', device)
  const res = await api(`/api/admin/sessions?${params.toString()}`)
  return jsonOrThrow(res, 'Could not load sessions')
}

export async function fetchAdminEvents({ limit = 50, eventType = '' } = {}) {
  const params = new URLSearchParams()
  params.set('limit', limit)
  if (eventType) params.set('event_type', eventType)
  const res = await api(`/api/admin/events?${params.toString()}`)
  return jsonOrThrow(res, 'Could not load analytics events')
}

export async function seedAdminDemo() {
  const res = await api('/api/admin/seed-demo', { method: 'POST', body: '{}' })
  return jsonOrThrow(res, 'Could not seed demo data')
}

export async function deleteAdminDemo() {
  const res = await api('/api/admin/demo-data', { method: 'DELETE' })
  return jsonOrThrow(res, 'Could not delete demo data')
}
