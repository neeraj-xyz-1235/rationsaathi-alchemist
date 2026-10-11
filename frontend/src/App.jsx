import { useCallback, useEffect, useState } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { ArrowLeft, CircleHelp, Construction, ShieldCheck, X } from 'lucide-react'
import Header from './components/layout/Header.jsx'
import Footer from './components/layout/Footer.jsx'
import Home from './pages/Home.jsx'
import AuthPage from './pages/AuthPage.jsx'
import Dashboard from './pages/Dashboard.jsx'
import LegalPage from './pages/LegalPage.jsx'
import WorkspacePage from './pages/WorkspacePage.jsx'
import ReportPage from './pages/ReportPage.jsx'
import ShopsPage from './pages/ShopsPage.jsx'
import AccountLayout from './components/layout/AccountLayout.jsx'
import RequireAuth from './components/layout/RequireAuth.jsx'
import RequireHouseholdProfile from './components/layout/RequireHouseholdProfile.jsx'
import HouseholdSetup from './pages/HouseholdSetup.jsx'
import WithdrawalPage from './pages/WithdrawalPage.jsx'
import MonthlyTrackerPage from './pages/MonthlyTrackerPage.jsx'
import EntitlementPage from './pages/EntitlementPage.jsx'
import { useLang } from './i18n/index.jsx'

function PlaceholderPage({ title, description, onBack }) {
  const { t } = useLang()
  return <main className="page-container placeholder-page"><div className="placeholder-card"><span className="placeholder-icon"><Construction size={30} aria-hidden="true" /></span><p className="section-eyebrow">{t('appName')}</p><h1>{title}</h1><p>{description}</p><button className="button button-primary" type="button" onClick={onBack}><ArrowLeft size={17} /> {t('backHome')}</button></div></main>
}

function HelpDialog({ open, onClose }) {
  const { t } = useLang()
  useEffect(() => { if (!open) return undefined; const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown) }, [open, onClose])
  if (!open) return null
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><button className="modal-close" type="button" onClick={onClose} aria-label={t('close')}><X size={20} /></button><span className="modal-symbol"><CircleHelp size={25} aria-hidden="true" /></span><h2 id="help-title">{t('helpTitle')}</h2><p>{t('helpText')}</p><div className="help-trust"><ShieldCheck size={18} /><span>{t('footerPrivacy')}</span></div><button type="button" className="button button-primary modal-done" onClick={onClose}>{t('close')}</button></section></div>
}

export default function App() {
  const navigate = useNavigate()
  const { t } = useLang()
  const [helpOpen, setHelpOpen] = useState(false)
  const openHelp = useCallback(() => setHelpOpen(true), [])
  const closeHelp = useCallback(() => setHelpOpen(false), [])
  const go = (path) => navigate(path)
  return <div className="app-shell"><a className="skip-link" href="#main-content">{t('skipContent')}</a><div id="main-content"><Routes>
    <Route path="/" element={<><Header onHelp={openHelp} /><Home onNavigate={go} /><Footer /><HelpDialog open={helpOpen} onClose={closeHelp} /></>} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/signup" element={<AuthPage mode="signup" />} />
    <Route element={<RequireAuth />}>
      <Route path="/setup" element={<HouseholdSetup />} />
      <Route element={<RequireHouseholdProfile />}><Route element={<AccountLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/help" element={<WorkspacePage type="help" />} />
        <Route path="/check" element={<EntitlementPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/tracker" element={<MonthlyTrackerPage />} />
        <Route path="/withdrawals" element={<WithdrawalPage />} />
        <Route path="/complaints" element={<WorkspacePage type="complaints" />} />
        <Route path="/shops" element={<ShopsPage />} />
      </Route></Route>
    </Route>
    <Route path="/privacy" element={<><Header onHelp={openHelp} /><LegalPage type="privacy" /><Footer /></>} />
    <Route path="/cookies" element={<><Header onHelp={openHelp} /><LegalPage type="cookies" /><Footer /></>} />
    <Route path="/terms" element={<><Header onHelp={openHelp} /><LegalPage type="terms" /><Footer /></>} />
    <Route path="*" element={<><Header onHelp={openHelp} /><PlaceholderPage title={t('notFound')} description={t('notFoundText')} onBack={() => go('/')} /><Footer /></>} />
  </Routes></div></div>
}
