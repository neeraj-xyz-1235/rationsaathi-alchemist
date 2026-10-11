import { useEffect, useState } from 'react'
import { Activity, Check, CheckCircle2, FileSearch, ScanLine, ShieldCheck, Wheat } from 'lucide-react'

const stages = [
  { label: 'Reading your entries', detail: 'Checking the quantities you entered', status: 'Reviewing' },
  { label: 'Comparing quantities', detail: 'Expected and recorded amounts side by side', status: 'Comparing' },
  { label: 'Comparison ready', detail: 'Review the evidence and each line carefully', status: 'Ready to review' },
]

export default function EntitlementScanner() {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setStage((current) => (current + 1) % stages.length), 3400)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <section className="scanner-showcase page-container" aria-labelledby="scanner-showcase-title">
      <div className="scanner-showcase-copy">
        <span className="scanner-kicker"><span className="scanner-live-dot" /> A clearer way to check</span>
        <h2 id="scanner-showcase-title">See the difference.<br /><span>Understand every line.</span></h2>
        <p>RationSaathi organises the rules and distribution details you provide into a clear, line-by-line comparison. No accusations, just information you can review.</p>
        <div className="scanner-trust-points">
          <span><Check size={15} /> Exact quantity comparison</span>
          <span><Check size={15} /> Evidence stays attached to entries</span>
          <span><Check size={15} /> You review before sharing</span>
        </div>
      </div>
      <div className="entitlement-scanner" aria-label="Illustrative ration comparison animation">
        <div className="scanner-card-top"><div className="scanner-card-brand"><span className="scanner-brand-icon"><Wheat size={16} /></span><div><strong>RationSaathi</strong><small>ENTITLEMENT CHECK</small></div></div><span className="scanner-status"><span />{stages[stage].status}</span></div>
        <div className="scanner-viewport">
          <div className="scanner-orbit orbit-one" /><div className="scanner-orbit orbit-two" />
          <div className="scanner-document">
            <div className="scanner-doc-head"><FileSearch size={18} /><span>MONTHLY SUMMARY</span><span className="scanner-doc-chip">DEMO</span></div>
            <div className="scanner-doc-rule" />
            <div className="scanner-item-row"><span className="scanner-grain-icon"><Wheat size={17} /></span><div className="scanner-item-name"><strong>Rice</strong><small>Example household · 4 members</small></div><div className="scanner-amount"><strong>20 kg</strong><small>Expected</small></div></div>
            <div className="scanner-doc-rule" />
            <div className="scanner-quantity-bars"><div><span>Recorded</span><div className="scanner-track"><span style={{ width: '70%' }} /></div><b>14 kg</b></div><div><span>Difference</span><div className="scanner-track scanner-track--amber"><span style={{ width: '30%' }} /></div><b className="scanner-difference">6 kg</b></div></div>
            <div className="scanner-scan-line" key={stage} />
          </div>
          <div className="scanner-float-tag scanner-tag-left"><ShieldCheck size={15} /><span>Evidence-aware</span></div>
          <div className="scanner-float-tag scanner-tag-right"><Activity size={15} /><span>Line by line</span></div>
        </div>
        <div className="scanner-progress"><div className="scanner-stage-row"><span className="scanner-stage-icon"><ScanLine size={17} /></span><div><strong>{stages[stage].label}</strong><small>{stages[stage].detail}</small></div><span className="scanner-step-count">0{stage + 1}/03</span></div><div className="scanner-progress-track"><span style={{ width: `${((stage + 1) / stages.length) * 100}%` }} /></div><div className="scanner-step-dots" aria-label={`Animation stage ${stage + 1} of ${stages.length}`}>{stages.map((item, index) => <span key={item.label} className={index <= stage ? 'is-active' : ''} />)}</div></div>
        <p className="scanner-disclaimer">Illustrative example only · No data is being scanned or submitted in this animation.</p>
      </div>
    </section>
  )
}
