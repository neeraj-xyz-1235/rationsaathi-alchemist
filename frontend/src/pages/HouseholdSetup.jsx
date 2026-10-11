import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, FileCheck2, FileUp, ShieldCheck, Trash2, UserRoundPlus, Users } from 'lucide-react'
import { apiPost, apiPut } from '../api/client.js'
import BrandMark from '../components/layout/BrandMark.jsx'
import LanguagePill from '../components/layout/LanguagePill.jsx'
import { useLang } from '../i18n/index.jsx'

const blankMember = () => ({ name: '', age: '', gender: '' })
const initial = {
  head_name: '', head_age: '', head_gender: '', state: '', district: '', locality: '',
  card_type: '', card_colour: '', card_number_last4: '', members: [],
}

export default function HouseholdSetup() {
  const { t } = useLang()
  const navigate = useNavigate()
  const location = useLocation()
  const [values, setValues] = useState(initial)
  const [proof, setProof] = useState(null)
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const update = (key, value) => setValues((current) => ({ ...current, [key]: value }))
  const updateMember = (index, key, value) => setValues((current) => ({
    ...current,
    members: current.members.map((member, i) => i === index ? { ...member, [key]: value } : member),
  }))
  const addMember = () => setValues((current) => ({ ...current, members: [...current.members, blankMember()] }))
  const removeMember = (index) => setValues((current) => ({ ...current, members: current.members.filter((_, i) => i !== index) }))

  const genderOptions = (placeholder) => <>
    <option value="">{placeholder}</option><option value="female">{t('su_female')}</option><option value="male">{t('su_male')}</option>
    <option value="other">{t('su_other')}</option><option value="prefer_not_to_say">{t('su_pns')}</option>
  </>

  async function submit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (step === 1) {
      if (!values.head_name.trim() || !values.head_age || !values.head_gender || !values.state || !values.district || !values.card_type || !values.card_colour) {
        setError(t('su_err_required'))
        return
      }
      if (values.members.some((member) => !member.name.trim() || member.age === '' || !member.gender)) {
        setError(t('su_err_members'))
        return
      }
      setStep(2)
      return
    }
    if (!proof) {
      setError(t('su_err_choose'))
      return
    }
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(proof.type)) {
      setError(t('su_err_type'))
      return
    }
    if (proof.size > 8 * 1024 * 1024) {
      setError(t('su_err_size'))
      return
    }

    setBusy(true)
    try {
      const profilePayload = {
        ...values,
        head_age: Number(values.head_age),
        household_member_count: 1 + values.members.length,
        members: [{ name: values.head_name, age: Number(values.head_age), gender: values.head_gender, relationship: 'head' }, ...values.members.map((member) => ({ ...member, age: Number(member.age), relationship: member.relationship || 'member' }))],
      }
      let saved
      try {
        saved = await apiPut('/api/household/profile', profilePayload)
      } catch (putError) {
        if (putError.status !== 404 && putError.status !== 405) throw putError
        saved = await apiPost('/api/household/profile', profilePayload)
      }
      const formData = new FormData()
      formData.append('file', proof)
      formData.append('document_type', 'ration_card_or_eligibility_proof')
      const uploaded = await apiPost('/api/household/proof', formData)
      const reviewStatus = uploaded?.profile?.proof_status || saved?.profile?.proof_status || saved?.proof_status || 'pending_review'
      setNotice('')
      navigate(location.state?.from || '/dashboard', { replace: true, state: { profileSaved: true, proofStatus: reviewStatus } })
    } catch (submitError) {
      setError(submitError.message || t('su_err_save'))
    } finally {
      setBusy(false)
    }
  }

  return <main className="household-setup-page">
    <header className="setup-topbar"><Link to="/" className="setup-brand"><BrandMark compact/><strong>RationSaathi</strong></Link><span><ShieldCheck size={15}/> {t('su_topbar')}</span><LanguagePill/></header>
    <div className="setup-layout">
      <aside className="setup-intro"><span className="setup-kicker">{t('su_kicker')}</span><h1>{t('su_title')}</h1><p>{t('su_intro')}</p><div className="setup-progress-list"><div className={step >= 1 ? 'current' : ''}><span>{step > 1 ? <Check size={15}/> : '01'}</span><div><strong>{t('su_p1')}</strong><small>{t('su_p1s')}</small></div></div><div className={step >= 2 ? 'current' : ''}><span>02</span><div><strong>{t('su_p2')}</strong><small>{t('su_p2s')}</small></div></div><div><span>03</span><div><strong>{t('su_p3')}</strong><small>{t('su_p3s')}</small></div></div></div><div className="setup-privacy-note"><ShieldCheck size={19}/><span>{t('su_privacy')}</span></div></aside>
      <section className="setup-form-card"><div className="setup-card-heading"><div><span className="setup-step-label">{t('su_step', { n: step })}</span><h2>{step === 1 ? t('su_h1') : t('su_h2')}</h2><p>{step === 1 ? t('su_d1') : t('su_d2')}</p></div><span className="setup-heading-icon">{step === 1 ? <Users size={23}/> : <FileCheck2 size={23}/>}</span></div>
        {error && <div className="setup-alert" role="alert">{error}</div>}
        {notice && <div className="setup-notice" role="status">{notice}</div>}
        <form onSubmit={submit}>
          {step === 1 ? <>
            <div className="setup-section-label">{t('su_head')}</div>
            <div className="setup-form-grid"><label className="span-2">{t('su_fullname')}<input value={values.head_name} onChange={(e)=>update('head_name',e.target.value)} autoComplete="name" required placeholder={t('su_name_ph')}/></label><label>{t('su_age')}<input type="number" min="18" max="120" value={values.head_age} onChange={(e)=>update('head_age',e.target.value)} required placeholder={t('su_age_ph')}/></label><label>{t('su_gender')}<select value={values.head_gender} onChange={(e)=>update('head_gender',e.target.value)} required>{genderOptions(t('su_select_gender'))}</select></label><label>{t('su_last4')}<input value={values.card_number_last4} onChange={(e)=>update('card_number_last4',e.target.value.replace(/\D/g,'').slice(0,4))} inputMode="numeric" maxLength={4} placeholder={t('su_optional')}/><small className="field-note">{t('su_last4_note')}</small></label></div>
            <div className="setup-section-label">{t('su_loc')}</div>
            <div className="setup-form-grid"><label>{t('su_state')}<input value={values.state} onChange={(e)=>update('state',e.target.value)} required placeholder={t('su_state_ph')}/></label><label>{t('su_district')}<input value={values.district} onChange={(e)=>update('district',e.target.value)} required placeholder={t('su_district')}/></label><label className="span-2">{t('su_locality')}<input value={values.locality} onChange={(e)=>update('locality',e.target.value)} placeholder={t('su_locality_ph')}/></label><label>{t('su_category')}<select value={values.card_type} onChange={(e)=>update('card_type',e.target.value)} required><option value="">{t('su_select_category')}</option><option value="AAY">{t('su_aay')}</option><option value="PHH">{t('su_phh')}</option><option value="STATE_OTHER">{t('su_state_other')}</option><option value="UNKNOWN">{t('su_unknown')}</option></select></label><label>{t('su_colour')}<select value={values.card_colour} onChange={(e)=>update('card_colour',e.target.value)} required><option value="">{t('su_select_colour')}</option><option value="yellow">{t('su_yellow')}</option><option value="orange">{t('su_orange')}</option><option value="white">{t('su_white')}</option><option value="green">{t('su_green')}</option><option value="blue">{t('su_blue')}</option><option value="other">{t('su_colour_other')}</option></select><small className="field-note">{t('su_colour_note')}</small></label></div>
            <div className="setup-section-label setup-members-title"><span>{t('su_members')}</span><button type="button" className="setup-add-member" onClick={addMember}><UserRoundPlus size={15}/> {t('su_add_member')}</button></div>
            <p className="field-note setup-member-explainer">{t('su_member_note')}</p><div className="setup-members-list">{values.members.map((member,index)=><div className="setup-member-row" key={index}><div className="setup-member-index">{index + 1}</div><label>{t('su_member_name')}<input value={member.name} onChange={(e)=>updateMember(index,'name',e.target.value)} required placeholder={t('su_member_name_ph')}/></label><label>{t('su_age')}<input type="number" min="0" max="120" value={member.age} onChange={(e)=>updateMember(index,'age',e.target.value)} required placeholder={t('su_age_ph')}/></label><label>{t('su_gender')}<select value={member.gender} onChange={(e)=>updateMember(index,'gender',e.target.value)} required>{genderOptions(t('su_select'))}</select></label>{values.members.length>0&&<button className="setup-remove-member" type="button" onClick={()=>removeMember(index)} aria-label={t('su_remove_member', { n: index + 1 })}><Trash2 size={16}/></button>}</div>)}</div>
            <div className="setup-form-actions"><span>{t('su_required_note')}</span><button className="button button-primary" type="submit">{t('su_continue')} <ArrowRight size={17}/></button></div>
          </> : <>
            <div className="proof-upload-box"><span className="proof-upload-icon"><FileUp size={27}/></span><h3>{t('su_upload_title')}</h3><p>{t('su_upload_hint')}</p><label className="proof-file-button">{proof ? t('su_choose_other') : t('su_choose')}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e)=>{setProof(e.target.files?.[0]||null);setError('')}}/></label>{proof&&<div className="proof-file-selected"><FileCheck2 size={17}/><span><strong>{proof.name}</strong><small>{(proof.size/1024/1024).toFixed(2)} MB · {t('su_selected')}</small></span><button type="button" onClick={()=>setProof(null)} aria-label={t('su_remove_proof')}><Trash2 size={15}/></button></div>}</div>
            <div className="proof-review-note"><ShieldCheck size={19}/><div><strong>{t('su_review_title')}</strong><p>{t('su_review_text')}</p></div></div>
            <label className="setup-consent"><input type="checkbox" required/><span>{t('su_consent')}</span></label>
            <div className="setup-form-actions"><button type="button" className="button button-secondary" onClick={()=>{setStep(1);setError('')}}><ArrowLeft size={16}/> {t('su_back')}</button><button className="button button-primary" type="submit" disabled={busy||!proof}>{busy?t('su_submitting'):t('su_submit')} <ArrowRight size={17}/></button></div>
          </>}
        </form>
        <p className="setup-legal-note">{t('su_legal')}</p>
      </section>
    </div>
  </main>
}
