import { HeartHandshake, ShieldCheck } from 'lucide-react'
import Logo from './Logo.jsx'
import { useLang } from '../../i18n/index.jsx'

export default function Footer() {
  const { t } = useLang()
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <Logo compact />
        <p>{t('footerLine')}</p>
      </div>
      <div className="footer-bottom">
        <span><HeartHandshake size={15} aria-hidden="true" /> {t('footerPrivacy')}</span>
        <span><ShieldCheck size={15} aria-hidden="true" /> RationSaathi</span>
      </div>
    </footer>
  )
}
