import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

export default function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="app-loading" role="status">
        Checking your session…
      </div>
    )
  }

  if (!user) {
    const next = encodeURIComponent(
      location.pathname + location.search,
    )

    return (
      <Navigate
        to={`/login?next=${next}`}
        replace
        state={{ reason: 'auth-required' }}
      />
    )
  }

  return <Outlet />
}