import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { apiGet } from '../../api/client.js'

export default function RequireHouseholdProfile() {
  const location = useLocation()
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    apiGet('/api/household/profile')
      .then((data) => {
        if (!active) return
        const profile = data?.profile || data
        setStatus(profile?.is_complete || profile?.profile_complete ? 'complete' : 'incomplete')
      })
      .catch((error) => {
        if (!active) return
        if (error.status === 404) setStatus('incomplete')
        else {
          setMessage(error.message || 'Could not check your household profile.')
          setStatus('error')
        }
      })

    return () => { active = false }
  }, [location.pathname])

  if (status === 'loading') return <div className="app-loading" role="status">Checking your household profile…</div>
  if (status === 'incomplete') return <Navigate to="/setup" replace state={{ from: location.pathname }} />
  if (status === 'error') return <main className="profile-gate-error"><h1>We couldn't load your household profile</h1><p>{message}</p><p>The household-profile API must be available before account pages can load.</p><button type="button" className="button button-primary" onClick={() => window.location.reload()}>Try again</button></main>
  return <Outlet />
}
