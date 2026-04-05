import { DownloadButton } from './DownloadButton'

export function Nav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-lg bg-surface/50">
      <div className="px-10 py-5 flex items-center justify-between">
        <a href="/" className="group flex items-center outline-hidden" aria-label="Go home">
          <div className="relative mr-3 size-10 overflow-hidden rounded-xl border-[2.5px] border-brand">
            <svg className="absolute inset-0 size-full origin-center transition delay-50 duration-300 ease-out group-hover:-translate-x-full group-hover:scale-x-50 group-hover:scale-y-75 group-hover:opacity-25 group-hover:delay-0" viewBox="0 0 8 8" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true">
              <rect width="8" height="8" fill="#93E2FD"/>
              <g fill="#1E96EB">
                {/* Row 0: 100% */}
                <rect y="0" width="8" height="1"/>
                {/* Row 1: ~88% */}
                <rect y="1" width="8" height="1"/>
                <rect x="4" y="1" width="1" height="1" fill="#93E2FD"/>
                {/* Row 2: 75% checkerboard */}
                <rect x="0" y="2" width="1" height="1"/><rect x="2" y="2" width="1" height="1"/><rect x="3" y="2" width="1" height="1"/><rect x="4" y="2" width="1" height="1"/><rect x="6" y="2" width="1" height="1"/><rect x="7" y="2" width="1" height="1"/>
                {/* Row 3: 50% checkerboard */}
                <rect x="0" y="3" width="1" height="1"/><rect x="2" y="3" width="1" height="1"/><rect x="4" y="3" width="1" height="1"/><rect x="6" y="3" width="1" height="1"/>
                {/* Row 4: 50% offset */}
                <rect x="1" y="4" width="1" height="1"/><rect x="3" y="4" width="1" height="1"/><rect x="5" y="4" width="1" height="1"/><rect x="7" y="4" width="1" height="1"/>
                {/* Row 5: 25% */}
                <rect x="0" y="5" width="1" height="1"/><rect x="4" y="5" width="1" height="1"/>
                {/* Row 6: 12% */}
                <rect x="2" y="6" width="1" height="1"/>
                {/* Row 7: 0% - all light */}
              </g>
            </svg>
            <svg className="absolute inset-0 m-auto size-5 fill-current text-brand ease origin-right translate-x-0.5 scale-50 opacity-0 blur-xs transition duration-300 group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100 group-hover:blur-none group-hover:delay-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-text">Peak</div>
        </a>
        <div className="flex items-center gap-2">
          <a className="group inline-flex items-center justify-center outline-hidden transition duration-300 hover:bg-text/5 focus:ring-2 focus:ring-brand/90 rounded-2xl px-5 py-4 text-lg font-bold not-sm:bg-text/5" href="/faqs" aria-label="Frequently asked questions">
            <svg className="size-[22px] origin-bottom fill-current transition duration-300 group-hover:-rotate-12 sm:mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" aria-hidden="true">
              <path d="M13.8906 26.9805C14.418 26.9805 14.9102 26.7578 15.3789 25.9492L17.5469 22.3281H21.4609C24.9531 22.3281 26.8281 20.3945 26.8281 16.9609V7.98438C26.8281 4.55078 24.9531 2.61719 21.4609 2.61719H6.36719C2.875 2.61719 1 4.53906 1 7.98438V16.9609C1 20.4062 2.875 22.3281 6.36719 22.3281H10.2344L12.4023 25.9492C12.8711 26.7578 13.3633 26.9805 13.8906 26.9805Z" />
              <path className="text-surface origin-top-left stroke-current stroke-2 transition duration-250 group-hover:-rotate-3 group-hover:delay-50" d="M8 14H16M8 10H20.25" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:block">FAQs</span>
          </a>
          <DownloadButton className="not-sm:hidden" />
        </div>
      </div>
    </nav>
  )
}
