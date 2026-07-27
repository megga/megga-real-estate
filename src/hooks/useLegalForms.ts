// MEGGA CRM — Référentiel des formes juridiques (table legal_forms).
// Alimente le menu de la ligne « Forme juridique » des Réglages → Agence.
// Le libellé suit la langue de l'interface ; le filtrage suit le PAYS du siège de
// l'agence, car « SA », « AG » et « GmbH » désignent des formes différentes selon
// la juridiction — présenter les 3 pays mélangés serait ambigu.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'

/**
 * Mêmes valeurs que le CHECK de legal_forms.category (migration
 * 20260726130000_legal_forms_reference.sql). Pilote l'étape 3 du wizard identité
 * (bénéficiaires effectifs, tâche 5) : sole_proprietorship = le signataire EST
 * l'entité, pas d'UBO tiers à déclarer ; foundation_or_trust = structure opaque,
 * diligence renforcée. Décrite ici (pas seulement dans le SQL) parce que c'est la
 * frontière TypeScript que les consommateurs (useAgencyIdentity, étape 3) lisent.
 */
export type LegalFormCategory = 'corporation' | 'partnership' | 'sole_proprietorship' | 'foundation_or_trust'

export interface LegalFormOption {
  id: string
  label: string
  category: LegalFormCategory
}

interface LegalFormRow {
  id: string
  country: string
  category: LegalFormCategory
  label_fr: string
  label_de: string
  label_en: string
  label_it: string
  sort_order: number
}

/**
 * `agencies.country` est de la saisie libre (« Suisse », « CH », « Switzerland »…) :
 * on le ramène à un code ISO. Même table de correspondance que le backfill SQL de
 * 20260726120100 — les deux doivent rester alignés. `null` = pays non reconnu.
 */
function toCountryCode(country?: string | null): string | null {
  // NFD décompose les accents en (lettre + marque combinante) ; le filtre [^a-z]
  // qui suit élimine les marques au même titre que la ponctuation.
  const norm = (country ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z]/g, '')
  if (['ch', 'suisse', 'switzerland', 'schweiz', 'svizzera', 'che'].includes(norm)) return 'CH'
  if (['fr', 'france', 'fra'].includes(norm)) return 'FR'
  if (['li', 'liechtenstein', 'lie'].includes(norm)) return 'LI'
  return null
}

function labelFor(row: LegalFormRow, language: string): string {
  if (language.startsWith('de')) return row.label_de
  if (language.startsWith('en')) return row.label_en
  if (language.startsWith('it')) return row.label_it
  return row.label_fr
}

/**
 * Options de forme juridique pour le pays du siège. Pays non reconnu → toutes les
 * formes, suffixées du code pays pour lever l'ambiguïté des sigles homonymes.
 */
export function useLegalForms(country?: string | null): { options: LegalFormOption[]; isLoading: boolean } {
  const { i18n } = useTranslation()
  const code = toCountryCode(country)

  const { data, isLoading } = useQuery({
    queryKey: ['legal-forms', code],
    queryFn: async (): Promise<LegalFormRow[]> => {
      let q = supabase
        .from('legal_forms')
        .select('id, country, category, label_fr, label_de, label_en, label_it, sort_order')
        .order('sort_order', { ascending: true })
      if (code) q = q.eq('country', code)
      // .returns<>() : database.ts type `category` en `string` générique (généré
      // depuis un CHECK, pas un enum Postgres) — même motif que PersonRow dans
      // useAgencyIdentity.ts pour role/signature_power.
      const { data: rows, error } = await q.returns<LegalFormRow[]>()
      if (error) throw error
      return rows ?? []
    },
    // Données de référence : elles ne bougent qu'au rythme des migrations.
    staleTime: 60 * 60_000,
  })

  const options = useMemo<LegalFormOption[]>(() => {
    const rows = data ?? []
    return rows.map((r) => ({
      id: r.id,
      label: code ? labelFor(r, i18n.language) : `${labelFor(r, i18n.language)} · ${r.country}`,
      category: r.category,
    }))
  }, [data, code, i18n.language])

  return { options, isLoading }
}
