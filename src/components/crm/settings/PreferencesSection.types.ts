// Type partagé entre PreferencesSection.tsx et useUiPreferences.ts pour éviter
// la dépendance circulaire (le hook ne peut pas importer le composant).

export interface PrefsData {
  language: string
  timezone: string
  currency: string
  units: string
  dateFormat: string
  firstDayOfWeek: string
  defaultScreen: string
  defaultPipelineView: string
  density: string
  theme: string
  /** Couleur d'accent (settings Focus Préférences) — id de PXF_ACCENTS. */
  accent: string
  spellcheck: boolean
  autosave: boolean
  aiAssist: string
  /** Ton de rédaction de MEGGA AI (amicale | neutre | professionnel). */
  aiTone: string
}
