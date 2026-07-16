import { Home, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BrandMascot from '../components/BrandMascot'
import PageBackdrop from '../components/PageBackdrop'
import { Button, Card } from '../components/ui'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <main id="main-content" tabIndex={-1} className="relative isolate flex min-h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden px-4 py-12 outline-none sm:px-6">
      <PageBackdrop intensity="subtle" />
      <Card className="relative w-full max-w-xl overflow-hidden p-6 text-center sm:p-10">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
        <BrandMascot eager sizes="112px" className="mx-auto h-28 w-28 object-contain drop-shadow-[0_0_28px_oklch(60%_0.2_250_/_0.28)]" />
        <p className="mt-4 font-mono text-sm font-bold uppercase tracking-[0.24em] text-accent">Error 404</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-text-primary sm:text-4xl">This arena is off the map</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-text-secondary sm:text-base">
          The match or page you were looking for is no longer here. Head back to the lobby and choose another arena.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={() => navigate('/')} size="lg">
            <Home aria-hidden="true" className="h-4 w-4" />
            Back to lobby
          </Button>
          <Button variant="secondary" onClick={() => navigate(-1)} size="lg">
            <Search aria-hidden="true" className="h-4 w-4" />
            Go back
          </Button>
        </div>
      </Card>
    </main>
  )
}
