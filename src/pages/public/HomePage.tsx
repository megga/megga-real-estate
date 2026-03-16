export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="h-16 border-b border-border flex items-center px-6 shadow-navbar sticky top-0 bg-white z-50">
        <span className="text-xl font-bold tracking-tight">MEGGA</span>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-16">
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">
          Trouvez votre bien idéal
        </h1>
        <p className="text-center text-muted-foreground text-lg mb-8">
          Premier portail immobilier suisse avec recherche intelligente
        </p>
      </main>
    </div>
  )
}
