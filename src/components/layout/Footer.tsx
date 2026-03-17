export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xl font-bold tracking-tight text-gray-900">MEGGA</span>
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} MEGGA Real Estate. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
