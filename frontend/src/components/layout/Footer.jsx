
import {
  HeartHandshake,
  ShieldCheck,
  Cookie,
  FileText,
  LockKeyhole,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import Logo from './Logo.jsx'
import { useLang } from '../../i18n/index.jsx'

export default function Footer() {
  const { t } = useLang()

  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand-block">
          <Logo compact />
          <p>{t('footerLine')}</p>
        </div>

        <div className="footer-link-groups">
          <div className="footer-link-group">
            <strong>RationSaathi</strong>
            <Link to="/">Home</Link>
            <Link to="/check">Check entitlement</Link>
            <Link to="/help">Help &amp; support</Link>
          </div>

          <div className="footer-link-group">
            <strong>Legal &amp; privacy</strong>
            <Link to="/privacy">
              <LockKeyhole size={14} />
              Privacy Policy
            </Link>
            <Link to="/cookies">
              <Cookie size={14} />
              Cookie Policy
            </Link>
            <Link to="/terms">
              <FileText size={14} />
              Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <span>
          <HeartHandshake size={15} aria-hidden="true" />
          {t('footerPrivacy')}
        </span>

        <span>
          <ShieldCheck size={15} aria-hidden="true" />
          © {new Date().getFullYear()} RationSaathi · Independent public-service tool
        </span>
      </div>
    </footer>
  )
}
