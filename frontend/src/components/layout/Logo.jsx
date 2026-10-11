import { Wheat } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLang } from '../../i18n/index.jsx'

export default function Logo({ compact = false }) {
  const { t } = useLang()
  return (
    <Link className={`brand ${compact ? 'brand--compact' : ''}`} to="/" aria-label={t('appName')}>
      <span className="brand-mark" aria-hidden="true"><Wheat size={28} strokeWidth={1.9} /></span>
      <span className="brand-copy">
        <span className="brand-name">{t('appName')}</span>
        {!compact && <span className="brand-tagline">{t('tagline')}</span>}
      </span>
    </Link>
  )
}
