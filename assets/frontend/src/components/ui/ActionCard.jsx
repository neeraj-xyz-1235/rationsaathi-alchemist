import { ArrowUpRight } from 'lucide-react'
import { useLang } from '../../i18n/index.jsx'

export default function ActionCard({ icon: Icon, number, title, description, onClick, featured = false }) {
  const { t } = useLang()
  return (
    <button className={`action-card ${featured ? 'action-card--featured' : ''}`} type="button" onClick={onClick}>
      <span className="action-card-top">
        <span className="action-icon"><Icon size={25} strokeWidth={1.8} aria-hidden="true" /></span>
        <span className="action-number">{number}</span>
      </span>
      <span className="action-card-title">{title}</span>
      <span className="action-card-description">{description}</span>
      <span className="action-card-bottom">
        <span className="action-card-cta">{featured ? t('getStarted') : t('explore')}</span>
        <span className="action-arrow"><ArrowUpRight size={18} aria-hidden="true" /></span>
      </span>
    </button>
  )
}
