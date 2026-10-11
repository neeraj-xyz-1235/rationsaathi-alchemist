import { useLang } from '../../i18n/index.jsx'

const languages = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिंदी' },
  { id: 'mr', label: 'मराठी' },
]

export default function LanguagePill() {
  const { language, setLanguage, t } = useLang()
  return (
    <div className="language-switch" role="group" aria-label={t('language')}>
      {languages.map((item) => (
        <button
          type="button"
          key={item.id}
          className={`language-option ${language === item.id ? 'is-active' : ''}`}
          onClick={() => setLanguage(item.id)}
          aria-pressed={language === item.id}
          lang={item.id}
        >{item.label}</button>
      ))}
    </div>
  )
}
