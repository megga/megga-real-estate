import { useState, useMemo, useRef } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Search } from 'lucide-react';

type Category = 'Juridique' | 'Fiscal' | 'Technique' | 'Financement' | 'Conformité';

interface GlossaryTerm {
  name: string;
  definition: string;
  category: Category;
}

const CATEGORY_COLORS: Record<Category, string> = {
  Juridique: 'text-blue-600',
  Fiscal: 'text-amber-600',
  Technique: 'text-emerald-600',
  Financement: 'text-purple-600',
  Conformité: 'text-red-600',
};

const GLOSSARY_TERMS: GlossaryTerm[] = [
  // Juridique
  {
    name: 'PPE (Propriété par Étages)',
    definition: 'Régime de copropriété suisse où chaque lot constitue un droit distinct inscrit au registre foncier. Chaque copropriétaire détient une quote-part et un droit exclusif sur ses locaux.',
    category: 'Juridique',
  },
  {
    name: 'Servitude',
    definition: "Droit réel limité grevant un immeuble au profit d'un autre immeuble ou d'une personne. Exemples courants : droit de passage, servitude de vue, servitude de conduites.",
    category: 'Juridique',
  },
  {
    name: 'Droit de superficie',
    definition: "Droit de construire et de maintenir une construction sur le terrain d'autrui, inscrit au registre foncier. Fréquent pour les terrains communaux en Suisse.",
    category: 'Juridique',
  },
  {
    name: 'Usufruit',
    definition: "Droit d'utiliser un bien immobilier et d'en percevoir les revenus (loyers) sans en être propriétaire. Souvent utilisé dans le cadre de successions ou de donations.",
    category: 'Juridique',
  },
  {
    name: 'Droit de préemption',
    definition: "Droit d'acquérir un bien en priorité, à conditions égales, lorsque le propriétaire décide de le vendre. Peut être légal (copropriétaires PPE) ou conventionnel.",
    category: 'Juridique',
  },
  {
    name: 'Acte authentique',
    definition: "Document rédigé et certifié par un notaire ayant force exécutoire. En Suisse, tout transfert de propriété immobilière requiert obligatoirement un acte authentique.",
    category: 'Juridique',
  },
  {
    name: 'Registre foncier',
    definition: "Registre officiel cantonal où sont inscrits tous les droits réels immobiliers : propriété, servitudes, gages, annotations. Il fait foi publiquement.",
    category: 'Juridique',
  },
  {
    name: 'Note hypothécaire',
    definition: "Ancien terme désignant la cédule hypothécaire de registre. Titre de gage immobilier inscrit au registre foncier servant de garantie pour un prêt.",
    category: 'Juridique',
  },
  {
    name: 'Cédule hypothécaire',
    definition: "Titre de gage immobilier suisse, support juridique de l'hypothèque. Existe sous forme de registre (dématérialisée) ou sur papier. Indispensable pour tout financement bancaire.",
    category: 'Juridique',
  },
  {
    name: 'Compromis de vente',
    definition: "Accord préliminaire entre vendeur et acheteur fixant les conditions de la vente. En Suisse, il n'a pas la même valeur contraignante que dans d'autres pays sans acte notarié.",
    category: 'Juridique',
  },
  {
    name: 'Mandat exclusif',
    definition: "Contrat de courtage où un seul agent est mandaté pour vendre le bien. Offre un meilleur engagement de l'agent et une stratégie de commercialisation cohérente.",
    category: 'Juridique',
  },
  {
    name: 'Mandat simple',
    definition: "Contrat de courtage non exclusif permettant au propriétaire de mandater plusieurs agents simultanément ou de vendre lui-même. Moins d'investissement de l'agent.",
    category: 'Juridique',
  },
  // Fiscal
  {
    name: 'Impôt foncier',
    definition: "Impôt cantonal et/ou communal prélevé annuellement sur la valeur fiscale du bien immobilier. Le taux varie selon le canton (de 0.1% à 0.3% en général).",
    category: 'Fiscal',
  },
  {
    name: 'Valeur locative',
    definition: "Revenu fictif ajouté au revenu imposable du propriétaire qui occupe son bien. Correspond à environ 60-70% du loyer de marché selon le canton.",
    category: 'Fiscal',
  },
  {
    name: 'Gain immobilier (impôt)',
    definition: "Impôt cantonal prélevé sur la plus-value réalisée lors de la vente d'un bien immobilier. Le taux diminue avec la durée de détention dans la plupart des cantons.",
    category: 'Fiscal',
  },
  {
    name: 'Droits de mutation',
    definition: "Taxe cantonale prélevée lors du transfert de propriété immobilière. Varie de 0% (Zurich, Schwytz) à 3.3% (Vaud). À Genève, les émoluments du registre foncier s'appliquent.",
    category: 'Fiscal',
  },
  {
    name: 'Amortissement',
    definition: "Déduction fiscale permettant de tenir compte de la dépréciation d'un immeuble de rendement. Également utilisé pour désigner le remboursement progressif de l'hypothèque.",
    category: 'Fiscal',
  },
  // Technique
  {
    name: 'CECB (Certificat Énergétique Cantonal)',
    definition: "Diagnostic énergétique officiel des bâtiments en Suisse, classant leur performance de A (excellent) à G (très mauvais). Obligatoire à la vente dans certains cantons.",
    category: 'Technique',
  },
  {
    name: 'Minergie',
    definition: "Label suisse de construction basse consommation énergétique. Trois niveaux : Minergie (standard), Minergie-P (passif), Minergie-A (production d'énergie positive).",
    category: 'Technique',
  },
  {
    name: 'Indice de dépense de chaleur',
    definition: "Mesure la consommation d'énergie de chauffage d'un bâtiment en kWh/m² par an. Un indice bas signifie une bonne isolation et une faible consommation.",
    category: 'Technique',
  },
  {
    name: 'COS (Coefficient d\'Occupation du Sol)',
    definition: "Rapport entre la surface au sol occupée par la construction et la surface totale de la parcelle. Défini par le plan d'aménagement communal.",
    category: 'Technique',
  },
  {
    name: 'IUS (Indice d\'Utilisation du Sol)',
    definition: "Rapport entre la surface brute de plancher totale et la surface de la parcelle. Détermine la densité de construction autorisée sur un terrain.",
    category: 'Technique',
  },
  {
    name: 'Plan de quartier',
    definition: "Plan d'aménagement détaillé définissant les règles de construction spécifiques à un périmètre donné. Prévaut sur le règlement communal général.",
    category: 'Technique',
  },
  {
    name: 'SIA (norme)',
    definition: "Normes éditées par la Société suisse des Ingénieurs et des Architectes. Elles régissent les calculs de surfaces (SIA 416), les honoraires et les standards de construction.",
    category: 'Technique',
  },
  // Financement
  {
    name: 'Hypothèque 1er rang',
    definition: "Prêt bancaire couvrant jusqu'à 65% de la valeur du bien immobilier. Pas d'obligation d'amortissement dans la plupart des cas en Suisse.",
    category: 'Financement',
  },
  {
    name: 'Hypothèque 2e rang',
    definition: "Prêt couvrant la tranche entre 65% et 80% de la valeur du bien. Doit être amortie en 15 ans ou avant l'âge de la retraite (obligation légale).",
    category: 'Financement',
  },
  {
    name: 'Taux de charge',
    definition: "Ratio entre les charges annuelles du bien (intérêts, amortissement, entretien) et le revenu brut du ménage. Ne doit pas dépasser 33% selon la règle suisse.",
    category: 'Financement',
  },
  {
    name: 'Fonds propres',
    definition: "Apport personnel minimum de 20% du prix d'achat exigé en Suisse. Au moins 10% doit provenir de fonds propres « durs » (épargne, 3e pilier, donation), hors 2e pilier.",
    category: 'Financement',
  },
  {
    name: 'Amortissement direct / indirect',
    definition: "Direct : remboursement régulier réduisant la dette hypothécaire. Indirect : versements dans un 3e pilier A nanti en faveur de la banque, offrant un avantage fiscal.",
    category: 'Financement',
  },
  {
    name: 'Nantissement',
    definition: "Mise en gage d'un avoir (pilier 3a, police d'assurance-vie) au profit de la banque comme garantie supplémentaire pour le prêt hypothécaire.",
    category: 'Financement',
  },
  {
    name: '2e pilier (retrait / mise en gage)',
    definition: "L'avoir de prévoyance professionnelle peut être utilisé pour l'achat d'un logement principal : soit par retrait anticipé, soit par mise en gage auprès de la banque.",
    category: 'Financement',
  },
  {
    name: 'Taux d\'intérêt imputé',
    definition: "Taux théorique de 5% utilisé par les banques suisses pour calculer la capacité financière de l'emprunteur, indépendamment du taux réel du marché.",
    category: 'Financement',
  },
  // Conformité
  {
    name: 'LAB (Loi anti-blanchiment)',
    definition: "Loi fédérale imposant des obligations de diligence aux intermédiaires financiers, y compris les courtiers immobiliers. Requiert l'identification du client et la vérification de l'origine des fonds.",
    category: 'Conformité',
  },
  {
    name: 'KYC (Know Your Customer)',
    definition: "Processus de vérification de l'identité du client, de son activité économique et de l'origine de ses fonds. Obligatoire avant toute transaction immobilière en Suisse.",
    category: 'Conformité',
  },
  {
    name: 'PEP (Personne Politiquement Exposée)',
    definition: "Personne exerçant ou ayant exercé une fonction publique importante (chef d'État, ministre, parlementaire, etc.). Nécessite une vigilance accrue dans le processus KYC.",
    category: 'Conformité',
  },
  {
    name: 'UBO (Ultimate Beneficial Owner)',
    definition: "Ayant droit économique : personne physique qui contrôle effectivement une entité juridique ou pour le compte de laquelle une transaction est réalisée.",
    category: 'Conformité',
  },
  {
    name: 'GAFI / FATF',
    definition: "Groupe d'Action Financière Internationale. Organisme intergouvernemental fixant les standards mondiaux de lutte contre le blanchiment et le financement du terrorisme.",
    category: 'Conformité',
  },
  {
    name: 'nLPD (nouvelle Loi Protection des Données)',
    definition: "Nouvelle loi fédérale suisse sur la protection des données, entrée en vigueur le 1er septembre 2023. Renforce les droits des personnes et les obligations des entreprises.",
    category: 'Conformité',
  },
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function GlossairePage() {
  const [search, setSearch] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const filteredTerms = useMemo(() => {
    if (!search.trim()) return GLOSSARY_TERMS;
    const q = search.toLowerCase();
    return GLOSSARY_TERMS.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    );
  }, [search]);

  const termsByLetter = useMemo(() => {
    const grouped: Record<string, GlossaryTerm[]> = {};
    for (const term of filteredTerms) {
      // Use first meaningful letter (skip numbers/special chars)
      let letter = term.name.charAt(0).toUpperCase();
      if (letter === '2') letter = 'D'; // "2e pilier" → D for Deuxième
      if (!ALPHABET.includes(letter)) letter = '#';
      if (!grouped[letter]) grouped[letter] = [];
      grouped[letter].push(term);
    }
    // Sort terms within each letter
    for (const letter of Object.keys(grouped)) {
      grouped[letter].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }
    return grouped;
  }, [filteredTerms]);

  const availableLetters = useMemo(() => new Set(Object.keys(termsByLetter)), [termsByLetter]);

  const scrollToLetter = (letter: string) => {
    setActiveLetter(letter);
    const el = document.getElementById(`letter-${letter}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Glossaire immobilier suisse
          </h1>
          <p className="text-gray-500 text-base">
            Tous les termes essentiels de l'immobilier suisse expliqués simplement.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un terme..."
            className="w-full h-11 pl-10 pr-4 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 transition-colors"
          />
        </div>

        {/* Alphabet navigation */}
        <div className="flex flex-wrap gap-1.5 mb-8">
          {ALPHABET.map((letter) => {
            const available = availableLetters.has(letter);
            return (
              <button
                key={letter}
                onClick={() => available && scrollToLetter(letter)}
                disabled={!available}
                className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
                  activeLetter === letter
                    ? 'bg-gray-900 text-white'
                    : available
                      ? 'text-gray-600 hover:bg-gray-100'
                      : 'text-gray-300 cursor-default'
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>

        {/* Terms by letter */}
        <div ref={contentRef}>
          {filteredTerms.length === 0 && (
            <p className="text-gray-500 text-sm py-12 text-center">
              Aucun terme ne correspond a votre recherche.
            </p>
          )}

          {ALPHABET.filter((l) => termsByLetter[l]).map((letter) => (
            <div key={letter} id={`letter-${letter}`}>
              <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3">
                {letter}
              </h2>
              <div className="space-y-2">
                {termsByLetter[letter].map((term) => (
                  <div
                    key={term.name}
                    className="p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-base font-semibold text-gray-900">
                        {term.name}
                      </h3>
                      <span
                        className={`text-xs font-medium shrink-0 ml-3 ${CATEGORY_COLORS[term.category]}`}
                      >
                        {term.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {term.definition}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
