import React, { useState, useEffect, useRef, useCallback } from 'react'
import { FaGlobe, FaChevronDown, FaSearch, FaTimes, FaCheck } from 'react-icons/fa'
import './LanguageSelector.css'

const LANGUAGES = [
  { code: 'en',  label: 'English',    native: 'English',    flag: '🇬🇧' },
  { code: 'ml',  label: 'Malayalam',  native: 'മലയാളം',    flag: '🇮🇳' },
  { code: 'hi',  label: 'Hindi',      native: 'हिन्दी',     flag: '🇮🇳' },
  { code: 'ta',  label: 'Tamil',      native: 'தமிழ்',     flag: '🇮🇳' },
  { code: 'te',  label: 'Telugu',     native: 'తెలుగు',    flag: '🇮🇳' },
  { code: 'kn',  label: 'Kannada',    native: 'ಕನ್ನಡ',     flag: '🇮🇳' },
  { code: 'mr',  label: 'Marathi',    native: 'मराठी',     flag: '🇮🇳' },
  { code: 'or',  label: 'Odia',       native: 'ଓଡ଼ിଆ',     flag: '🇮🇳' },
  { code: 'bn',  label: 'Bengali',    native: 'বাংলা',     flag: '🇮🇳' },
  { code: 'gu',  label: 'Gujarati',   native: 'ગુજરાતી',   flag: '🇮🇳' },
  { code: 'pa',  label: 'Punjabi',    native: 'ਪੰਜਾਬੀ',   flag: '🇮🇳' },
  { code: 'ur',  label: 'Urdu',       native: 'اردو',       flag: '🇮🇳' },
  { code: 'as',  label: 'Assamese',   native: 'অসমীয়া',   flag: '🇮🇳' },
]


function getCookie(name) {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop().split(';').shift()
  return null
}

function setCookie(name, value) {
  const d = new Date()
  d.setTime(d.getTime() + 30 * 24 * 60 * 60 * 1000)
  const expires = "expires=" + d.toUTCString()

  document.cookie = `${name}=${value}; ${expires}; path=/`
  document.cookie = `${name}=${value}; ${expires}; path=/; domain=${window.location.hostname}`

  if (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    const parts = window.location.hostname.split('.')
    if (parts.length >= 2) {
      const mainDomain = parts.slice(-2).join('.')
      document.cookie = `${name}=${value}; ${expires}; path=/; domain=.${mainDomain}`
    }
  }
}

function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`
  if (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    const parts = window.location.hostname.split('.')
    if (parts.length >= 2) {
      const mainDomain = parts.slice(-2).join('.')
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${mainDomain}`
    }
  }
}

function triggerGTranslate(targetCode) {
  if (targetCode === 'en') {
    deleteCookie('googtrans')
    setCookie('googtrans', '/en/en')
  } else {
    setCookie('googtrans', `/en/${targetCode}`)
  }
  setTimeout(() => {
    window.location.reload()
  }, 150)
}

export default function LanguageSelector() {
  const [open, setOpen]       = useState(false)
  const [active, setActive]   = useState(() => {
    const saved = localStorage.getItem('rhc_lang') || 'en'
    return LANGUAGES.find(l => l.code === saved) || LANGUAGES[0]
  })
  const [search, setSearch]   = useState('')
  const [ready, setReady]     = useState(false)
  const wrapRef               = useRef(null)
  const searchRef             = useRef(null)


  useEffect(() => {
    window.googleTranslateElementInit = () => {
      try {
        if (!window.google?.translate) return
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: 'ml,hi,ta,te,kn,mr,or,bn,gu,pa,ur,as,en',
            autoDisplay: false,
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
          },
          'gte-hidden'
        )
        setReady(true)
      } catch (_) {}
    }

    if (!document.getElementById('gte-script')) {
      const s = document.createElement('script')
      s.id = 'gte-script'
      s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
      s.async = true
      s.defer = true
      s.onerror = () => { console.warn('Google Translate script failed to load') }
      document.head.appendChild(s)
    } else if (window.google?.translate) {
      setReady(true)
    } else {
      const check = setInterval(() => {
        if (window.google?.translate) { setReady(true); clearInterval(check) }
      }, 400)
      return () => clearInterval(check)
    }
  }, [])


  useEffect(() => {
    if (!ready) return
    const saved = localStorage.getItem('rhc_lang') || 'en'
    const currentCookie = getCookie('googtrans')

    let cookieLang = 'en'
    if (currentCookie) {
      const parts = currentCookie.split('/')
      cookieLang = parts[parts.length - 1] || 'en'
    }

    if (cookieLang !== saved) {
      if (saved === 'en') {
        deleteCookie('googtrans')
        setCookie('googtrans', '/en/en')
      } else {
        setCookie('googtrans', `/en/${saved}`)
      }
      window.location.reload()
    }
  }, [ready])


  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])


  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  }, [open])

  const selectLang = useCallback((lang) => {
    setActive(lang)
    localStorage.setItem('rhc_lang', lang.code)
    setOpen(false)
    setSearch('')
    triggerGTranslate(lang.code)
  }, [])

  const filtered = LANGUAGES.filter(l =>
    l.label.toLowerCase().includes(search.toLowerCase()) ||
    l.native.includes(search)
  )

  return (
    <>
      {}
      <div id="gte-hidden" style={{ display: 'none' }} />

      <div className="relative inline-flex items-center z-[3000]" ref={wrapRef}>
        {}
        <button
          className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-white border rounded-full cursor-pointer text-slate-700 font-bold ${
            active.code === 'en' ? 'text-[10px] sm:text-xs' : 'text-[9px] sm:text-[11px]'
          } transition-all shadow-sm focus:outline-none ${
            open
              ? 'bg-teal-50/50 border-teal-500 text-teal-600 shadow-md shadow-teal-900/5'
              : 'border-slate-200 hover:border-teal-500 hover:text-teal-600'
          }`}
          onClick={() => setOpen(p => !p)}
          title="Select Language"
          aria-label="Language selector"
        >
          <FaGlobe className={`flex-shrink-0 ${active.code === 'en' ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-xs'}`} />
          <span className={`text-center uppercase tracking-wide ${active.code === 'en' ? 'min-w-[14px] sm:min-w-[18px]' : 'min-w-[12px] sm:min-w-[15px]'}`}>
            {active.code}
          </span>
          <FaChevronDown className={`transition-transform duration-200 ${open ? 'rotate-180 text-teal-500' : 'text-slate-400'} ${active.code === 'en' ? 'text-[8px] sm:text-[10px]' : 'text-[7px] sm:text-[9px]'}`} />
        </button>

        {}
        {open && (
          <div className="absolute top-full mt-2 right-0 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden origin-top-right animate-dropdown-fade duration-200">

            {}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
              <span className="text-xs font-bold text-slate-700 tracking-wide uppercase">Select Language</span>
              <button
                className="w-5 h-5 rounded-full bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 flex items-center justify-center text-xs transition-colors cursor-pointer"
                onClick={() => setOpen(false)}
              >
                <FaTimes />
              </button>
            </div>

            {}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/50">
              <FaSearch className="text-slate-400 text-xs flex-shrink-0" />
              <input
                ref={searchRef}
                className="w-full bg-transparent border-none outline-none text-xs font-semibold text-slate-800 placeholder-slate-400"
                type="text"
                placeholder="Search language..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="w-4 h-4 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-[10px] cursor-pointer"
                  onClick={() => setSearch('')}
                >
                  <FaTimes />
                </button>
              )}
            </div>

            {}
            <ul className="max-h-60 overflow-y-auto custom-scrollbar divide-y divide-slate-50" role="listbox">
              {filtered.map(lang => {
                const isActive = active.code === lang.code;
                return (
                  <li
                    key={lang.code}
                    role="option"
                    aria-selected={isActive}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                      isActive ? 'bg-teal-50/30' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => selectLang(lang)}
                  >
                    <span className="text-lg flex-shrink-0 leading-none">{lang.flag}</span>
                    <div className="flex flex-col text-left flex-1 min-w-0">
                      <span className={`text-xs font-bold ${isActive ? 'text-teal-600' : 'text-slate-800'}`}>
                        {lang.label}
                      </span>
                      <span className={`text-[10px] ${isActive ? 'text-teal-500 font-bold' : 'text-slate-400 font-medium'}`}>
                        {lang.native}
                      </span>
                    </div>
                    {isActive && (
                      <FaCheck className="text-teal-600 text-xs flex-shrink-0" />
                    )}
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="px-4 py-6 text-center text-slate-400 text-xs italic">No language found</li>
              )}
            </ul>

            {}
            <div className="px-4 py-2 border-t border-slate-100 text-center bg-slate-50/30">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Powered by Google Translate</span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
