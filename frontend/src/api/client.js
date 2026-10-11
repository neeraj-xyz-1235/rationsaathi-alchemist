const jsonHeaders = { 'Content-Type': 'application/json' }

export class ApiError extends Error {
  constructor(message, { status, code, fields, retryAfter, payload } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
    this.retryAfter = retryAfter
    this.payload = payload
  }
}

async function request(path, options = {}) {
  const { authRequired = false, ...fetchOptions } = options
  const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData
  const headers = { ...(isFormData ? {} : jsonHeaders), ...(fetchOptions.headers || {}) }
  if (isFormData) delete headers['Content-Type']

  let response
  try {
    response = await fetch(path, {
      ...fetchOptions,
      credentials: 'same-origin',
      headers,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('Could not connect to the server. Please try again.')
  }

  const contentType = response.headers.get('content-type') || ''
  const payload = response.status === 204
    ? null
    : contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null)

  if (!response.ok) {
    if (response.status === 401 && authRequired && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rationsaathi:unauthorized', { detail: { path } }))
    }
    const error = payload?.error || {}
    const message = error.message || payload?.detail || payload?.message || (typeof payload === 'string' ? payload : '') || 'Request failed. Please try again.'
    throw new ApiError(message, {
      status: response.status,
      code: error.code || payload?.code,
      fields: error.fields || payload?.fields,
      retryAfter: Number(response.headers.get('Retry-After') || error.retry_after_s || 0),
      payload,
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

export const apiGet = (path) => request(path, { method: 'GET', authRequired: true, headers: {} })
export const apiPost = (path, data) => request(path, { method: 'POST', authRequired: true, body: data instanceof FormData ? data : JSON.stringify(data) })
export const apiPut = (path, data) => request(path, { method: 'PUT', authRequired: true, body: data instanceof FormData ? data : JSON.stringify(data) })
export const apiDelete = (path) => request(path, { method: 'DELETE', authRequired: true, headers: {} })
