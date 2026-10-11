import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useLang } from '../i18n/index.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { loginSchema, signupSchema } from '../validation/auth.js'
import BrandMark from '../components/layout/BrandMark.jsx'

export default function AuthPage({ mode = 'login' }) {
  const isSignup = mode === 'signup'
  const { t } = useLang()
  const { login, signup } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [values, setValues] = useState({ displayName: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const update = (key, value) => { setValues((old) => ({ ...old, [key]: value })); setErrors((old) => ({ ...old, [key]: undefined })); setServerError('') }
  const onSubmit = async (event) => {
    event.preventDefault(); setServerError('')
    const schema = isSignup ? signupSchema : loginSchema
    const parsed = schema.safeParse(values)
    if (!parsed.success) {
      const next = {}
      for (const issue of parsed.error.issues) if (!next[issue.path[0]]) next[issue.path[0]] = issue.message
      setErrors(next); return
    }
    setErrors({}); setBusy(true)
    try {
      if (isSignup) await signup({ email: parsed.data.email, password: parsed.data.password, display_name: parsed.data.displayName || undefined })
      else await login({ email: parsed.data.email, password: parsed.data.password })
      const requested = new URLSearchParams(location.search).get('next')
      const safeNext = requested && requested.startsWith('/') && !requested.startsWith('//') ? requested : '/dashboard'
      navigate(safeNext, { replace: true })
    } catch (error) {
      // The backend answers { error: { code: 'VALIDATION_FAILED', fields: { password: 'PASSWORD_TOO_COMMON' } } }
      // (plan_backend.txt 2.5). Turn each field code into a sentence on the matching input.
      const fieldMessages = {
        EMAIL_INVALID: 'Enter a valid email address.',
        PASSWORD_TOO_SHORT: 'Use at least 10 characters.',
        PASSWORD_TOO_LONG: 'Password must be 128 characters or fewer.',
        PASSWORD_TOO_COMMON: t('passwordCommon'),
        NAME_TOO_LONG: 'Name must be 50 characters or fewer.',
      }
      const formKey = { display_name: 'displayName' }
      const fieldErrors = error.fields && typeof error.fields === 'object'
        ? Object.fromEntries(Object.entries(error.fields).map(([k, v]) => [formKey[k] || k, fieldMessages[Array.isArray(v) ? v[0] : String(v)] || t('authUnavailable')]))
        : {}
      if (Object.keys(fieldErrors).length) setErrors(fieldErrors)
      const code = Object.keys(fieldErrors).length ? '' : error.code === 'INVALID_CREDENTIALS' ? t('authInvalidCredentials') : error.code === 'RATE_LIMITED' ? `${t('authRateLimited')} ${Math.max(1, Math.ceil((error.retryAfter || 60) / 60))} ${t('minutes')}.` : error.code === 'EMAIL_UNAVAILABLE' ? t('emailUnavailable') : t('authUnavailable')
      setServerError(code)
    } finally { setBusy(false) }
  }

  const field = ({ id, label, icon: Icon, type = 'text', autoComplete, hint, secret = false, show = false, toggle }) => (
    <div className="auth-field" key={id}>
      <label htmlFor={id}>{label}</label>
      <div className={`auth-input-wrap ${errors[id] ? 'has-error' : ''}`}>
        <Icon className="auth-input-icon" size={18} aria-hidden="true" />
        <input id={id} name={id} type={secret ? (show ? 'text' : 'password') : type} autoComplete={autoComplete} value={values[id]} onChange={(e) => update(id, e.target.value)} aria-invalid={Boolean(errors[id])} aria-describedby={errors[id] ? `${id}-error` : hint ? `${id}-hint` : undefined} />
        {secret && <button className="password-toggle" type="button" onClick={toggle} aria-label={show ? t('hidePassword') : t('showPassword')}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
      </div>
      {errors[id] && <p className="field-error" id={`${id}-error`} role="alert">{errors[id]}</p>}
      {!errors[id] && hint && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}
    </div>
  )

  return <main className="auth-page page-container">
    <div className="auth-back-row"><Link to="/" className="back-link"><ArrowLeft size={16} /> {t('home')}</Link><span className="secure-note"><ShieldCheck size={15} /> {t('privacyFirst')}</span></div>
    <section className="auth-layout">
      <aside className="auth-promo">
        <div className="auth-promo-pattern" aria-hidden="true" />
        <div className="auth-promo-content">
          <div className="auth-brand-lockup"><BrandMark /><div><strong>{t('appName')}</strong><span>{t('tagline')}</span></div></div>
          <p className="auth-kicker">{t('authKicker')}</p>
          <h1>{isSignup ? t('signupPromoTitle') : t('loginPromoTitle')}</h1>
          <p className="auth-promo-copy">{t('authPromoCopy')}</p>
          <div className="auth-promo-points">
            <div><CheckCircle2 size={19} /><span>{t('authPoint1')}</span></div>
            <div><CheckCircle2 size={19} /><span>{t('authPoint2')}</span></div>
            <div><CheckCircle2 size={19} /><span>{t('authPoint3')}</span></div>
          </div>
          <div className="auth-promo-quote"><span>“</span><p>{t('authQuote')}</p><small>{t('authQuoteCaption')}</small></div>
        </div>
        <div className="auth-promo-bottom"><LockKeyhole size={15} /> {t('authSessionNote')}</div>
      </aside>
      <div className="auth-card-wrap">
        <div className="auth-card">
          <div className="auth-mobile-brand"><BrandMark compact /><span>{t('appName')}</span></div>
          <span className="auth-step-pill"><span /> {isSignup ? t('signupPill') : t('loginPill')}</span>
          <h2>{isSignup ? t('signupHeading') : t('loginHeading')}</h2>
          <p className="auth-intro">{isSignup ? t('signupIntro') : t('loginIntro')}</p>
          {serverError && <div className="form-alert" role="alert">{serverError}</div>}
          <form onSubmit={onSubmit} noValidate>
            {isSignup && field({ id: 'displayName', label: t('fullName'), icon: UserRound, autoComplete: 'name' })}
            {field({ id: 'email', label: t('emailAddress'), icon: Mail, type: 'email', autoComplete: 'email' })}
            {field({ id: 'password', label: t('password'), icon: LockKeyhole, autoComplete: isSignup ? 'new-password' : 'current-password', secret: true, show: showPassword, toggle: () => setShowPassword((v) => !v), hint: isSignup ? t('passwordHint') : undefined })}
            {isSignup && field({ id: 'confirmPassword', label: t('confirmPassword'), icon: LockKeyhole, autoComplete: 'new-password', secret: true, show: showConfirm, toggle: () => setShowConfirm((v) => !v) })}
            {!isSignup && <div className="auth-form-meta"><label className="remember-check"><input type="checkbox" /> <span>{t('rememberDevice')}</span></label><button type="button" className="text-button" onClick={() => setServerError(t('resetNotAvailable'))}>{t('forgotPassword')}</button></div>}
            <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? <span className="button-spinner" aria-hidden="true" /> : null}{busy ? t('pleaseWait') : isSignup ? t('createAccount') : t('login')}<ArrowRight size={18} /></button>
          </form>
          <div className="auth-switch">{isSignup ? t('alreadyHaveAccount') : t('newToRationSaathi')} <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? t('login') : t('createAccount')}</Link></div>
          <div className="auth-divider"><span>{t('or')}</span></div>
          <Link className="guest-link" to="/check">{t('continueGuest')} <ArrowRight size={16} /></Link>
          <p className="auth-disclaimer">{t('notGovernment')}</p>
        </div>
      </div>
    </section>
  </main>
}
