import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleHelp, Menu, X } from 'lucide-react'
import { useLang } from '../../i18n/index.jsx'
import Logo from './Logo.jsx'
import LanguagePill from './LanguagePill.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

export default function Header({ onHelp }) {
  const { t } = useLang()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const displayName =
    user?.display_name ||
    user?.displayName ||
    user?.name ||
    user?.email

  async function handleLogout() {
    if (loggingOut) return

    setLoggingOut(true)

    try {
      await logout()
    } finally {
      setMenuOpen(false)
      navigate('/', { replace: true })
      setLoggingOut(false)
    }
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Logo />

        <div className="header-actions">
          <LanguagePill />

          <nav
            className={`main-nav ${menuOpen ? 'main-nav--open' : ''}`}
            aria-label={t('homeNavigation')}
          >
            <Link to="/" onClick={() => setMenuOpen(false)}>
              {t('home')}
            </Link>

            <button
              type="button"
              className="nav-link-button"
              onClick={() => {
                onHelp?.()
                setMenuOpen(false)
              }}
            >
              {t('help')}
            </button>

            {user ? (
              <>
                <span className="header-user-name">
                  {displayName}
                </span>

                <button
                  type="button"
                  className="nav-link-button"
                  disabled={loggingOut}
                  onClick={handleLogout}
                >
                  {loggingOut ? 'Logging out…' : 'Log out'}
                </button>
              </>
            ) : (
              <Link
                className="nav-login"
                to="/login"
                onClick={() => setMenuOpen(false)}
              >
                {t('login')}
              </Link>
            )}
          </nav>

          <button
            className="help-icon-button"
            type="button"
            onClick={onHelp}
            aria-label={t('help')}
            title={t('help')}
          >
            <CircleHelp size={21} strokeWidth={1.8} />
          </button>

          <button
            className="mobile-menu-button"
            type="button"
            aria-label={menuOpen ? t('close') : t('menu')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </header>
  )
}