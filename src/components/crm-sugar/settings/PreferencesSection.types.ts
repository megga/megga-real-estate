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
  spellcheck: boolean
  autosave: boolean
  aiAssist: string
}
