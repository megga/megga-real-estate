/**
 * L'après-vente d'une affaire conclue (proposition du 27.09.2026) : trois rappels pour l'agent, reconnus
 * sans migration par le couple `type = 'custom'` + `trigger_rule = 'days_after_event'`.
 *
 * ⛔ LE MARQUEUR EST UN CONTRAT. Si un autre écrivain posait ce couple, ses relances passeraient pour de
 * l'après-vente : elles quitteraient « Solder les relances » de la clôture et s'afficheraient dans la
 * section « Après-vente » de la fiche. D'où la confrontation aux écrivains connus de `days_after_event`.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ETAPES_APRES_VENTE, REGLE_APRES_VENTE, dateEtape, estApresVente, etapeDe,
} from '@/components/crm/pipeline/apresVente'

describe("l'après-vente", () => {
  it('trois étapes, dans l\'ordre, à 7, 30 et 365 jours', () => {
    expect(ETAPES_APRES_VENTE.map((e) => [e.cle, e.jours])).toEqual([['nouvelles', 7], ['recommandation', 30], ['anniversaire', 365]])
    for (const e of ETAPES_APRES_VENTE) expect(etapeDe(e.jours)).toBe(e.cle)
    expect(etapeDe(2)).toBeNull()
    expect(etapeDe(null)).toBeNull()
  })

  it('le marqueur : `custom` + `days_after_event`, et rien d\'autre', () => {
    expect(estApresVente({ type: 'custom', trigger_rule: REGLE_APRES_VENTE })).toBe(true)
    // Le « Premier suivi » du Pipeline et les relances de la fiche : `custom` + `manual`.
    expect(estApresVente({ type: 'custom', trigger_rule: 'manual' })).toBe(false)
    // Le moteur d'automatisation : `days_after_event`, mais avec SES types.
    expect(estApresVente({ type: 'post_visit_feedback', trigger_rule: REGLE_APRES_VENTE })).toBe(false)
    expect(estApresVente({ type: 'missing_document', trigger_rule: REGLE_APRES_VENTE })).toBe(false)
  })

  it('le moteur d\'automatisation n\'écrit jamais `custom` avec `days_after_event`', () => {
    const moteur = readFileSync('supabase/functions/automation-engine/index.ts', 'utf8')
    const blocs = moteur.split('createReminder({').slice(1).map((b) => b.slice(0, b.indexOf('})')))
    expect(blocs.length, 'motif cassé : aucun createReminder lu').toBeGreaterThan(0)
    for (const b of blocs) {
      if (b.includes("'days_after_event'")) expect(b, 'un rappel du moteur passerait pour de l\'après-vente').not.toContain("type: 'custom'")
    }
  })

  it('une étape tombe N jours plus tard, à 10 h', () => {
    const d = dateEtape(new Date(2026, 8, 27, 18, 42), 7)
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 4, 10, 0])
  })

  it('chaque étape a son libellé dans les quatre langues', () => {
    for (const l of ['fr', 'de', 'en', 'it']) {
      const j = JSON.parse(readFileSync(`src/i18n/locales/${l}/pipeline.json`, 'utf8')) as { apresVente?: { etapes?: Record<string, string> } }
      for (const e of ETAPES_APRES_VENTE) expect(j.apresVente?.etapes?.[e.cle], `${l} : ${e.cle}`).toBeTruthy()
    }
  })
})
