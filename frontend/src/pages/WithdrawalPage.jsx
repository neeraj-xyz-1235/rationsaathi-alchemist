import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, CircleAlert, ClipboardCheck, FileCheck2, PackageCheck, RefreshCw, ShieldCheck } from 'lucide-react'
import { apiGet, apiPost } from '../api/client.js'

const EMPTY = { item: 'rice', quantity: '', date: new Date().toISOString().slice(0, 10), reference: '' }

export default function WithdrawalPage() {
  const [allocation, setAllocation] = useState(null)
  const [withdrawals, setWithdrawals] = useState([])
  const [values, setValues] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [verification, setVerification] = useState(null)
  const [verifying, setVerifying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [allocationData, withdrawalData] = await Promise.all([
        apiGet('/api/entitlements/current'),
        apiGet(`/api/withdrawals?month=${new Date().toISOString().slice(0, 7)}`),
      ])
      setAllocation(allocationData?.allocation || allocationData)
      setWithdrawals(withdrawalData?.items || withdrawalData?.withdrawals || withdrawalData || [])
    } catch (loadError) {
      setError(loadError.message || 'Could not load the current allocation and withdrawal history.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const items = allocation?.items || allocation?.entitlements || []
  const itemAllocation = items.find((item) => String(item.item || item.name || '').toLowerCase() === values.item)
  const allocated = Number(itemAllocation?.allocated_quantity ?? itemAllocation?.quantity ?? 0)
  const alreadyWithdrawn = withdrawals
    .filter((row) => String(row.item || '').toLowerCase() === values.item && row.status !== 'cancelled')
    .reduce((sum, row) => sum + Number(row.quantity || 0), 0)
  const remaining = Math.max(0, allocated - alreadyWithdrawn)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSuccess(null)
    const quantity = Number(values.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Enter a withdrawal quantity greater than zero.')
      return
    }
    if (quantity > remaining) {
      setError(`This quantity is higher than the currently available balance (${remaining} kg).`)
      return
    }
    setBusy(true)
    try {
      const result = await apiPost('/api/withdrawals', {
        item: values.item,
        quantity,
        unit: 'kg',
        withdrawal_date: values.date,
        receipt_reference: values.reference.trim() || undefined,
      })
      const receipt = result?.receipt || result
      setSuccess(receipt)
      setValues(EMPTY)
      await load()
    } catch (submitError) {
      setError(submitError.message || 'Withdrawal could not be recorded.')
    } finally { setBusy(false) }
  }

  async function verifyReceipt(event) {
    event.preventDefault()
    setVerification(null)
    setError('')
    if (!verifyCode.trim()) return
    setVerifying(true)
    try {
      const result = await apiGet(`/api/receipts/verify/${encodeURIComponent(verifyCode.trim())}`)
      setVerification(result?.receipt || result)
    } catch (verifyError) {
      setVerification({ valid: false, message: verifyError.message || 'Receipt could not be verified.' })
    } finally { setVerifying(false) }
  }

  return <main className="workspace-page withdrawal-page">
    <div className="workspace-breadcrumb"><Link to="/dashboard">Dashboard</Link><span>/</span><span>Withdrawals</span></div>
    <div className="workspace-page-heading"><span className="workspace-page-icon"><PackageCheck size={24}/></span><div><p className="section-eyebrow">MONTHLY ENTITLEMENT</p><h1>Record a withdrawal</h1><p>Record each collection against the verified monthly allocation and create a receipt reference.</p></div></div>

    {error && <div className="withdrawal-alert" role="alert"><CircleAlert size={18}/><span>{error}</span><button type="button" onClick={()=>setError('')}>Dismiss</button></div>}
    {loading ? <div className="workspace-panel loading-panel">Loading your verified allocation…</div> : !allocation ? <div className="workspace-panel allocation-locked"><ShieldCheck size={28}/><h2>Allocation not available yet</h2><p>Your monthly allocation will appear after your household proof has been verified and the backend applies the official scheme rules.</p><Link to="/setup" className="button button-primary">Review household profile <ArrowRight size={16}/></Link></div> : <>
      <section className="allocation-banner"><div><span className="allocation-overline">CURRENT ALLOCATION</span><h2>{allocation.period_label || allocation.month || 'Current month'}</h2><p>{allocation.scheme_name || allocation.scheme || 'Verified household scheme'} · {allocation.status || 'Allocation available'}</p></div><span className="allocation-verified"><ShieldCheck size={16}/> Verified rules</span></section>
      <div className="allocation-items">{items.map((item,index)=>{const name=String(item.item||item.name||'Item').toLowerCase();const qty=Number(item.allocated_quantity??item.quantity??0);const withdrawn=withdrawals.filter((row)=>String(row.item||'').toLowerCase()===name&&row.status!=='cancelled').reduce((sum,row)=>sum+Number(row.quantity||0),0);return <article className="allocation-item-card" key={`${name}-${index}`}><span>{name.slice(0,1).toUpperCase()}</span><div><strong>{item.item||item.name}</strong><small>Allocated this month</small></div><div className="allocation-qty"><strong>{qty} {item.unit||'kg'}</strong><small>{Math.max(0,qty-withdrawn)} remaining</small></div><div className="allocation-progress"><i style={{width:`${qty ? Math.min(100,withdrawn/qty*100):0}%`}}/></div><small className="allocation-progress-caption">{withdrawn} of {qty} {item.unit||'kg'} recorded as withdrawn</small></article>})}</div>
      <div className="workspace-columns withdrawal-columns"><form className="workspace-panel workspace-form" onSubmit={submit}><div className="workspace-panel-head"><div><h2>New withdrawal entry</h2><p>Record the amount actually received at the shop.</p></div><PackageCheck size={21}/></div><label>Item<select value={values.item} onChange={(e)=>setValues((v)=>({...v,item:e.target.value}))}>{items.map((item,index)=><option key={index} value={String(item.item||item.name).toLowerCase()}>{item.item||item.name}</option>)}</select></label><label>Quantity received (kg)<input type="number" min="0.01" step="0.01" max={remaining} value={values.quantity} onChange={(e)=>setValues((v)=>({...v,quantity:e.target.value}))} required placeholder={`Up to ${remaining} kg available`}/><small className="field-note">Available balance for selected item: {remaining} kg.</small></label><label>Withdrawal date<input type="date" value={values.date} onChange={(e)=>setValues((v)=>({...v,date:e.target.value}))} required/></label><label>Shop receipt reference (optional)<input value={values.reference} onChange={(e)=>setValues((v)=>({...v,reference:e.target.value}))} placeholder="Reference printed on the shop receipt"/></label><button className="button button-primary" type="submit" disabled={busy||!items.length}>{busy?'Recording…':'Record withdrawal & create receipt'} <ArrowRight size={16}/></button></form>
      <aside className="workspace-panel receipt-side-panel"><FileCheck2 size={25}/><h2>Receipt and next withdrawal</h2><p>Each saved withdrawal should return a server-generated receipt ID and verification code. Keep the receipt for future reference.</p><div className="receipt-rule"><CheckCircle2 size={16}/><span>Remaining balance is calculated from the verified monthly allocation minus successful withdrawal records.</span></div><div className="receipt-rule"><ShieldCheck size={16}/><span>Receipt verification happens on the backend. Never place a private API key in React or browser code.</span></div></aside></div>
      <section className="workspace-panel withdrawal-history"><div className="workspace-panel-head"><div><h2>Withdrawal history</h2><p>Entries returned by the server for this account.</p></div><button type="button" className="button button-secondary" onClick={load}><RefreshCw size={15}/> Refresh</button></div>{withdrawals.length===0?<div className="workspace-empty"><ClipboardCheck size={25}/><strong>No withdrawals recorded</strong><p>When a withdrawal is saved successfully, it will appear here.</p></div>:<div className="workspace-record-list">{withdrawals.map((row,index)=><article className="workspace-record-row" key={row.id||row.receipt_id||index}><span className="workspace-record-icon rice">{String(row.item||'R')[0].toUpperCase()}</span><div className="workspace-record-main"><strong>{row.item} · {row.quantity} {row.unit||'kg'}</strong><span>{row.withdrawal_date||row.date} · Receipt {row.receipt_id||row.reference||'pending'}</span></div><span className="workspace-record-status"><CheckCircle2 size={14}/>{row.status||'Recorded'}</span></article>)}</div>}</section>
    </>}

    {success && <div className="receipt-modal-backdrop"><section className="receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-created-title"><span className="receipt-success-icon"><CheckCircle2 size={27}/></span><h2 id="receipt-created-title">Withdrawal recorded</h2><p>Your backend response has been saved. Keep this receipt reference for future withdrawal checks.</p><div className="receipt-number"><small>RECEIPT REFERENCE</small><strong>{success.receipt_id||success.reference||success.id||'Receipt ID not returned'}</strong></div>{(success.verification_code||success.verification_url)&&<div className="receipt-number"><small>VERIFICATION</small><strong>{success.verification_code||success.verification_url}</strong></div>}<button className="button button-primary" type="button" onClick={()=>setSuccess(null)}>Done</button></section></div>}

    <section className="workspace-panel receipt-verify-panel"><div><h2>Verify a receipt</h2><p>Enter the receipt reference or verification code to check whether it was issued by RationSaathi.</p></div><form onSubmit={verifyReceipt}><input value={verifyCode} onChange={(e)=>setVerifyCode(e.target.value)} required placeholder="Receipt reference / verification code" aria-label="Receipt reference or verification code"/><button className="button button-secondary" type="submit" disabled={verifying}>{verifying?'Checking…':'Verify receipt'}</button></form>{verification&&<div className={`receipt-verification-result ${verification.valid===false?'invalid':'valid'}`} role="status"><ShieldCheck size={18}/><div><strong>{verification.valid===false?'Could not verify receipt':'Verification response'}</strong><p>{verification.message||`Receipt status: ${verification.status||'response received'}`}</p></div></div>}</section>
  </main>
}
