import { DownloadButton } from './DownloadButton'

export function Hero() {
  return (
    <section id="hero" className="sticky top-0 z-0 pt-33 pb-8 px-6 bg-surface">
      <div className="max-w-5xl mx-auto text-center">
        <h1
          className="text-6xl sm:text-7xl lg:text-8xl text-text tracking-tight leading-[1.15] mb-12"
          style={{ fontWeight: 500 }}
        >
          <span className="inline-flex items-center">
            <span className="inline-block w-[4px] h-[0.85em] bg-brand rounded-full mr-1.5" />
            Write,
          </span>{' '}
          <span style={{ fontFamily: "'Kalam', cursive", fontSize: '1.1em', lineHeight: 1 }}>
            Draw,
          </span>{' '}
          <span className="inline-flex items-center">
            <svg className="h-[0.7em] w-[0.7em] mr-1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="5" fill="#4A9FE8" />
              <path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Plan,
          </span>
          <br />
          at your Peak.
        </h1>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 drop-shadow-lg">
          <DownloadButton variant="brand" />
        </div>
      </div>
    </section>
  )
}
