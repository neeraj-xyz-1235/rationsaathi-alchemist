const API_BASE = '/api'

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status ?? 0
    this.code = options.code
    this.fields = options.fields
    this.retryAfter = options.retryAfter
  }
}

async function request(path, options = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
    signal,
  } = options

  const requestHeaders = {
    Accept: 'application/json',
    ...headers,
  }

  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json'
  }

  let response

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      headers: requestHeaders,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error

    throw new ApiError(
      'Unable to reach the server. Check your connection and try again.',
    )
  }

  const contentType = response.headers.get('content-type') || ''
  let data = null

  if (response.status !== 204) {
    try {
      data = contentType.includes('application/json')
        ? await response.json()
        : await response.text()
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    const detail =
      typeof data === 'string'
        ? data
        : data?.detail || data?.message || data?.error

    const error = new ApiError(
      detail || `Request failed with status ${response.status}.`,
      {
        status: response.status,
        code: data?.code,
        fields: data?.fields,
        retryAfter: Number(response.headers.get('Retry-After')) || undefined,
      },
    )

    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('rationsaathi:unauthorized'))
    }

    throw error
  }

  return data
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) =>
    request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) =>
    request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) =>
    request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
}