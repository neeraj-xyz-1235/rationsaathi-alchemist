import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, CalendarDays, CircleAlert, FileCheck2, RefreshCw, ShieldCheck } from 'lucide-react'
import { apiGet, apiPost } from '../api/client.js'

export default function EntitlementPage() {
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
      setError(loadError.message || 'Could not load your eligibility details.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const proofStatus = String(profile?.proof_status || profile?.eligibility_status || 'pending').toLowerCase()
  const isVerified = ['verified', 'approved', 'valid'].includes(proofStatus)
  const items = allocation?.items || allocation?.entitlements || []

  async function calculate() {
    setError('')
    setMessage('')
    setAllocating(true)
    try {
      const result = await apiPost('/api/entitlements/allocate', {})
      setAllocation(result?.allocation || result)
      setMessage('The backend returned an allocation for the current period.')
    } catch (allocationError) {
      setError(allocationError.message || 'The entitlement service could not calculate an allocation.')
    } finally { setAllocating(false) }
  }

  return <main className="workspace-page entitlement-page">
    <div className="workspace-breadcrumb"><Link to="/dashboard">Dashboard</Link><span>/</span><span>Check entitlement</span></div>
    <div className="workspace-page-heading"><span className="workspace-page-icon"><ShieldCheck size={24}/></span><div><p className="section-eyebrow">OFFICIAL-RULE-BASED CHECK</p><h1>Check entitlement</h1><p>Your monthly quantity should be calculated from verified eligibility and the official rules for your state and scheme—not selected manually.</p></div></div>
    {error&&<div className="withdrawal-alert" role="alert"><CircleAlert size={18}/><span>{error}</span><button type="button" onClick={load}>Retry</button></div>}
    {message&&<div className="workspace-success" role="status"><BadgeCheck size={18}/><span>{message}</span></div>}
    {loading?<div className="workspace-panel loading-panel">Loading household eligibility…</div>:<>
      <section className="workspace-panel eligibility-profile-card"><div className="eligibility-profile-icon"><FileCheck2 size={22}/></div><div className="eligibility-profile-copy"><span className="section-eyebrow">HOUSEHOLD PROFILE</span><h2>{profile?.head_name || profile?.head_of_family || 'Household profile'}</h2><p>{[profile?.district,profile?.state].filter(Boolean).join(', ') || 'Location not provided'} · {profile?.card_type || profile?.scheme_name || 'Scheme category pending'}</p></div><span className={`proof-status-pill ${isVerified?'verified':'pending'}`}><i/>{isVerified?'Proof verified':'Proof '+proofStatus.replaceAll('_',' ')}</span><Link to="/setup" className="eligibility-edit-link">Review profile <ArrowRight size={14}/></Link></section>
      {!isVerified?<section className="workspace-panel eligibility-locked"><ShieldCheck size={30}/><h2>Allocation is locked until eligibility is verified</h2><p>We won't guess your monthly rice or wheat quantity from card colour. Your state, scheme category, household eligibility, and current official rules must be checked first.</p><div className="eligibility-steps"><span><i>1</i> Household details saved</span><span><i>2</i> Proof verified by service</span><span><i>3</i> Monthly allocation calculated</span></div><Link to="/setup" className="button button-primary">Complete or review proof <ArrowRight size={16}/></Link></section>:<>
        <section className="entitlement-action-banner"><div><span className="section-eyebrow">VERIFIED ELIGIBILITY</span><h2>Calculate this month’s allocation</h2><p>The backend applies the verified state/scheme rules and household eligibility to return the official quantity for this period.</p></div><button className="button button-primary" type="button" onClick={calculate} disabled={allocating}>{allocating?'Calculating…':'Calculate allocation'} <ArrowRight size={16}/></button></section>
        {allocation?<><div className="allocation-banner"><div><span className="allocation-overline">MONTHLY ENTITLEMENT</span><h2>{allocation.period_label||allocation.month||'Current period'}</h2><p>{allocation.scheme_name||allocation.scheme||profile?.card_type||'Verified scheme'} · {allocation.status||'Returned by entitlement service'}</p></div><span className="allocation-verified"><ShieldCheck size={16}/> Backend response</span></div><div className="allocation-items">{items.map((item,index)=><article className="allocation-item-card" key={`${item.item||item.name}-${index}`}><span>{String(item.item||item.name||'R')[0].toUpperCase()}</span><div><strong>{item.item||item.name}</strong><small>Allocated for this period</small></div><div className="allocation-qty"><strong>{item.allocated_quantity??item.quantity} {item.unit||'kg'}</strong><small>From verified rules</small></div></article>)}</div><div className="entitlement-next-step"><CalendarDays size={20}/><div><strong>Next: record what you actually receive</strong><p>Withdrawals reduce the available balance. Each saved collection should produce a receipt reference.</p></div><Link to="/withdrawals" className="button button-primary">Start withdrawal <ArrowRight size={15}/></Link></div></>:<div className="workspace-panel entitlement-empty"><CalendarDays size={27}/><h2>No allocation for this period yet</h2><p>When the backend entitlement service is connected, calculate the current period to view item-wise quantities here.</p></div>}
      </>}
      <p className="entitlement-disclaimer"><ShieldCheck size={14}/> RationSaathi is an independent tool. The official scheme rules and the competent authority remain the source of truth for eligibility and allocation.</p>
    </>}
    <div className="entitlement-bottom-actions"><button type="button" className="button button-secondary" onClick={load}><RefreshCw size={15}/> Refresh eligibility</button><Link to="/report" className="entitlement-text-link">View reports <ArrowRight size={14}/></Link></div>
  </main>
}
