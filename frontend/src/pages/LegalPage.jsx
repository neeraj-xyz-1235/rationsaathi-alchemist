import { Link } from 'react-router-dom'
import { ArrowLeft, Cookie, FileText, LockKeyhole, ShieldCheck } from 'lucide-react'
import Logo from '../components/layout/Logo.jsx'

const content = {
  privacy: {
    icon: LockKeyhole,
    eyebrow: 'YOUR INFORMATION',
    title: 'Privacy policy',
    intro: 'RationSaathi helps people compare ration entitlements with recorded distributions. We aim to collect only the information needed to provide the features you choose to use.',
    sections: [
      ['Information you enter', 'Depending on the features you use, this may include a household label, household member count, entitlement rules, distribution dates and quantities, notes, receipt references, and text you choose to paste from a receipt. Please do not enter Aadhaar numbers, bank details, or other unnecessary sensitive identifiers.'],
      ['How information is used', 'Information is used to prepare the comparison and report you request, support account features when available, and help troubleshoot the service. Receipt text may be sent to a configured parsing provider to produce suggestions. You should review and confirm every extracted value.'],
      ['Storage and sharing', 'Saved cases and account information may be stored by the service when those features are enabled. A report link may be viewable by anyone who has that link; share it only with people you trust. We do not claim that this prototype is a government database or an official government service.'],
      ['Your choices', 'You can use the basic entitlement check without creating an account where that feature is available. Avoid entering details you do not need. Contact the project team through the published support channel to ask about data access or deletion once those processes are supported.'],
      ['Changes', 'This policy may change as the prototype evolves. The version published on this page should be reviewed before relying on the service.']
    ]
  },
  cookies: {
    icon: Cookie,
    eyebrow: 'CLEAR & SIMPLE',
    title: 'Cookie policy',
    intro: 'Cookies are small pieces of data stored by your browser. RationSaathi is designed to use only the browser storage needed for core functionality.',
    sections: [
      ['Essential session cookie', 'When you sign in, the backend may set an HttpOnly session cookie to keep you signed in. It is intended for authentication, uses a limited lifetime, and is not available to ordinary JavaScript running in the page. In local development, cookie security settings may differ from production.'],
      ['Preferences', 'The interface may keep temporary preferences, such as the language selected during your visit. These preferences are used to make the interface easier to use, not to identify you for advertising.'],
      ['Analytics and advertising', 'This prototype does not intentionally add advertising cookies. If analytics or third-party services are introduced in a future release, this policy should be updated to describe them before they are enabled.'],
      ['Managing cookies', 'You can clear cookies through your browser settings. Clearing the session cookie will usually sign you out. Blocking essential cookies may prevent login or other account features from working properly.']
    ]
  },
  terms: {
    icon: FileText,
    eyebrow: 'PLEASE READ',
    title: 'Terms & conditions',
    intro: 'By using RationSaathi, you understand that it is an independent assistance tool intended to help organise ration information and compare entries you provide.',
    sections: [
      ['Not an official government service', 'RationSaathi is not a government website and is not affiliated with or endorsed by a government department unless explicitly stated otherwise. It does not access or change official ration-card records.'],
      ['User-provided information', 'You are responsible for checking the household details, entitlement rules, quantities, dates, and evidence you enter. The application applies the rules provided by you; it does not independently establish your legal entitlement.'],
      ['Reports are informational', 'A difference may be caused by incomplete records, a stock shortage, a timing issue, an entry error, or another explanation. A calculated shortfall is not proof of misconduct or fraud. Use neutral wording and contact the appropriate official channel if you need a formal review.'],
      ['Receipt parsing', 'Any receipt-reading output is a suggestion only. Verify and confirm it before relying on it. The application should not use AI-generated suggestions as the source of arithmetic; calculations should be performed by the deterministic calculation service.'],
      ['Availability and limitations', 'This prototype may contain unfinished features, errors, or downtime. It is provided for informational assistance and does not replace official records, legal advice, or decisions by the relevant authority.'],
      ['Acceptable use and updates', 'Do not misuse the service, attempt to access other users’ information, or submit content you are not authorised to share. These terms may be updated as the project changes. Continued use after an update means you accept the updated terms.']
    ]
  }
}

export default function LegalPage({ type }) {
  const page = content[type] ?? content.privacy
  const Icon = page.icon
  return (
    <main className="legal-page page-container">
      <div className="legal-topbar"><Link to="/" className="legal-back"><ArrowLeft size={16} /> Back to home</Link><Logo compact /></div>
      <article className="legal-card">
        <div className="legal-icon"><Icon size={24} /></div>
        <p className="section-eyebrow">{page.eyebrow}</p>
        <h1>{page.title}</h1>
        <p className="legal-intro">{page.intro}</p>
        <div className="legal-meta"><ShieldCheck size={15} /> Plain-language summary · Last reviewed October 11, 2026</div>
        {page.sections.map(([heading, body]) => <section className="legal-section" key={heading}><h2>{heading}</h2><p>{body}</p></section>)}
        <div className="legal-note"><ShieldCheck size={18} /><p>This is prototype policy text and should be reviewed for your actual hosting, data retention, third-party providers, and applicable legal requirements before public launch.</p></div>
      </article>
    </main>
  )
}
