import { DownloadButton } from './DownloadButton'

export function Nav() {
  return (
    <nav className=" inset-x-0 z-50 backdrop-blur-lg bg-surface/50">
      <div className="px-10 py-5 flex items-center justify-between">
        <a href="https://github.com/wtfchewy/Peak" className="group flex items-center outline-hidden" aria-label="GitHub">
          <div className="relative mr-3 size-11 overflow-hidden rounded-xl border-[2.5px] border-brand p-[3px]">
            <svg className="absolute inset-[3px] size-[calc(100%-6px)] rounded-lg origin-center transition delay-50 duration-300 ease-out group-hover:-translate-x-full group-hover:scale-x-50 group-hover:scale-y-75 group-hover:opacity-25 group-hover:delay-0" viewBox="0 0 12 12" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
              <rect width="12" height="12" fill="#93E2FD" />
              <g fill="#1E96EB">
                {/* Row 0: 100% — solid */}
                <rect y="0" width="12" height="1" />
                {/* Row 1: 92% */}
                <rect y="1" width="12" height="1" />
                <rect x="5" y="1" width="1" height="1" fill="#93E2FD" />
                {/* Row 2: 83% */}
                <rect y="2" width="12" height="1" />
                <rect x="3" y="2" width="1" height="1" fill="#93E2FD" /><rect x="9" y="2" width="1" height="1" fill="#93E2FD" />
                {/* Row 3: 75% */}
                <rect y="3" width="12" height="1" />
                <rect x="2" y="3" width="1" height="1" fill="#93E2FD" /><rect x="7" y="3" width="1" height="1" fill="#93E2FD" /><rect x="10" y="3" width="1" height="1" fill="#93E2FD" />
                {/* Row 4: 67% */}
                <rect x="0" y="4" width="1" height="1" /><rect x="1" y="4" width="1" height="1" /><rect x="3" y="4" width="1" height="1" /><rect x="5" y="4" width="1" height="1" /><rect x="6" y="4" width="1" height="1" /><rect x="8" y="4" width="1" height="1" /><rect x="10" y="4" width="1" height="1" /><rect x="11" y="4" width="1" height="1" />
                {/* Row 5: 58% */}
                <rect x="0" y="5" width="1" height="1" /><rect x="2" y="5" width="1" height="1" /><rect x="4" y="5" width="1" height="1" /><rect x="6" y="5" width="1" height="1" /><rect x="8" y="5" width="1" height="1" /><rect x="10" y="5" width="1" height="1" /><rect x="11" y="5" width="1" height="1" />
                {/* Row 6: 50% — even checkerboard */}
                <rect x="0" y="6" width="1" height="1" /><rect x="2" y="6" width="1" height="1" /><rect x="4" y="6" width="1" height="1" /><rect x="6" y="6" width="1" height="1" /><rect x="8" y="6" width="1" height="1" /><rect x="10" y="6" width="1" height="1" />
                {/* Row 7: 42% — odd checkerboard */}
                <rect x="1" y="7" width="1" height="1" /><rect x="3" y="7" width="1" height="1" /><rect x="5" y="7" width="1" height="1" /><rect x="9" y="7" width="1" height="1" /><rect x="11" y="7" width="1" height="1" />
                {/* Row 8: 33% */}
                <rect x="0" y="8" width="1" height="1" /><rect x="4" y="8" width="1" height="1" /><rect x="7" y="8" width="1" height="1" /><rect x="10" y="8" width="1" height="1" />
                {/* Row 9: 25% */}
                <rect x="2" y="9" width="1" height="1" /><rect x="6" y="9" width="1" height="1" /><rect x="10" y="9" width="1" height="1" />
                {/* Row 10: 17% */}
                <rect x="1" y="10" width="1" height="1" /><rect x="8" y="10" width="1" height="1" />
                {/* Row 11: 8% */}
                <rect x="5" y="11" width="1" height="1" />
              </g>
            </svg>
            <svg className="absolute inset-0 m-auto size-5 fill-current text-brand ease origin-right translate-x-0.5 scale-50 opacity-0 blur-xs transition duration-300 group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100 group-hover:blur-none group-hover:delay-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-text">Peak</div>
        </a>
        <div className="flex items-center gap-2">
          <a className="group inline-flex items-center justify-center outline-hidden transition duration-300 hover:bg-text/5 focus:ring-2 focus:ring-brand/90 rounded-2xl px-5 py-4 text-lg font-bold not-sm:bg-text/5" href="/app" aria-label="New Note">
            <svg className="h-6 w-6 fill-current transition duration-300 origin-bottom group-hover:-rotate-12 sm:mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true">
              <path d="M160 544C124.7 544 96 515.3 96 480L96 160C96 124.7 124.7 96 160 96L480 96C515.3 96 544 124.7 544 160L544 373.5C544 390.5 537.3 406.8 525.3 418.8L418.7 525.3C406.7 537.3 390.4 544 373.4 544L160 544zM485.5 368L392 368C378.7 368 368 378.7 368 392L368 485.5L485.5 368z" />
            </svg>
            <span className="hidden sm:block">New Note</span>
          </a>
          <DownloadButton className="not-sm:hidden" />
        </div>
      </div>
    </nav>
  )
}
