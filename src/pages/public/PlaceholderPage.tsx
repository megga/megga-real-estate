import { Link } from 'react-router-dom';
import { type LucideIcon } from 'lucide-react';
import HomeStickyHeader from '@/components/home/HomeStickyHeader';
import Footer from '@/components/layout/Footer';

interface PlaceholderPageProps {
  icon: LucideIcon;
  subtitle: string;
}

export default function PlaceholderPage({ icon: Icon, subtitle }: PlaceholderPageProps) {
  return (
    <>
      <HomeStickyHeader alwaysShow />
      <main className="min-h-[calc(100vh-64px-200px)] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <Icon className="w-16 h-16 text-accent/20 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Cette page arrive bientôt</h1>
          <p className="text-sm text-gray-500 mb-8">{subtitle}</p>
          <Link
            to="/"
            className="inline-flex items-center px-6 py-2.5 text-sm font-medium text-accent border border-accent rounded-full hover:bg-accent/5 transition-colors"
          >
            Retour à l'accueil
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
