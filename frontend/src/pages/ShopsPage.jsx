import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CircleAlert, LocateFixed, MapPin, Navigation, Phone, Plus, Trash2 } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { apiDelete, apiGet, apiPost } from '../api/client.js'
import { useLang } from '../i18n/index.jsx'

L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow })

const INDIA = [20.59, 78.96]
const RADII = [2, 5, 10, 25]
const clean = (text) => String(text).replace(/[<>&"]/g, '')
const EMPTY = { name: '', address: '', phone: '' }

export default function ShopsPage() {
  const { t } = useLang()
  const tRef = useRef(t)
  tRef.current = t                       // map popups are built outside React, so they read the latest t
  const mapEl = useRef(null)
  const map = useRef(null)
  const osmLayer = useRef(null)
  const savedLayer = useRef(null)
  const draftMarker = useRef(null)
  const [here, setHere] = useState(null)
  const [radius, setRadius] = useState(5)
  const [shops, setShops] = useState([])
  const [saved, setSaved] = useState([])
  const [draft, setDraft] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    map.current = L.map(mapEl.current).setView(INDIA, 5)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map.current)
    osmLayer.current = L.layerGroup().addTo(map.current)
    savedLayer.current = L.layerGroup().addTo(map.current)
    map.current.on('click', (event) => {
      const point = { lat: event.latlng.lat, lon: event.latlng.lng }
      setDraft(point)
      if (draftMarker.current) draftMarker.current.setLatLng(event.latlng)
      else draftMarker.current = L.marker(event.latlng).addTo(map.current)
    })
    apiGet('/api/shops/saved').then((data) => setSaved(data.shops || [])).catch(() => {})
    return () => { map.current.remove(); map.current = null; draftMarker.current = null }
  }, [])

  useEffect(() => {
    if (!savedLayer.current) return
    savedLayer.current.clearLayers()
    saved.forEach((shop) => {
      L.circleMarker([shop.lat, shop.lon], { radius: 9, color: '#b45f06', fillColor: '#f0a04b', fillOpacity: 0.9 })
        .addTo(savedLayer.current).bindPopup(`<strong>${clean(shop.name)}</strong><br/>${tRef.current('sh_saved_by_you')}`)
    })
  }, [saved])

  const search = useCallback(async (point, km) => {
    setStatus('loading')
    setError('')
    try {
      const data = await apiGet(`/api/shops/nearby?lat=${point.lat}&lon=${point.lon}&radius_km=${km}`)
      setShops(data.shops || [])
      setStatus(data.status)
      osmLayer.current.clearLayers()
      L.circleMarker([point.lat, point.lon], { radius: 8, color: '#1f6b45', fillOpacity: 0.9 }).addTo(osmLayer.current).bindPopup(tRef.current('sh_you'))
      const bounds = [[point.lat, point.lon]]
      ;(data.shops || []).forEach((shop) => {
        L.marker([shop.lat, shop.lon]).addTo(osmLayer.current).bindPopup(`<strong>${clean(shop.name)}</strong><br/>${tRef.current('sh_away', { n: shop.distance_km })}`)
        bounds.push([shop.lat, shop.lon])
      })
      map.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 })
    } catch (searchError) {
      setShops([])
      setStatus('error')
      setError(searchError.status === 429 ? tRef.current('sh_err_many') : tRef.current('sh_err_lookup'))
    }
  }, [])

  function locate() {
    setError('')
    if (!navigator.geolocation) { setError(t('sh_err_nogeo')); return }
    setStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => { const point = { lat: pos.coords.latitude, lon: pos.coords.longitude }; setHere(point); search(point, radius) },
      (failure) => {
        setStatus('idle')
        setError(failure.code === 1 ? t('sh_err_denied') : failure.code === 3 ? t('sh_err_timeout') : t('sh_err_unavailable'))
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 },
    )
  }

  function searchCentre() {
    setError('')
    const centre = map.current.getCenter()
    const point = { lat: centre.lat, lon: centre.lng }
    setHere(point)
    search(point, radius)
  }

  function changeRadius(km) { setRadius(km); if (here) search(here, km) }

  function clearDraft() {
    setDraft(null)
    setForm(EMPTY)
    if (draftMarker.current) { draftMarker.current.remove(); draftMarker.current = null }
  }

  async function saveShop(event) {
    event.preventDefault()
    if (!draft || !form.name.trim()) return
    setSaving(true)
    setError('')
    try {
      const result = await apiPost('/api/shops/saved', { name: form.name, lat: draft.lat, lon: draft.lon, address: form.address, phone: form.phone })
      setSaved((list) => [...list, result.shop])
      clearDraft()
    } catch (saveError) {
      setError(saveError.code === 'TOO_MANY_SAVED_SHOPS' ? t('sh_err_limit') : t('sh_err_save'))
    } finally { setSaving(false) }
  }

  async function removeShop(id) {
    try { await apiDelete(`/api/shops/saved/${id}`); setSaved((list) => list.filter((shop) => shop.id !== id)) }
    catch { setError(t('sh_err_remove')) }
  }

  const statusText = status === 'idle' ? t('sh_idle') : status === 'ok' ? t('sh_found', { n: shops.length, r: radius }) : status === 'empty' ? t('sh_empty', { r: radius }) : status === 'unavailable' ? t('sh_unavailable') : status === 'loading' ? t('sh_loading') : ''
  const actions = (shop) => <>
    {shop.phone && <a className="receipt-download-link" href={`tel:${shop.phone.replace(/[^+\d]/g, '')}`} aria-label={t('sh_call', { name: shop.name })}><Phone size={16}/></a>}
    <a className="receipt-download-link" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/directions?to=${shop.lat}%2C${shop.lon}`} aria-label={t('sh_directions', { name: shop.name })}><Navigation size={16}/></a>
  </>

  return <main className="workspace-page shops-page">
    <div className="workspace-breadcrumb"><Link to="/dashboard"><ArrowLeft size={15}/> {t('sh_back')}</Link><span>/</span><span>{t('sh_breadcrumb')}</span></div>
    <div className="workspace-page-heading"><span className="workspace-page-icon"><MapPin size={24}/></span><div><p className="section-eyebrow">{t('rp_workspace')}</p><h1>{t('sh_title')}</h1><p>{t('sh_intro')}</p></div></div>
    {error && <div className="withdrawal-alert" role="alert"><CircleAlert size={18}/><span>{error}</span><button type="button" onClick={()=>setError('')}>{t('rp_dismiss')}</button></div>}
    <section className="workspace-panel report-toolbar">
      <div className="report-actions"><button type="button" className="button button-primary" onClick={locate} disabled={status === 'loading'}><LocateFixed size={15}/> {status === 'loading' ? t('sh_searching') : t('sh_locate')}</button><button type="button" className="button button-secondary" onClick={searchCentre} disabled={status === 'loading'}><MapPin size={15}/> {t('sh_centre')}</button></div>
      <label className="report-month">{t('sh_radius')}<select value={radius} onChange={(e)=>changeRadius(Number(e.target.value))}>{RADII.map((km) => <option key={km} value={km}>{km} km</option>)}</select></label>
    </section>
    <div className="shops-map" ref={mapEl} role="application" aria-label={t('sh_map_aria')}/>
    {draft && <form className="workspace-panel workspace-form shop-pin-form" onSubmit={saveShop}>
      <div className="workspace-panel-head"><div><h2>{t('sh_pin_title')}</h2><p>{t('sh_pin_text')}</p></div><Plus size={20}/></div>
      <label>{t('sh_name')}<input value={form.name} onChange={(e)=>setForm((v)=>({...v,name:e.target.value}))} required maxLength={100} placeholder={t('sh_name_ph')}/></label>
      <label>{t('sh_address')}<input value={form.address} onChange={(e)=>setForm((v)=>({...v,address:e.target.value}))} maxLength={200}/></label>
      <label>{t('sh_phone')}<input value={form.phone} onChange={(e)=>setForm((v)=>({...v,phone:e.target.value}))} maxLength={30} inputMode="tel"/></label>
      <div className="report-actions"><button className="button button-primary" type="submit" disabled={saving || !form.name.trim()}>{saving ? t('sh_saving') : t('sh_save')}</button><button className="button button-secondary" type="button" onClick={clearDraft}>{t('sh_cancel')}</button></div>
    </form>}
    <section className="workspace-panel">
      <div className="workspace-panel-head"><div><h2>{t('sh_saved_title')}</h2><p>{saved.length ? t('sh_saved_count', { n: saved.length }) : t('sh_saved_none')}</p></div></div>
      {saved.length > 0 && <div className="workspace-record-list">{saved.map((shop) => <article className="workspace-record-row" key={shop.id}><span className="workspace-record-icon wheat"><MapPin size={16}/></span><div className="workspace-record-main"><strong>{shop.name}</strong><span>{shop.address || `${shop.lat.toFixed(4)}, ${shop.lon.toFixed(4)}`}</span></div>{actions(shop)}<button type="button" onClick={()=>removeShop(shop.id)} aria-label={t('sh_remove', { name: shop.name })}><Trash2 size={16}/></button></article>)}</div>}
    </section>
    <section className="workspace-panel">
      <div className="workspace-panel-head"><div><h2>{t('sh_osm_title')}</h2><p>{statusText}</p></div></div>
      {shops.length > 0 && <div className="workspace-record-list">{shops.map((shop) => <article className="workspace-record-row" key={shop.id}><span className="workspace-record-icon rice"><MapPin size={16}/></span><div className="workspace-record-main"><strong>{shop.name}</strong><span>{shop.distance_km} km{shop.address ? ` · ${shop.address}` : ''}{shop.opening_hours ? ` · ${shop.opening_hours}` : ''}</span></div>{actions(shop)}</article>)}</div>}
    </section>
  </main>
}
