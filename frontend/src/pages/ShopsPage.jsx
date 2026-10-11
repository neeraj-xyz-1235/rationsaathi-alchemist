import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CircleAlert, LocateFixed, MapPin, Navigation, Phone } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { apiGet } from '../api/client.js'

L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow })

const INDIA = [20.59, 78.96]
const RADII = [2, 5, 10, 25]

export default function ShopsPage() {
  const mapEl = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)
  const [here, setHere] = useState(null)
  const [radius, setRadius] = useState(5)
  const [shops, setShops] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    map.current = L.map(mapEl.current).setView(INDIA, 5)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map.current)
    layer.current = L.layerGroup().addTo(map.current)
    return () => { map.current.remove(); map.current = null }
  }, [])

  const search = useCallback(async (point, km) => {
    setStatus('loading')
    setError('')
    try {
      const data = await apiGet(`/api/shops/nearby?lat=${point.lat}&lon=${point.lon}&radius_km=${km}`)
      setShops(data.shops || [])
      setStatus(data.status)
      layer.current.clearLayers()
      L.circleMarker([point.lat, point.lon], { radius: 8, color: '#1f6b45', fillOpacity: 0.9 }).addTo(layer.current).bindPopup('You are here')
      const bounds = [[point.lat, point.lon]]
      ;(data.shops || []).forEach((shop) => {
        L.marker([shop.lat, shop.lon]).addTo(layer.current).bindPopup(`<strong>${shop.name.replace(/[<>&"]/g, '')}</strong><br/>${shop.distance_km} km away`)
        bounds.push([shop.lat, shop.lon])
      })
      map.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 })
    } catch (searchError) {
      setShops([])
      setStatus('error')
      setError(searchError.status === 429 ? 'Too many searches. Please wait a minute and try again.' : (searchError.message || 'Could not look up shops.'))
    }
  }, [])

  function locate() {
    setError('')
    if (!navigator.geolocation) { setError('Your browser cannot share its location.'); return }
    setStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => { const point = { lat: pos.coords.latitude, lon: pos.coords.longitude }; setHere(point); search(point, radius) },
      () => { setStatus('idle'); setError('Location was not shared. Allow location access in your browser to find shops near you.') },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    )
  }

  function changeRadius(km) { setRadius(km); if (here) search(here, km) }

  return <main className="workspace-page shops-page">
    <div className="workspace-breadcrumb"><Link to="/dashboard"><ArrowLeft size={15}/> Back to dashboard</Link><span>/</span><span>Nearby ration shops</span></div>
    <div className="workspace-page-heading"><span className="workspace-page-icon"><MapPin size={24}/></span><div><p className="section-eyebrow">RATIONSAATHI WORKSPACE</p><h1>Nearby ration shops</h1><p>Shops are taken from OpenStreetMap. Coverage is incomplete, so a shop missing here may still exist.</p></div></div>
    {error && <div className="withdrawal-alert" role="alert"><CircleAlert size={18}/><span>{error}</span><button type="button" onClick={()=>setError('')}>Dismiss</button></div>}
    <section className="workspace-panel report-toolbar">
      <div className="report-actions"><button type="button" className="button button-primary" onClick={locate} disabled={status === 'loading'}><LocateFixed size={15}/> {status === 'loading' ? 'Searching…' : 'Use my location'}</button></div>
      <label className="report-month">Search radius<select value={radius} onChange={(e)=>changeRadius(Number(e.target.value))}>{RADII.map((km) => <option key={km} value={km}>{km} km</option>)}</select></label>
    </section>
    <div className="shops-map" ref={mapEl} role="application" aria-label="Map of nearby ration shops"/>
    <section className="workspace-panel">
      <div className="workspace-panel-head"><div><h2>Shops found</h2><p>{status === 'idle' ? 'Press “Use my location” to search.' : status === 'ok' ? `${shops.length} shop${shops.length === 1 ? '' : 's'} within ${radius} km.` : status === 'empty' ? `No ration shops are mapped within ${radius} km. Try a larger radius.` : status === 'unavailable' ? 'The map data service is not responding. Please try again shortly.' : status === 'loading' ? 'Searching…' : ''}</p></div></div>
      {shops.length > 0 && <div className="workspace-record-list">{shops.map((shop) => <article className="workspace-record-row" key={shop.id}><span className="workspace-record-icon rice"><MapPin size={16}/></span><div className="workspace-record-main"><strong>{shop.name}</strong><span>{shop.distance_km} km{shop.address ? ` · ${shop.address}` : ''}{shop.opening_hours ? ` · ${shop.opening_hours}` : ''}</span></div>{shop.phone && <a className="receipt-download-link" href={`tel:${shop.phone.replace(/[^+\d]/g, '')}`} aria-label={`Call ${shop.name}`}><Phone size={16}/></a>}<a className="receipt-download-link" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/directions?to=${shop.lat}%2C${shop.lon}`} aria-label={`Directions to ${shop.name}`}><Navigation size={16}/></a></article>)}</div>}
    </section>
  </main>
}
