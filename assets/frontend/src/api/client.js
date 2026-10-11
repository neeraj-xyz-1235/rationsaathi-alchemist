const jsonHeaders = { 'Content-Type': 'application/json' }

export class ApiError extends Error {
  constructor(message, { status, code, fields, retryAfter } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
    this.retryAfter = retryAfter
  }
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: { ...jsonHeaders, ...(options.headers || {}) },
  })
  const payload = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const error = payload?.error || {}
    throw new ApiError(error.message || error.code || 'Request failed. Please try again.', {
      status: response.status, code: error.code, fields: error.fields,
      retryAfter: Number(response.headers.get('Retry-After') || error.retry_after_s || 0),
    })
  }
  return payload
}

export const authApi = {
  login: (data) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  signup: (data) => request('/api/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request('/api/auth/me', { method: 'GET', headers: {} }),
  logout: () => request('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) }),
}
