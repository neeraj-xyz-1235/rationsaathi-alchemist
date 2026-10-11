import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { common } from './common.js'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en')
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])
  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (key) => common[language]?.[key] ?? common.en[key] ?? key,
  }), [language])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLang must be used inside LanguageProvider')
  return context
}
