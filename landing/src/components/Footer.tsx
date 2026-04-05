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

const S = 5
const COLS = 8
const ROWS = 20
const PW = COLS * S
const PH = ROWS * S

// Dither gradient: 0% (top) → 100% (bottom)
const DITHER: number[][] = [
  [],
  [],
  [4],
  [1],
  [0, 4],
  [2, 6],
  [1, 4, 7],
  [0, 2, 4, 6],
  [1, 3, 5, 7],
  [0, 2, 4, 5, 7],
  [0, 2, 3, 4, 6, 7],
  [0, 1, 2, 4, 5, 6, 7],
]

// 5×5 pixel-art icons
const ICONS: Record<string, [number, number][]> = {
  light: [
    // Diamond / sun
    [2, 0],
    [1, 1], [2, 1], [3, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
    [1, 3], [2, 3], [3, 3],
    [2, 4],
  ],
  dark: [
    // Crescent moon
    [2, 0], [3, 0],
    [1, 1],
    [1, 2],
    [1, 3],
    [2, 4], [3, 4],
  ],
  system: [
    // Monitor
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
    [0, 1], [4, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
    [2, 3],
    [1, 4], [2, 4], [3, 4],
  ],
}

const OPTIONS = ['light', 'dark', 'system'] as const

export function Footer() {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
    if (theme === 'system') localStorage.removeItem('theme')
    else localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (theme === 'system') applyTheme('system')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return (
    <footer className="relative" style={{ height: PH }}>
      {/* Full-width dither background */}
      <svg
        className="absolute inset-0 w-full h-full text-border"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        <defs>
          <pattern id="dither-footer" patternUnits="userSpaceOnUse" width={PW} height={PH}>
            <g fill="currentColor">
              {DITHER.map((cols, row) =>
                cols.map((col) => (
                  <rect key={`${col}-${row}`} x={col * S} y={row * S} width={S} height={S} />
                ))
              )}
              {/* Solid band */}
              <rect y={12 * S} width={PW} height={8 * S} />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dither-footer)" />
      </svg>

      {/* Theme toggle — pixel buttons embedded in the solid band */}
      <div
        className="absolute inset-x-0 bottom-0 flex items-center justify-center"
        style={{ height: 8 * S }}
      >
        <div className="flex" style={{ gap: S }}>
          {OPTIONS.map((opt) => {
            const active = theme === opt
            return (
              <button
                key={opt}
                onClick={() => setTheme(opt)}
                className="group relative flex items-center justify-center cursor-pointer outline-hidden"
                style={{ width: 7 * S, height: 7 * S }}
                aria-label={`Switch to ${opt} theme`}
              >
                {/* Surface "window" — opens on active / hover */}
                <div
                  className={`absolute inset-0 bg-surface transition-all duration-300 ease-out ${
                    active
                      ? 'opacity-100 scale-100'
                      : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
                  }`}
                />

                {/* Pixel-art icon:
                    Active  → text color on surface window
                    Inactive → surface color punched through dither (icon = tiny holes)
                    Hover   → text color as window opens */}
                <svg
                  className={`relative transition-colors duration-300 ${
                    active
                      ? 'text-text'
                      : 'text-surface group-hover:text-text'
                  }`}
                  style={{ width: 5 * 3, height: 5 * 3 }}
                  viewBox="0 0 5 5"
                  shapeRendering="crispEdges"
                >
                  {ICONS[opt].map(([x, y]) => (
                    <rect
                      key={`${x}-${y}`}
                      x={x}
                      y={y}
                      width={1}
                      height={1}
                      fill="currentColor"
                    />
                  ))}
                </svg>
              </button>
            )
          })}
        </div>
      </div>
    </footer>
  )
}
