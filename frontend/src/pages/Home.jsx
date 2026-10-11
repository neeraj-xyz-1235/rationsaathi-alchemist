import { useState } from 'react'
import { ArrowRight, ClipboardList, FileChartColumnIncreasing, Info, MapPinned, PackageCheck, UsersRound, Wheat, Check } from 'lucide-react'
import { useLang } from '../i18n/index.jsx'
import ActionCard from '../components/ui/ActionCard.jsx'
import EntitlementScanner from '../components/ui/EntitlementScanner.jsx'

const steps = [
  { icon: UsersRound, title: 'step1Title', description: 'step1Description' },
  { icon: ClipboardList, title: 'step2Title', description: 'step2Description' },
  { icon: PackageCheck, title: 'step3Title', description: 'step3Description' },
  { icon: FileChartColumnIncreasing, title: 'step4Title', description: 'step4Description' },
]

function FamilyIllustration({ label }) {
  return (
    <div className="illustration-wrap" aria-label={label} role="img">
      <div className="illustration-sun" />
      <div className="illustration-leaf leaf-one"><Wheat size={62} strokeWidth={1.35} /></div>
      <div className="grain-stalk stalk-one"><Wheat size={46} strokeWidth={1.25} /></div>
      <div className="grain-stalk stalk-two"><Wheat size={35} strokeWidth={1.25} /></div>
      <div className="family-art">
        <div className="person person-parent person-parent--left"><span className="person-hair"/><span className="person-head"/><span className="person-body"/><span className="person-arm"/></div>
        <div className="person person-parent person-parent--right"><span className="person-hair"/><span className="person-head"/><span className="person-body"/><span className="person-arm"/></div>
        <div className="person person-child person-child--left"><span className="person-hair"/><span className="person-head"/><span className="person-body"/><span className="person-arm"/></div>
        <div className="person person-child person-child--right"><span className="person-hair"/><span className="person-head"/><span className="person-body"/><span className="person-arm"/></div>
      </div>
      <div className="grain-sack"><span className="sack-knot"/><Wheat size={23} strokeWidth={1.6}/><span>GRAIN</span></div>
      <div className="illustration-ground" />
      <span className="floating-grain grain-dot-one"/><span className="floating-grain grain-dot-two"/><span className="floating-grain grain-dot-three"/>
    </div>
  )
}

export default function Home({ onNavigate }) {
  const { t } = useLang()
  const [showShopsInfo, setShowShopsInfo] = useState(false)

  return (
    <main id="home">
      <section className="hero-section page-container" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" />{t('heroEyebrow')}</div>
          <h1 id="hero-title">{t('heroTitle')}<br/><span>{t('heroTitleAccent')}</span></h1>
          <p className="hero-description">{t('heroDescription')}</p>
          <div className="hero-cta-row">
            <button type="button" className="button button-primary button-large" onClick={() => onNavigate('/check')}>
              {t('primaryCta')} <ArrowRight size={18} aria-hidden="true" />
            </button>
            <a className="button button-quiet button-large" href="#how-it-works">{t('secondaryCta')}</a>
          </div>
          <div className="trust-note"><span className="trust-check"><Check size={13}/></span>{t('trustNote')}</div>
        </div>
        <FamilyIllustration label={t('illustrationAlt')} />
        <div className="hero-swoosh" aria-hidden="true" />
      </section>

      <EntitlementScanner />

      <section className="actions-section page-container" aria-labelledby="action-title">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">{t('cardsEyebrow')}</p>
            <h2 id="action-title">{t('cardsTitle')}</h2>
          </div>
          <p className="section-description">{t('cardsDescription')}</p>
        </div>
        <div className="action-grid">
          <ActionCard icon={UsersRound} number="01" title={t('checkTitle')} description={t('checkDescription')} featured onClick={() => onNavigate('/check')} />
          <ActionCard icon={PackageCheck} number="02" title={t('addTitle')} description={t('addDescription')} onClick={() => onNavigate('/check?step=records')} />
          <ActionCard icon={FileChartColumnIncreasing} number="03" title={t('reportTitle')} description={t('reportDescription')} onClick={() => onNavigate('/check')} />
        </div>
      </section>

      <section className="how-section" id="how-it-works" aria-labelledby="how-title">
        <div className="page-container">
          <div className="section-heading section-heading--center">
            <p className="section-eyebrow">{t('howEyebrow')}</p>
            <h2 id="how-title">{t('howTitle')}</h2>
            <p className="section-description">{t('howDescription')}</p>
          </div>
          <div className="steps-grid">
            {steps.map(({ icon: Icon, title, description }, index) => (
              <div className="step-item" key={title}>
                <div className="step-icon-wrap"><span className="step-number">{index + 1}</span><Icon size={23} strokeWidth={1.8} aria-hidden="true" /></div>
                <h3>{t(title)}</h3>
                <p>{t(description)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="shop-banner page-container" aria-label={t('shopTitle')}>
        <div className="shop-icon"><MapPinned size={25} strokeWidth={1.7} /></div>
        <div className="shop-copy"><div className="shop-title-row"><h2>{t('shopTitle')}</h2><span className="coming-soon-chip">{t('comingSoon')}</span></div><p>{t('shopDescription')}</p></div>
        <button type="button" className="button button-outline shop-learn" onClick={() => setShowShopsInfo(true)}>{t('learnMore')} <ArrowRight size={16}/></button>
      </section>

      <section className="notice-section page-container">
        <div className="notice-icon"><Info size={20} aria-hidden="true" /></div>
        <div><h2>{t('noteTitle')}</h2><p>{t('noteText')}</p></div>
      </section>

      {showShopsInfo && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowShopsInfo(false) }}>
          <section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="shops-dialog-title">
            <span className="modal-symbol"><MapPinned size={25}/></span>
            <h2 id="shops-dialog-title">{t('shopTitle')}</h2>
            <p>{t('shopDescription')}</p>
            <p className="modal-muted">{t('shopFutureNote')}</p>
            <button type="button" className="button button-primary" onClick={() => setShowShopsInfo(false)}>{t('close')}</button>
          </section>
        </div>
      )}
    </main>
  )
}
