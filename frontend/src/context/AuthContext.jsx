import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authApi } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const data = await authApi.me()
      setUser(data?.user || data || null)
    } catch (error) {
      if (error.status === 401 || error.status === 404) setUser(null)
      // A server outage should not keep guest access blocked.
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { refreshUser() }, [refreshUser])
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
    try { await authApi.logout() } finally { setUser(null) }
  }, [])
  const value = useMemo(() => ({ user, loading, login, signup, logout, refreshUser }), [user, loading, login, signup, logout, refreshUser])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
