// Nearby ration shops is a PLANNED feature. GET /api/shops/nearby honestly answers "planned" with
// an empty list; we never show invented shops. Location is only requested when the user asks, is
// used for that one request, and is not stored or logged by the server.
import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { api } from '../../api/endpoints.js'
import { errorText } from '../messages.js'
import { Alert, PageHead } from '../ui.jsx'

export default function ShopsPage() {
  const [state, setState] = useState({ phase: 'idle', message: '' })

  function check() {
    if (!navigator.geolocation) { setState({ phase: 'done', message: '' }); return }
    setState({ phase: 'working', message: '' })
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          await api.shopsNearby(coords.latitude.toFixed(4), coords.longitude.toFixed(4))
          setState({ phase: 'done', message: '' })
        } catch (e) { setState({ phase: 'error', message: errorText(e) }) }
      },
      () => setState({ phase: 'done', message: 'Location was not shared, which is fine: there is nothing to look up yet.' }),
      { timeout: 8000 },
    )
  }

  return (
    <main className="rs-page" id="shops">
      <PageHead title="Nearby ration shops" subtitle="Finding your nearest ration shop is planned, but it is not available yet." />
      <div className="rs-panel rs-empty">
        <MapPin size={36} aria-hidden="true" color="var(--color-primary)" />
        <h2>Coming soon</h2>
        <p>Verified shop locations are not available yet, so we are not showing any. We will not display a shop unless it comes from an official source.</p>
        <button type="button" className="button button-outline" onClick={check} disabled={state.phase === 'working'}>
          {state.phase === 'working' ? 'Checking…' : 'Check again with my location'}
        </button>
        {state.phase === 'done' && <div style={{ marginTop: 14, textAlign: 'left' }}><Alert kind="info">{state.message || 'Still planned: no shop data is available yet. Your location was not stored.'}</Alert></div>}
        {state.phase === 'error' && <div style={{ marginTop: 14, textAlign: 'left' }}><Alert kind="bad">{state.message}</Alert></div>}
      </div>
    </main>
  )
}
