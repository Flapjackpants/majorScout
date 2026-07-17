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

export function startGoogleLogin() {
  window.location.href = '/api/auth/google'
}

export async function logout() {
  await api('/api/auth/logout', { method: 'POST', body: '{}' })
}

export async function startCheckout() {
  const res = await api('/api/billing/checkout', { method: 'POST', body: '{}' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Checkout failed')
  window.location.href = data.url
}

export async function openBillingPortal() {
  const res = await api('/api/billing/portal', { method: 'POST', body: '{}' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Portal failed')
  window.location.href = data.url
}
