// Invariants de la copie des rappels automatiques, dans les quatre langues.
//
// Ce banc ne juge PAS la qualité d'une traduction — aucun test ne le peut. Il fige ce
// qu'une relecture humaine ne tient pas de façon fiable sur 5 gabarits × 4 langues, et que
// la relecture adverse a effectivement dû vérifier à la main : les variables, la structure
// en paragraphes, et les deux fautes typographiques qui coûtent le plus cher ici.
//
// ⚠ Ces textes ne sont couverts par AUCUNE autre garde. `lint:prose` ne lit que
// `src/i18n/locales/`, et `lint:i18n-keys` ne connaît pas `supabase/functions/`.

import { describe, it, expect } from 'vitest'
import { REMINDER_TEMPLATES, reminderTemplate } from './reminder-templates'
import type { ReminderTemplateKind } from './reminder-templates'
import type { AppLocale } from './recipient-language'

const LANGUES: AppLocale[] = ['fr', 'de', 'en', 'it']
const TYPES: ReminderTemplateKind[] = [
  'follow_up_sent_property',
  'post_visit_feedback',
  'dormant_lead',
  'missing_document',
  'custom',
]

const variables = (s: string) => (s.match(/\{\{[\w.]+\}\}/g) ?? []).sort()

describe('gabarits de rappel, quatre langues', () => {
  it('les quatre langues couvrent les cinq types', () => {
    for (const l of LANGUES) {
      for (const t of TYPES) {
        expect(REMINDER_TEMPLATES[l][t]?.subject, `${l}/${t}`).toBeTruthy()
        expect(REMINDER_TEMPLATES[l][t]?.body, `${l}/${t}`).toBeTruthy()
      }
    }
  })

  it('les variables sont IDENTIQUES au français, langue par langue', () => {
    // Le vrai risque de ce chantier : une traduction qui perd `{{agency.name}}` produit un
    // e-mail qui se termine sur le nom de l'agent et rien d'autre. Invisible à la relecture,
    // fatal à l'envoi.
    for (const t of TYPES) {
      const attendu = variables(REMINDER_TEMPLATES.fr[t].body)
      for (const l of LANGUES) {
        expect(variables(REMINDER_TEMPLATES[l][t].body), `${l}/${t}`).toEqual(attendu)
      }
    }
  })

  it("aucune variable dans l'objet", () => {
    // L'objet n'est PAS interpolé au même endroit que le corps ; une variable qui s'y
    // glisserait partirait telle quelle dans la boîte du destinataire.
    for (const l of LANGUES) {
      for (const t of TYPES) {
        expect(REMINDER_TEMPLATES[l][t].subject, `${l}/${t}`).not.toMatch(/\{\{/)
      }
    }
  })

  it('même découpage en paragraphes que le français', () => {
    // Le gabarit découpe le corps sur les doubles sauts pour en faire des <p>. Un
    // paragraphe fusionné change le rendu sans rien changer au texte.
    for (const t of TYPES) {
      const attendu = REMINDER_TEMPLATES.fr[t].body.split('\n\n').length
      for (const l of LANGUES) {
        expect(REMINDER_TEMPLATES[l][t].body.split('\n\n').length, `${l}/${t}`).toBe(attendu)
      }
    }
  })

  it('aucun tiret cadratin ni demi-cadratin', () => {
    for (const l of LANGUES) {
      for (const t of TYPES) {
        const { subject, body } = REMINDER_TEMPLATES[l][t]
        expect(subject, `${l}/${t}`).not.toMatch(/[–—]/)
        expect(body, `${l}/${t}`).not.toMatch(/[–—]/)
      }
    }
  })

  it("l'allemand est celui de SUISSE : aucun eszett", () => {
    // Règle absolue du produit (CLAUDE.md §6, megga/i18n-methode-traduction-suisse) : « ss »
    // partout. Une seule occurrence trahit une traduction faite pour l'Allemagne.
    for (const t of TYPES) {
      const { subject, body } = REMINDER_TEMPLATES.de[t]
      expect(`${subject} ${body}`, t).not.toMatch(/ß/)
    }
  })

  it('aucune langue ne recopie le français', () => {
    for (const t of TYPES) {
      for (const l of LANGUES.filter((x) => x !== 'fr')) {
        expect(REMINDER_TEMPLATES[l][t].body, `${l}/${t}`).not.toBe(REMINDER_TEMPLATES.fr[t].body)
        expect(REMINDER_TEMPLATES[l][t].subject, `${l}/${t}`).not.toBe(REMINDER_TEMPLATES.fr[t].subject)
      }
    }
  })

  describe('reminderTemplate()', () => {
    it('rend la copie du type demandé, dans la langue demandée', () => {
      expect(reminderTemplate('missing_document', 'de').subject).toBe(
        REMINDER_TEMPLATES.de.missing_document.subject,
      )
    })

    it('retombe sur `custom` pour un type sans copie, SANS changer de langue', () => {
      // `deal_stagnant` existe au CHECK de `reminders.type` mais naît en `channel:
      // 'notification'`. S'il atteignait un jour l'envoi, il ne doit pas repartir en
      // français au passage.
      expect(reminderTemplate('deal_stagnant', 'it')).toEqual(REMINDER_TEMPLATES.it.custom)
    })
  })
})
