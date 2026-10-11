import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, CalendarDays, CircleAlert, FileCheck2, RefreshCw, ShieldCheck } from 'lucide-react'
import { apiGet, apiPost } from '../api/client.js'
import { useLang } from '../i18n/index.jsx'

export default function EntitlementPage() {
  const { t, tItem, periodLabel } = useLang()
  const [profile, setProfile] = useState(null)
  const [allocation, setAllocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [allocating, setAllocating] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [profileData, allocationData] = await Promise.all([
        apiGet('/api/household/profile'),
        apiGet('/api/entitlements/current').catch((err) => {
          if (err.status === 404) return null
          throw err
        }),
      ])
      setProfile(profileData?.profile || profileData)
      setAllocation(allocationData?.allocation || allocationData)
    } catch (loadError) {
      setError(loadError.message || t('err_generic'))
    } finally { setLoading(false) }
  }, [t])

  useEffect(() => { load() }, [load])

  const proofStatus = String(profile?.proof_status || profile?.eligibility_status || 'pending').toLowerCase()
  const isVerified = ['verified', 'approved', 'valid'].includes(proofStatus)
  const items = allocation?.items || allocation?.entitlements || []
  const schemeName = (name) => String(name || '').replace('assumed: card category not confirmed', t('ent_assumed')).replace('Priority Household (PHH)', t('su_phh')).replace('Antyodaya Anna Yojana (AAY)', t('su_aay'))

  async function calculate() {
    setError('')
    setMessage('')
    setAllocating(true)
    try {
      const result = await apiPost('/api/entitlements/allocate', {})
      setAllocation(result?.allocation || result)
      setMessage(t('ent_calculated_msg'))
      window.dispatchEvent(new Event('rationsaathi:changed'))
    } catch (allocationError) {
      setError(allocationError.message || t('err_generic'))
    } finally { setAllocating(false) }
  }

  return <main className="workspace-page entitlement-page">
    <div className="workspace-breadcrumb"><Link to="/dashboard">{t('ent_dashboard')}</Link><span>/</span><span>{t('nav_check')}</span></div>
    <div className="workspace-page-heading"><span className="workspace-page-icon"><ShieldCheck size={24}/></span><div><p className="section-eyebrow">{t('ent_eyebrow')}</p><h1>{t('nav_check')}</h1><p>{t('ent_intro')}</p></div></div>
    {error&&<div className="withdrawal-alert" role="alert"><CircleAlert size={18}/><span>{error}</span><button type="button" onClick={load}>{t('ent_retry')}</button></div>}
    {message&&<div className="workspace-success" role="status"><BadgeCheck size={18}/><span>{message}</span></div>}
    {loading?<div className="workspace-panel loading-panel">{t('ent_loading')}</div>:<>
      <section className="workspace-panel eligibility-profile-card"><div className="eligibility-profile-icon"><FileCheck2 size={22}/></div><div className="eligibility-profile-copy"><span className="section-eyebrow">{t('ent_profile')}</span><h2>{profile?.head_name || profile?.head_of_family || t('ent_household')}</h2><p>{[profile?.district,profile?.state].filter(Boolean).join(', ') || t('ent_location_missing')} · {profile?.card_type || profile?.scheme_name || t('ent_scheme_pending')}</p></div><span className={`proof-status-pill ${isVerified?'verified':'pending'}`}><i/>{isVerified?t('ent_proof_verified'):t('ent_proof', { status: proofStatus.replaceAll('_',' ') })}</span><Link to="/setup" className="eligibility-edit-link">{t('ent_review_profile')} <ArrowRight size={14}/></Link></section>
      {!isVerified?<section className="workspace-panel eligibility-locked"><ShieldCheck size={30}/><h2>{t('ent_locked_title')}</h2><p>{t('ent_locked_text')}</p><div className="eligibility-steps"><span><i>1</i> {t('ent_step1')}</span><span><i>2</i> {t('ent_step2')}</span><span><i>3</i> {t('ent_step3')}</span></div><Link to="/setup" className="button button-primary">{t('ent_complete_proof')} <ArrowRight size={16}/></Link></section>:<>
        <section className="entitlement-action-banner"><div><span className="section-eyebrow">{t('ent_banner_eyebrow')}</span><h2>{t('ent_banner_title')}</h2><p>{t('ent_banner_text')}</p></div><button className="button button-primary" type="button" onClick={calculate} disabled={allocating}>{allocating?t('ent_calculating'):t('ent_calculate')} <ArrowRight size={16}/></button></section>
        {allocation?<><div className="allocation-banner"><div><span className="allocation-overline">{t('ent_monthly')}</span><h2>{periodLabel(allocation.period, allocation.period_label||allocation.month)||t('ent_current_period')}</h2><p>{schemeName(allocation.scheme_name||allocation.scheme||profile?.card_type)} · {t('ent_allocation_ready')}</p></div><span className="allocation-verified"><ShieldCheck size={16}/> {t('ent_response')}</span></div><div className="allocation-items">{items.map((item,index)=><article className="allocation-item-card" key={`${item.item||item.name}-${index}`}><span>{String(item.item||item.name||'R')[0].toUpperCase()}</span><div><strong>{tItem(item.item||item.name)}</strong><small>{t('ent_allocated_period')}</small></div><div className="allocation-qty"><strong>{item.allocated_quantity??item.quantity} {item.unit||'kg'}</strong><small>{t('ent_from_rules')}</small></div></article>)}</div><div className="entitlement-next-step"><CalendarDays size={20}/><div><strong>{t('ent_next_title')}</strong><p>{t('ent_next_text')}</p></div><Link to="/withdrawals" className="button button-primary">{t('ent_start_withdrawal')} <ArrowRight size={15}/></Link></div></>:<div className="workspace-panel entitlement-empty"><CalendarDays size={27}/><h2>{t('ent_none_title')}</h2><p>{t('ent_none_text')}</p></div>}
      </>}
      <p className="entitlement-disclaimer"><ShieldCheck size={14}/> {t('ent_disclaimer')}</p>
    </>}
    <div className="entitlement-bottom-actions"><button type="button" className="button button-secondary" onClick={load}><RefreshCw size={15}/> {t('ent_refresh')}</button><Link to="/report" className="entitlement-text-link">{t('ent_view_reports')} <ArrowRight size={14}/></Link></div>
  </main>
}
