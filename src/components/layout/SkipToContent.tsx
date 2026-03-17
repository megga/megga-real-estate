export default function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-accent focus:text-white focus:px-4 focus:py-2 focus:rounded-button focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none"
    >
      Aller au contenu principal
    </a>
  )
}
