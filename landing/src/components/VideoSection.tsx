import { useEffect, useRef, useState } from 'react'

export function VideoSection() {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [style, setStyle] = useState({
    width: '82%',
    borderRadius: '20px',
    boxShadow: '0 8px 60px rgba(0,0,0,0.12), 0 2px 12px rgba(0,0,0,0.08)',
  })

  useEffect(() => {
    const handleScroll = () => {
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const progress = Math.max(0, Math.min(1, 1 - rect.top / viewportHeight))

      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2

      setStyle({
        width: `${82 + eased * 10}%`,
        borderRadius: `${20 - eased * 8}px`,
        boxShadow: `0 8px ${60 + eased * 40}px rgba(0,0,0,${0.12 + eased * 0.12}), 0 2px 12px rgba(0,0,0,0.08)`,
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play()
          } else {
            video.pause()
          }
        })
      },
      { threshold: 0.1 }
    )

    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="video-scroll" className="relative" style={{ background: 'linear-gradient(to bottom, transparent 50%, var(--color-surface) 50%)' }}>
      <div className="flex justify-center pt-16">
        <div ref={containerRef} className="relative z-10 overflow-hidden" style={style}>
          <video ref={videoRef} className="w-full block" loop muted playsInline>
            <source src={`${import.meta.env.BASE_URL}video.mp4`} type="video/mp4" />
          </video>
        </div>
      </div>
    </section>
  )
}
