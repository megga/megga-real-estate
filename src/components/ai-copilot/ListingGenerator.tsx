import { useState } from 'react'
import { Sparkles, RefreshCw, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface ListingGeneratorProps {
  propertyTitle: string
  propertyType: string
  rooms: number
  surface: number
  city: string
  price: number
  features?: string[]
  className?: string
}

interface VersionConfig {
  key: string
  label: string
  description: string
}

const VERSIONS: VersionConfig[] = [
  { key: 'standard', label: 'Standard', description: 'Portails classiques' },
  { key: 'premium', label: 'Premium', description: 'Haut de gamme' },
  { key: 'luxe', label: 'Luxe', description: 'Prestige' },
  { key: 'courte', label: 'Courte', description: 'WhatsApp / SMS' },
  { key: 'social', label: 'Réseaux', description: 'Instagram / LinkedIn' },
]

function generateMockContent(version: string, props: ListingGeneratorProps): string {
  const { propertyTitle, propertyType, rooms, surface, city, price, features } = props
  const featList = features?.join(', ') || 'lumineux, calme'
  const priceFormatted = `CHF ${price.toLocaleString('fr-CH').replace(/,/g, "'")}`

  switch (version) {
    case 'standard':
      return `${propertyType === 'apartment' ? 'Appartement' : 'Bien'} de ${rooms} pièces à ${city}

Magnifique ${propertyType === 'apartment' ? 'appartement' : 'bien'} de ${rooms} pièces d'une surface de ${surface} m², idéalement situé à ${city}.

Ce bien lumineux offre des prestations de qualité : ${featList}. La cuisine est entièrement équipée et le séjour bénéficie d'une belle luminosité naturelle.

Situé dans un quartier recherché, à proximité des commerces, transports publics et écoles.

Surface habitable : ${surface} m²
Pièces : ${rooms}
Prix : ${priceFormatted}

N'hésitez pas à nous contacter pour organiser une visite.`

    case 'premium':
      return `${propertyTitle} — ${rooms} pièces d'exception à ${city}

Au cœur de ${city}, découvrez ce ${propertyType === 'apartment' ? 'appartement' : 'bien'} d'exception de ${rooms} pièces offrant ${surface} m² de surface habitable généreusement agencée.

Les espaces de vie, baignés de lumière naturelle, révèlent des finitions haut de gamme et des matériaux nobles soigneusement sélectionnés. La cuisine contemporaine, entièrement équipée, s'ouvre sur un séjour spacieux propice à la convivialité.

Les prestations incluent : ${featList}.

Un emplacement privilégié, alliant le charme du quartier à la proximité de toutes les commodités.

${surface} m² | ${rooms} pièces | ${priceFormatted}

Visite privée sur rendez-vous.`

    case 'luxe':
      return `Résidence d'exception — ${city}

Dans l'un des quartiers les plus prisés de ${city}, cette demeure d'exception de ${rooms} pièces incarne l'art de vivre suisse dans sa plus belle expression.

Déployé sur ${surface} m² magistralement orchestrés, chaque espace a été pensé pour sublimer le quotidien. Les volumes généreux, les perspectives lumineuses et le raffinement des matériaux confèrent à ce bien un caractère véritablement unique.

Les prestations d'exception comprennent : ${featList}. L'ensemble témoigne d'une attention absolue portée au moindre détail.

Une adresse confidentielle pour acquéreurs exigeants.

${priceFormatted} | Visite strictement sur rendez-vous

MEGGA — L'immobilier suisse d'excellence`

    case 'courte':
      return `🏠 ${rooms}p à ${city} — ${priceFormatted}
${surface} m², ${featList}
📍 Quartier recherché, proche commodités
📞 Visite possible cette semaine
👉 Plus d'infos : contactez-nous`

    case 'social':
      return `✨ Nouveau bien à ${city} ✨

${rooms} pièces | ${surface} m² | ${priceFormatted}

${propertyType === 'apartment' ? 'Appartement' : 'Bien'} ${featList} dans un quartier prisé de ${city}.

🔑 Les + :
• ${surface} m² de surface habitable
• Luminosité exceptionnelle
• Emplacement premium
• Finitions soignées

📩 DM pour organiser une visite privée

#immobilier #${city.toLowerCase().replace(/\s/g, '')} #suisse #realestate #luxuryrealestate #MEGGA`

    default:
      return ''
  }
}

export default function ListingGenerator({
  propertyTitle,
  propertyType,
  rooms,
  surface,
  city,
  price,
  features,
  className,
}: ListingGeneratorProps) {
  const [regenerating, setRegenerating] = useState<string | null>(null)
  const [copiedVersion, setCopiedVersion] = useState<string | null>(null)
  const [contents, setContents] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const v of VERSIONS) {
      initial[v.key] = generateMockContent(v.key, { propertyTitle, propertyType, rooms, surface, city, price, features })
    }
    return initial
  })

  function handleRegenerate(version: string) {
    setRegenerating(version)
    setTimeout(() => {
      setContents(prev => ({
        ...prev,
        [version]: generateMockContent(version, { propertyTitle, propertyType, rooms, surface, city, price, features }),
      }))
      setRegenerating(null)
    }, 1200)
  }

  function handleCopy(version: string) {
    navigator.clipboard.writeText(contents[version] || '')
    setCopiedVersion(version)
    setTimeout(() => setCopiedVersion(null), 2000)
  }

  return (
    <div className={cn('bg-white rounded-card shadow-card p-5', className)}>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-accent" />
        </div>
        <h2 className="text-sm font-semibold text-primary-900 uppercase tracking-wider">Génération d'annonces</h2>
        <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-badge flex items-center gap-1">
          <Sparkles className="h-2.5 w-2.5" />
          Généré par IA
        </span>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        5 versions adaptées à chaque canal. À relire et valider avant publication.
      </p>

      <Tabs defaultValue="standard">
        <TabsList className="w-full justify-start overflow-x-auto">
          {VERSIONS.map(v => (
            <TabsTrigger key={v.key} value={v.key} className="text-xs">
              {v.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {VERSIONS.map(v => (
          <TabsContent key={v.key} value={v.key}>
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{v.description}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">
                    {(contents[v.key] || '').length} caractères
                  </span>
                  <button
                    onClick={() => handleRegenerate(v.key)}
                    disabled={regenerating === v.key}
                    className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent/80 font-medium disabled:opacity-50"
                  >
                    <RefreshCw className={cn('h-3 w-3', regenerating === v.key && 'animate-spin')} />
                    Régénérer
                  </button>
                  <button
                    onClick={() => handleCopy(v.key)}
                    className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-900 font-medium"
                  >
                    {copiedVersion === v.key ? (
                      <><Check className="h-3 w-3 text-success" /> Copié</>
                    ) : (
                      <><Copy className="h-3 w-3" /> Copier</>
                    )}
                  </button>
                </div>
              </div>

              <textarea
                value={contents[v.key] || ''}
                onChange={e => setContents(prev => ({ ...prev, [v.key]: e.target.value }))}
                rows={v.key === 'courte' || v.key === 'social' ? 8 : 14}
                className={cn(
                  'w-full text-sm text-primary-700 bg-section border border-border rounded-input p-4',
                  'focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none leading-relaxed',
                  regenerating === v.key && 'opacity-50'
                )}
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
