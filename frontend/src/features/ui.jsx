import { AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react'
import './screens.css'

const ICONS = { info: Info, note: AlertTriangle, ok: CheckCircle2, bad: AlertTriangle }

export function Alert({ kind = 'info', children, lines }) {
  const Icon = ICONS[kind] || Info
  return (
    <div className={`rs-alert ${kind}`} role={kind === 'bad' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden="true" />
      <div>
        {children}
        {lines && lines.length > 0 && <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      </div>
    </div>
  )
}

export function Field({ label, hint, error, children, className = '' }) {
  return (
    <label className={`rs-field ${error ? 'has-error' : ''} ${className}`}>
      {label}
      {children}
      {hint && !error && <span className="rs-hint">{hint}</span>}
      {error && <p className="rs-error" role="alert">{error}</p>}
    </label>
  )
}

export function Spinner({ children = 'Loading…' }) {
  return (
    <div className="rs-spinner" role="status">
      <Loader2 size={22} className="rs-spin" aria-hidden="true" /> <span>{children}</span>
    </div>
  )
}

export function Chip({ kind = 'slate', children }) {
  return <span className={`rs-chip ${kind}`}>{children}</span>
}

export function PageHead({ eyebrow = 'RationSaathi', title, subtitle, children }) {
  return (
    <div className="rs-head">
      <div>
        <p className="rs-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="rs-actions rs-no-print">{children}</div>}
    </div>
  )
}
