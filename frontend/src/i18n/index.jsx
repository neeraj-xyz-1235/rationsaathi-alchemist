import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { common } from './common.js'
import { workspace } from './workspace.js'
import './extra.js'

const LanguageContext = createContext(null)
const STORAGE_KEY = 'rationsaathi.lang'

function initialLanguage() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'hi' || saved === 'mr') return saved
  } catch { /* storage can be blocked */ }
  return 'en'
}

// {name} placeholders are filled from params.
const fill = (text, params) => (params ? text.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`)) : text)

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(initialLanguage)
  const setLanguage = (next) => {
    setLanguageState(next)
    try { window.localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
  }
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])
  const value = useMemo(() => ({
    language,
    setLanguage,
    tItem: (name) => workspace[language]?.[`item_${String(name || '').toLowerCase()}`] ?? name,
    periodLabel: (period, fallback) => {
      try { return new Date(`${period}-01T12:00:00`).toLocaleDateString({ en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' }[language], { month: 'long', year: 'numeric' }) } catch { return fallback }
    },
    t: (key, params) => fill(
      workspace[language]?.[key] ?? common[language]?.[key] ?? workspace.en[key] ?? common.en[key] ?? key,
      params,
    ),
  }), [language])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLang must be used inside LanguageProvider')
  return context
}
