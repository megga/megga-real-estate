interface ListingFeaturesProps {
  features: Record<string, string> | string[]
}

export default function ListingFeatures({ features }: ListingFeaturesProps) {
  const entries = Array.isArray(features)
    ? features.map((f, i) => [f, ''] as [string, string])
    : Object.entries(features)

  if (!entries.length) return null

  return (
    <div id="caracteristiques" className="mt-8 scroll-mt-28">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Caractéristiques</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
        {entries.map(([key, value]) => (
          <div key={key} className="flex justify-between py-3 border-b border-gray-50">
            <span className="text-sm text-gray-500">{key}</span>
            {value && <span className="text-sm font-medium text-gray-900 text-right">{value}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
