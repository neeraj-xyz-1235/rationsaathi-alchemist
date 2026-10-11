import { useCallback, useEffect, useState } from 'react'
import { Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CircleHelp,
  Construction,
  ShieldCheck,
  X,
} from 'lucide-react'

import Header from './components/layout/Header.jsx'
import Footer from './components/layout/Footer.jsx'
import AccountLayout from './components/layout/AccountLayout.jsx'
import RequireAuth from './components/layout/RequireAuth.jsx'

import Home from './pages/Home.jsx'
import AuthPage from './pages/AuthPage.jsx'
import Dashboard from './pages/Dashboard.jsx'
import LegalPage from './pages/LegalPage.jsx'
import WorkspacePage from './pages/WorkspacePage.jsx'

import { useLang } from './i18n/index.jsx'
import { useAuth } from './context/AuthContext.jsx'
import CheckPage from './features/check/CheckPage.jsx'
import ReportPage from './features/report/ReportPage.jsx'
import SharedReportPage from './features/report/SharedReportPage.jsx'
import TrackerPage from './features/tracker/TrackerPage.jsx'
import ComplaintsPage from './features/complaints/ComplaintsPage.jsx'
import ShopsPage from './features/shops/ShopsPage.jsx'

function PlaceholderPage({ title, description, onBack }) {
  const { t } = useLang()

  return (
    <main className="page-container placeholder-page">
      <div className="placeholder-card">
        <span className="placeholder-icon">
          <Construction size={30} aria-hidden="true" />
        </span>

        <p className="section-eyebrow">{t('appName')}</p>
        <h1>{title}</h1>
        <p>{description}</p>

        <button
          className="button button-primary"
          type="button"
          onClick={onBack}
        >
          <ArrowLeft size={17} />
          {t('backHome')}
        </button>
      </div>
    </main>
  )
}

function HelpDialog({ open, onClose }) {
  const { t } = useLang()

  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
      >
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label={t('close')}
        >
          <X size={20} />
        </button>

        <span className="modal-symbol">
          <CircleHelp size={25} aria-hidden="true" />
        </span>

        <h2 id="help-title">{t('helpTitle')}</h2>
        <p>{t('helpText')}</p>

        <div className="help-trust">
          <ShieldCheck size={18} />
          <span>{t('footerPrivacy')}</span>
        </div>

        <button
          type="button"
          className="button button-primary modal-done"
          onClick={onClose}
        >
          {t('close')}
        </button>
      </section>
    </div>
  )
}

// Pages that work for guests too (the core check needs no account): logged-in users get the
// account layout with the sidebar, guests get the public header and footer. This is a
// module-level component on purpose: defining it inside App would remount the page (and wipe
// its form state) on every App render.
function Adaptive({ onHelp, helpOpen, onCloseHelp }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-loading" role="status">Loading…</div>
  if (user) return <AccountLayout />
  return (
    <>
      <Header onHelp={onHelp} />
      <Outlet />
      <Footer />
      <HelpDialog open={helpOpen} onClose={onCloseHelp} />
    </>
  )
}

export default function App() {
  const navigate = useNavigate()
  const { t } = useLang()
  const [helpOpen, setHelpOpen] = useState(false)

  const openHelp = useCallback(() => setHelpOpen(true), [])
  const closeHelp = useCallback(() => setHelpOpen(false), [])

  const go = (path) => navigate(path)

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t('skipContent')}
      </a>

      <div id="main-content">
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Header onHelp={openHelp} />
                <Home onNavigate={go} />
                <Footer />
                <HelpDialog
                  open={helpOpen}
                  onClose={closeHelp}
                />
              </>
            }
          />

          <Route
            path="/login"
            element={<AuthPage mode="login" />}
          />

          <Route
            path="/signup"
            element={<AuthPage mode="signup" />}
          />

          {/* works for guests and logged-in users */}
          <Route element={<Adaptive onHelp={openHelp} helpOpen={helpOpen} onCloseHelp={closeHelp} />}>
            <Route path="/check" element={<CheckPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/complaints" element={<ComplaintsPage />} />
            <Route path="/shops" element={<ShopsPage />} />
            <Route
              path="/help"
              element={<WorkspacePage type="help" />}
            />
          </Route>

          {/* login required */}
          <Route element={<RequireAuth />}>
            <Route element={<AccountLayout />}>
              <Route
                path="/dashboard"
                element={<Dashboard />}
              />
              <Route path="/tracker" element={<TrackerPage />} />
            </Route>
          </Route>

          {/* public, read-only shared report */}
          <Route
            path="/r/:reportId"
            element={
              <>
                <Header onHelp={openHelp} />
                <SharedReportPage />
                <Footer />
              </>
            }
          />

          <Route
            path="/privacy"
            element={
              <>
                <Header onHelp={openHelp} />
                <LegalPage type="privacy" />
                <Footer />
              </>
            }
          />

          <Route
            path="/cookies"
            element={
              <>
                <Header onHelp={openHelp} />
                <LegalPage type="cookies" />
                <Footer />
              </>
            }
          />

          <Route
            path="/terms"
            element={
              <>
                <Header onHelp={openHelp} />
                <LegalPage type="terms" />
                <Footer />
              </>
            }
          />

          <Route
            path="*"
            element={
              <>
                <Header onHelp={openHelp} />
                <PlaceholderPage
                  title={t('notFound')}
                  description={t('notFoundText')}
                  onBack={() => go('/')}
                />
                <Footer />
              </>
            }
          />
        </Routes>
      </div>
    </div>
  )
}