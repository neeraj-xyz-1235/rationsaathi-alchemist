import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, FileCheck2, FileUp, ShieldCheck, Trash2, UserRoundPlus, Users } from 'lucide-react'
import { apiGet, apiPost, apiPut } from '../api/client.js'
import BrandMark from '../components/layout/BrandMark.jsx'

const blankMember = () => ({ name: '', age: '', gender: '' })
const initial = {
  head_name: '', head_age: '', head_gender: '', state: '', district: '', locality: '',
  card_type: '', card_colour: '', card_number_last4: '', members: [],
}

export default function HouseholdSetup() {
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

  async function submit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (step === 1) {
      if (!values.head_name.trim() || !values.head_age || !values.head_gender || !values.state || !values.district || !values.card_type || !values.card_colour) {
        setError('Complete all required household and ration-card fields first.')
        return
      }
      if (values.members.some((member) => !member.name.trim() || member.age === '' || !member.gender)) {
        setError('Enter each household member’s name, age, and gender, or remove the unused row.')
        return
      }
      setStep(2)
      return
    }
    if (!proof) {
      setError('Choose a ration-card or eligibility proof document to continue.')
      return
    }
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(proof.type)) {
      setError('Upload a PDF, JPG, PNG, or WEBP file.')
      return
    }
    if (proof.size > 8 * 1024 * 1024) {
      setError('The proof file must be 8 MB or smaller.')
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
      await apiPost('/api/household/proof', formData)
      const reviewStatus = saved?.profile?.proof_status || saved?.proof_status || 'pending_review'
      setNotice(reviewStatus === 'verified'
        ? 'Your household details and proof were saved and verified.'
        : 'Your details were saved. The eligibility proof is awaiting verification; monthly allocation will remain locked until it is verified.')
      navigate(location.state?.from || '/dashboard', { replace: true, state: { profileSaved: true, proofStatus: reviewStatus } })
    } catch (submitError) {
      setError(submitError.message || 'We could not save your details. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="household-setup-page">
    <header className="setup-topbar"><Link to="/" className="setup-brand"><BrandMark compact/><strong>RationSaathi</strong></Link><span><ShieldCheck size={15}/> Private household setup</span></header>
    <div className="setup-layout">
      <aside className="setup-intro"><span className="setup-kicker">FIRST-TIME SETUP</span><h1>Let’s set up your household.</h1><p>We use your household details and eligibility proof to determine which official rules apply before showing an allocation.</p><div className="setup-progress-list"><div className={step >= 1 ? 'current' : ''}><span>{step > 1 ? <Check size={15}/> : '01'}</span><div><strong>Household details</strong><small>Family and ration-card information</small></div></div><div className={step >= 2 ? 'current' : ''}><span>02</span><div><strong>Eligibility proof</strong><small>Document upload and verification</small></div></div><div><span>03</span><div><strong>Monthly allocation</strong><small>Unlock after proof verification</small></div></div></div><div className="setup-privacy-note"><ShieldCheck size={19}/><span>Only upload documents needed to verify eligibility. Never send passwords, bank details, or unrelated identity documents.</span></div></aside>
      <section className="setup-form-card"><div className="setup-card-heading"><div><span className="setup-step-label">STEP {step} OF 2</span><h2>{step === 1 ? 'Household profile' : 'Verify eligibility'}</h2><p>{step === 1 ? 'Enter details exactly as they appear on the household documents.' : 'Upload proof so the backend can verify the card category and eligibility.'}</p></div><span className="setup-heading-icon">{step === 1 ? <Users size={23}/> : <FileCheck2 size={23}/>}</span></div>
        {error && <div className="setup-alert" role="alert">{error}</div>}
        {notice && <div className="setup-notice" role="status">{notice}</div>}
        <form onSubmit={submit}>
          {step === 1 ? <>
            <div className="setup-section-label">HEAD OF FAMILY</div>
            <div className="setup-form-grid"><label className="span-2">Full name<input value={values.head_name} onChange={(e)=>update('head_name',e.target.value)} autoComplete="name" required placeholder="Name as printed on card"/></label><label>Age<input type="number" min="18" max="120" value={values.head_age} onChange={(e)=>update('head_age',e.target.value)} required placeholder="Age"/></label><label>Gender<select value={values.head_gender} onChange={(e)=>update('head_gender',e.target.value)} required><option value="">Select gender</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></label><label>Ration card number (last 4 only)<input value={values.card_number_last4} onChange={(e)=>update('card_number_last4',e.target.value.replace(/\D/g,'').slice(0,4))} inputMode="numeric" maxLength={4} placeholder="Optional"/><small className="field-note">Do not enter the full card number here.</small></label></div>
            <div className="setup-section-label">HOUSEHOLD LOCATION AND CARD</div>
            <div className="setup-form-grid"><label>State / Union Territory<input value={values.state} onChange={(e)=>update('state',e.target.value)} required placeholder="e.g. Maharashtra"/></label><label>District<input value={values.district} onChange={(e)=>update('district',e.target.value)} required placeholder="District"/></label><label className="span-2">Locality (optional)<input value={values.locality} onChange={(e)=>update('locality',e.target.value)} placeholder="Town, village, or locality"/></label><label>Ration-card scheme/category<select value={values.card_type} onChange={(e)=>update('card_type',e.target.value)} required><option value="">Select category</option><option value="AAY">Antyodaya Anna Yojana (AAY)</option><option value="PHH">Priority Household (PHH)</option><option value="STATE_OTHER">Other state scheme</option><option value="UNKNOWN">Not sure / needs review</option></select></label><label>Card colour (as shown on card)<select value={values.card_colour} onChange={(e)=>update('card_colour',e.target.value)} required><option value="">Select colour</option><option value="yellow">Yellow</option><option value="orange">Orange</option><option value="white">White</option><option value="green">Green</option><option value="blue">Blue</option><option value="other">Other / unclear</option></select><small className="field-note">Colour alone does not determine entitlement; rules vary by state and scheme.</small></label></div>
            <div className="setup-section-label setup-members-title"><span>OTHER HOUSEHOLD MEMBERS</span><button type="button" className="setup-add-member" onClick={addMember}><UserRoundPlus size={15}/> Add member</button></div>
            <p className="field-note setup-member-explainer">The head of family is already counted as member 1. Add every other person in the household below.</p><div className="setup-members-list">{values.members.map((member,index)=><div className="setup-member-row" key={index}><div className="setup-member-index">{index + 1}</div><label>Name<input value={member.name} onChange={(e)=>updateMember(index,'name',e.target.value)} required placeholder="Member name"/></label><label>Age<input type="number" min="0" max="120" value={member.age} onChange={(e)=>updateMember(index,'age',e.target.value)} required placeholder="Age"/></label><label>Gender<select value={member.gender} onChange={(e)=>updateMember(index,'gender',e.target.value)} required><option value="">Select</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></label>{values.members.length>0&&<button className="setup-remove-member" type="button" onClick={()=>removeMember(index)} aria-label={`Remove member ${index+1}`}><Trash2 size={16}/></button>}</div>)}</div>
            <div className="setup-form-actions"><span>Fields marked by the browser as required must be completed.</span><button className="button button-primary" type="submit">Continue to proof <ArrowRight size={17}/></button></div>
          </> : <>
            <div className="proof-upload-box"><span className="proof-upload-icon"><FileUp size={27}/></span><h3>Upload ration card or eligibility proof</h3><p>PDF, JPG, PNG, or WEBP · Maximum 8 MB</p><label className="proof-file-button">{proof ? 'Choose a different file' : 'Choose document'}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e)=>{setProof(e.target.files?.[0]||null);setError('')}}/></label>{proof&&<div className="proof-file-selected"><FileCheck2 size={17}/><span><strong>{proof.name}</strong><small>{(proof.size/1024/1024).toFixed(2)} MB · selected locally</small></span><button type="button" onClick={()=>setProof(null)} aria-label="Remove proof"><Trash2 size={15}/></button></div>}</div>
            <div className="proof-review-note"><ShieldCheck size={19}/><div><strong>Verification comes before allocation</strong><p>Ration-card colours and eligibility rules vary by state and scheme. RationSaathi should use the backend’s verified rules—not guess a monthly quantity from colour alone. Your proof is pending until the verification service confirms it.</p></div></div>
            <label className="setup-consent"><input type="checkbox" required/><span>I confirm this document relates to this household and the information above is accurate.</span></label>
            <div className="setup-form-actions"><button type="button" className="button button-secondary" onClick={()=>{setStep(1);setError('')}}><ArrowLeft size={16}/> Back</button><button className="button button-primary" type="submit" disabled={busy||!proof}>{busy?'Submitting…':'Save profile & submit proof'} <ArrowRight size={17}/></button></div>
          </>}
        </form>
        <p className="setup-legal-note">RationSaathi is an independent information tool, not a government service. Eligibility and allocation must be confirmed against official scheme rules.</p>
      </section>
    </div>
  </main>
}
