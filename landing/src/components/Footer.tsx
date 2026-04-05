import { useEffect, useState } from 'react'

function getInitialTheme(): 'light' | 'dark' | 'system' {
  const stored = localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') return stored
  return 'system'
}

function applyTheme(theme: 'light' | 'dark' | 'system') {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

export function Footer() {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
    if (theme === 'system') {
      localStorage.removeItem('theme')
    } else {
      localStorage.setItem('theme', theme)
    }
  }, [theme])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => { if (theme === 'system') applyTheme('system') }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const options = ['light', 'dark', 'system'] as const

  return (
    <footer className="relative bg-surface border-t border-border px-10 py-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">Intuitive. Simple. Peak.</p>
        <div className="flex items-center gap-1 rounded-xl bg-text/5 p-1">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => setTheme(opt)}
              className={`cursor-pointer group relative rounded-lg px-2.5 py-1.5 text-sm font-medium transition duration-200 outline-hidden ${theme === opt
                ? 'bg-surface text-text shadow-sm'
                : 'text-text-secondary hover:text-text'
                }`}
              aria-label={`Switch to ${opt} theme`}
            >
              {opt === 'light' && (
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              )}
              {opt === 'dark' && (
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
              {opt === 'system' && (
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </footer>
  )
}
