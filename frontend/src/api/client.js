const jsonHeaders = {
  'Content-Type': 'application/json',
}

export class ApiError extends Error {
  constructor(
    message,
    { status, code, fields, retryAfter } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
    this.retryAfter = retryAfter
  }
}

async function request(path, options = {}) {
  const { authRequired = false, ...fetchOptions } = options

  let response

  try {
    response = await fetch(path, {
      ...fetchOptions,
      credentials: 'same-origin',
      headers: {
        ...jsonHeaders,
        ...(fetchOptions.headers || {}),
      },
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error

    throw new ApiError(
      'Could not connect to the server. Please try again.',
    )
  }

  const payload =
    response.status === 204
      ? null
      : await response.json().catch(() => null)

  if (!response.ok) {
    if (
      response.status === 401 &&
      authRequired &&
      typeof window !== 'undefined'
    ) {
      window.dispatchEvent(
        new CustomEvent('rationsaathi:unauthorized', {
          detail: { path },
        }),
      )
    }

    const errorPayload = payload?.error || {}

    throw new ApiError(
      errorPayload.message ||
        errorPayload.code ||
        payload?.detail ||
        'Request failed. Please try again.',
      {
        status: response.status,
        code: errorPayload.code || payload?.code,
        fields: errorPayload.fields || payload?.fields,
        retryAfter:
          Number(
            response.headers.get('Retry-After') ||
              errorPayload.retry_after_s ||
              0,
          ) || undefined,
      },
    )
  }

  return payload
}

export const authApi = {
  login: (data) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  signup: (data) =>
    request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  me: () =>
    request('/api/auth/me', {
      method: 'GET',
      headers: {},
    }),

  logout: () =>
    request('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
}

export const apiGet = (path) =>
  request(path, {
    method: 'GET',
    authRequired: true,
    headers: {},
  })

export const apiPost = (path, data) =>
  request(path, {
    method: 'POST',
    authRequired: true,
    body: JSON.stringify(data),
  })

export const apiPut = (path, data) =>
  request(path, {
    method: 'PUT',
    authRequired: true,
    body: JSON.stringify(data),
  })

export const apiDelete = (path) =>
  request(path, {
    method: 'DELETE',
    authRequired: true,
    headers: {},
  })