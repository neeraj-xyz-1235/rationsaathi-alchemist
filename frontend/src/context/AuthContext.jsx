import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { api } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get('/auth/me')
      const currentUser = response?.user ?? response
      setUser(currentUser ?? null)
      return currentUser ?? null
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        setUser(null)
        return null
      }
      throw error
    }
  }, [])

  useEffect(() => {
    let active = true

    async function initialise() {
      try {
        const response = await api.get('/auth/me')
        if (active) {
          setUser(response?.user ?? response ?? null)
        }
      } catch (error) {
        if (active && (error.status === 401 || error.status === 403)) {
          setUser(null)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    initialise()
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (credentials) => {
    await api.post('/auth/login', credentials)
    return refreshUser()
  }, [refreshUser])

  const signup = useCallback(async (details) => {
    await api.post('/auth/register', details)
    return refreshUser()
  }, [refreshUser])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {})
    } finally {
      setUser(null)
    }
  }, [])

  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    refreshUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}