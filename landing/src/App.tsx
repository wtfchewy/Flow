import { Nav } from './components/Nav'
import { Hero } from './components/Hero'
import { VideoSection } from './components/VideoSection'
import { Features } from './components/Features'
import { Footer } from './components/Footer'

export default function App() {
  return (
    <>
      <Nav />
      <Hero />
      <main className="relative z-10">
        <VideoSection />
        <Features />
        <Footer />
      </main>
    </>
  )
}
