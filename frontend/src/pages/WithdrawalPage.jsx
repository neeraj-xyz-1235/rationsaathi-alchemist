import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, CircleAlert, ClipboardCheck, Download, FileCheck2, PackageCheck, RefreshCw, ShieldCheck } from 'lucide-react'
import { apiGet, apiPost } from '../api/client.js'
import { useLang } from '../i18n/index.jsx'

const EMPTY = { item: 'rice', quantity: '', date: new Date().toISOString().slice(0, 10), reference: '' }

export default function WithdrawalPage() {
  const { t, tItem, periodLabel } = useLang()
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
      if (loadError.status !== 404) setError(loadError.message || t('err_generic'))
    } finally { setLoading(false) }
  }, [t])

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
      setError(t('wd_err_zero'))
      return
    }
    if (quantity > remaining) {
      setError(t('wd_err_over', { n: remaining }))
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
      window.dispatchEvent(new Event('rationsaathi:changed'))
      await load()
    } catch (submitError) {
      setError(submitError.message || t('err_generic'))
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
      setVerification({ valid: false, message: verifyError.message || t('wd_verify_bad') })
    } finally { setVerifying(false) }
  }

  const schemeLabel = String(allocation?.scheme_name || allocation?.scheme || '').replace('assumed: card category not confirmed', t('ent_assumed')).replace('Priority Household (PHH)', t('su_phh')).replace('Antyodaya Anna Yojana (AAY)', t('su_aay'))

  return <main className="workspace-page withdrawal-page">
    <div className="workspace-breadcrumb"><Link to="/dashboard">{t('ent_dashboard')}</Link><span>/</span><span>{t('wd_breadcrumb')}</span></div>
    <div className="workspace-page-heading"><span className="workspace-page-icon"><PackageCheck size={24}/></span><div><p className="section-eyebrow">{t('wd_eyebrow')}</p><h1>{t('wd_title')}</h1><p>{t('wd_intro')}</p></div></div>

    {error && <div className="withdrawal-alert" role="alert"><CircleAlert size={18}/><span>{error}</span><button type="button" onClick={()=>setError('')}>{t('wd_dismiss')}</button></div>}
    {loading ? <div className="workspace-panel loading-panel">{t('wd_loading')}</div> : !allocation ? <div className="workspace-panel allocation-locked"><ShieldCheck size={28}/><h2>{t('wd_locked_title')}</h2><p>{t('wd_locked_text')}</p><Link to="/check" className="button button-primary">{t('nav_check')} <ArrowRight size={16}/></Link></div> : <>
      <section className="allocation-banner"><div><span className="allocation-overline">{t('wd_current')}</span><h2>{periodLabel(allocation.period, allocation.period_label || allocation.month) || t('wd_current_month')}</h2><p>{schemeLabel} · {t('ent_allocation_ready')}</p></div><span className="allocation-verified"><ShieldCheck size={16}/> {t('wd_verified_rules')}</span></section>
      <div className="allocation-items">{items.map((item,index)=>{const name=String(item.item||item.name||'Item').toLowerCase();const qty=Number(item.allocated_quantity??item.quantity??0);const withdrawn=withdrawals.filter((row)=>String(row.item||'').toLowerCase()===name&&row.status!=='cancelled').reduce((sum,row)=>sum+Number(row.quantity||0),0);return <article className="allocation-item-card" key={`${name}-${index}`}><span>{name.slice(0,1).toUpperCase()}</span><div><strong>{tItem(item.item||item.name)}</strong><small>{t('wd_allocated')}</small></div><div className="allocation-qty"><strong>{qty} {item.unit||'kg'}</strong><small>{t('wd_remaining', { n: `${Math.max(0,qty-withdrawn)} kg` })}</small></div><div className="allocation-progress"><i style={{width:`${qty ? Math.min(100,withdrawn/qty*100):0}%`}}/></div><small className="allocation-progress-caption">{t('wd_recorded_of', { done: withdrawn, total: qty, unit: item.unit||'kg' })}</small></article>})}</div>
      <div className="workspace-columns withdrawal-columns"><form className="workspace-panel workspace-form" onSubmit={submit}><div className="workspace-panel-head"><div><h2>{t('wd_form_title')}</h2><p>{t('wd_form_text')}</p></div><PackageCheck size={21}/></div><label>{t('wd_item')}<select value={values.item} onChange={(e)=>setValues((v)=>({...v,item:e.target.value}))}>{items.map((item,index)=><option key={index} value={String(item.item||item.name).toLowerCase()}>{tItem(item.item||item.name)}</option>)}</select></label><label>{t('wd_qty')}<input type="number" min="0.01" step="0.01" max={remaining} value={values.quantity} onChange={(e)=>setValues((v)=>({...v,quantity:e.target.value}))} required placeholder={t('wd_qty_ph', { n: remaining })}/><small className="field-note">{t('wd_available', { n: remaining })}</small></label><label>{t('wd_date')}<input type="date" value={values.date} onChange={(e)=>setValues((v)=>({...v,date:e.target.value}))} required/></label><label>{t('wd_ref')}<input value={values.reference} onChange={(e)=>setValues((v)=>({...v,reference:e.target.value}))} placeholder={t('wd_ref_ph')}/></label><button className="button button-primary" type="submit" disabled={busy||!items.length}>{busy?t('wd_submitting'):t('wd_submit')} <ArrowRight size={16}/></button></form>
      <aside className="workspace-panel receipt-side-panel"><FileCheck2 size={25}/><h2>{t('wd_side_title')}</h2><p>{t('wd_side_text')}</p><div className="receipt-rule"><CheckCircle2 size={16}/><span>{t('wd_side_rule1')}</span></div><div className="receipt-rule"><ShieldCheck size={16}/><span>{t('wd_side_rule2')}</span></div></aside></div>
      <section className="workspace-panel withdrawal-history"><div className="workspace-panel-head"><div><h2>{t('wd_history')}</h2><p>{t('wd_history_text')}</p></div><button type="button" className="button button-secondary" onClick={load}><RefreshCw size={15}/> {t('wd_refresh')}</button></div>{withdrawals.length===0?<div className="workspace-empty"><ClipboardCheck size={25}/><strong>{t('wd_none')}</strong><p>{t('wd_none_text')}</p></div>:<div className="workspace-record-list">{withdrawals.map((row,index)=><article className="workspace-record-row" key={row.id||row.receipt_id||index}><span className="workspace-record-icon rice">{String(row.item||'R')[0].toUpperCase()}</span><div className="workspace-record-main"><strong>{tItem(row.item)} · {row.quantity} {row.unit||'kg'}</strong><span>{row.withdrawal_date||row.date} · {t('wd_receipt')} {row.receipt_id||row.reference||t('wd_pending')}</span></div><span className="workspace-record-status"><CheckCircle2 size={14}/>{t('wd_recorded')}</span>{row.id&&<a className="receipt-download-link" href={`/api/withdrawals/${row.id}/receipt.pdf`} download aria-label={t('wd_download_aria')} title={t('wd_download')}><Download size={16}/></a>}</article>)}</div>}</section>
    </>}

    {success && <div className="receipt-modal-backdrop"><section className="receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-created-title"><span className="receipt-success-icon"><CheckCircle2 size={27}/></span><h2 id="receipt-created-title">{t('wd_modal_title')}</h2><p>{t('wd_modal_text')}</p><div className="receipt-number"><small>{t('wd_modal_ref')}</small><strong>{success.receipt_id||success.reference||success.id}</strong></div>{(success.verification_code||success.verification_url)&&<div className="receipt-number"><small>{t('wd_modal_verify')}</small><strong>{success.verification_code||success.verification_url}</strong></div>}{success.id&&<a className="button button-secondary" href={`/api/withdrawals/${success.id}/receipt.pdf`} download><Download size={15}/> {t('wd_download')}</a>}<button className="button button-primary" type="button" onClick={()=>setSuccess(null)}>{t('wd_done')}</button></section></div>}

    <section className="workspace-panel receipt-verify-panel"><div><h2>{t('wd_verify_title')}</h2><p>{t('wd_verify_text')}</p></div><form onSubmit={verifyReceipt}><input value={verifyCode} onChange={(e)=>setVerifyCode(e.target.value)} required placeholder={t('wd_verify_ph')} aria-label={t('wd_verify_ph')}/><button className="button button-secondary" type="submit" disabled={verifying}>{verifying?t('wd_verifying'):t('wd_verify_btn')}</button></form>{verification&&<div className={`receipt-verification-result ${verification.valid===false?'invalid':'valid'}`} role="status"><ShieldCheck size={18}/><div><strong>{verification.valid===false?t('wd_verify_bad'):t('wd_verify_ok')}</strong><p>{verification.valid===false?t('wd_verify_notfound'):`${tItem(verification.item||'')} ${verification.quantity||''} kg · ${verification.withdrawal_date||''} · ${verification.receipt_id||''}`}</p></div></div>}</section>
  </main>
}
