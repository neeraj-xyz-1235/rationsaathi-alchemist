import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { authApi } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    // A 401 means "not logged in". A 429 (rate limit), a 5xx or a dropped connection says
    // nothing about the session, so retry a couple of times before giving up; otherwise a
    // valid session would look like a logout (and RequireAuth would bounce to /login).
    const MAX_TRIES = 3

    try {
      for (let attempt = 1; attempt <= MAX_TRIES; attempt += 1) {
        try {
          const data = await authApi.me()
          const currentUser = data?.user || data || null
          setUser(currentUser)
          return currentUser
        } catch (error) {
          if (error.status === 401 || error.status === 404) {
            setUser(null)
            return null
          }

          const transient =
            !error.status || error.status === 429 || error.status >= 500

          if (!transient || attempt === MAX_TRIES) {
            console.error(
              'Unable to restore RationSaathi session:',
              error.message,
            )
            return null
          }

          const waitMs = Math.min(
            Math.max((error.retryAfter || 0) * 1000, 800 * attempt),
            5000,
          )
          await new Promise((resolve) => setTimeout(resolve, waitMs))
        }
      }

      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = useCallback(async (credentials) => {
    const data = await authApi.login(credentials)
    setUser(data?.user || data || null)
    return data
  }, [])

  const signup = useCallback(async (details) => {
    const data = await authApi.signup(details)
    setUser(data?.user || data || null)
    return data
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      signup,
      logout,
      refreshUser,
    }),
    [user, loading, login, signup, logout, refreshUser],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)

  if (!value) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return value
}