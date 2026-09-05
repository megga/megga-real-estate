/**
 * Garde-fou : un e-mail rattaché à un contact apparaît dans SA timeline, avec un
 * libellé lisible.
 *
 * ── CE QUE LA TÂCHE 2.14 AVAIT « RIEN À CODER » ──────────────────────────────
 * Le plan écrit « Rien à coder : `useContactTimeline` lit `activity_events` par
 * `entity_id` », puis « vérifier à l'écran ». C'est vrai et c'est insuffisant :
 * la chaîne tient sur TROIS pièces écrites dans trois endroits différents, et
 * aucune ne rougit quand une autre bouge.
 *
 *   1. le lot 1 écrit `entity_id = contact_id` et une `action` en snake_case ;
 *   2. `useContactTimeline` ne filtre QUE sur `entity_id` ;
 *   3. `auditActionLabel` traduit l'`action` par `common:audit.action.<action>`,
 *      et retombe sur un `humanize()` de l'identifiant quand la clé manque.
 *
 * ⛔ LE MODE D'ÉCHEC EST MUET DES DEUX CÔTÉS. Si le lot 3 renomme une action, la
 * timeline continue d'afficher quelque chose — « Email received » au lieu de
 * « E-mail reçu » — et rien ne le signale. Si quelqu'un retire une clé, pareil.
 * Un repli qui « marche » est exactement ce qui rend une régression invisible.
 *
 * Cette spec relie les trois pièces : les identifiants sont lus dans le BACKEND,
 * jamais recopiés ici.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import i18n from '@/i18n'
import { auditActionLabel } from '@/lib/auditActionLabel'
import { timelineCat } from '@/components/crm-mobile/contacts/detailShared'
import { repoPath } from './helpers/fs-scan'

/** Les fichiers du lot 1 qui écrivent dans `activity_events` pour la messagerie. */
const ECRIVAINS = [
  'supabase/functions/_shared/mail/ingest.ts',
  'supabase/functions/mail-attachment/index.ts',
  'supabase/functions/mail-send/index.ts',
]

/** Les actions que le backend écrit, LUES et non recopiées. */
function actionsDuBackend(): string[] {
  const vues = new Set<string>()
  for (const f of ECRIVAINS) {
    const code = readFileSync(repoPath(f), 'utf8')
    // ⚠ On accepte les deux formes : le littéral d'un `insert` et l'annotation
    // de type de `audit()`, qui est l'endroit où `ingest.ts` les nomme.
    for (const m of code.matchAll(/'(email_received|email_sent|document_filed_from_email)'/g)) vues.add(m[1])
  }
  return [...vues].sort()
}

const LANGUES = ['fr', 'en', 'de', 'it'] as const

describe('Messagerie — la timeline du contact', () => {
  it('les actions traduites sont exactement celles que le backend écrit', () => {
    // ⛔ Le contrôle POSITIF d'abord : si le balayage ne trouve rien, l'égalité
    // qui suit serait vraie contre un ensemble vide des deux côtés.
    const backend = actionsDuBackend()
    expect(backend.length, 'aucune action lue dans le backend — le balayage ne mesure rien').toBe(3)
    expect(backend).toEqual(['document_filed_from_email', 'email_received', 'email_sent'])

    const fr = JSON.parse(readFileSync(repoPath('src/i18n/locales/fr/common.json'), 'utf8')) as {
      audit: { action: Record<string, string> }
    }
    const manquantes = backend.filter((a) => !(a in fr.audit.action))
    expect(manquantes, `action écrite par le backend sans libellé : ${manquantes.join(', ')}`).toEqual([])
  })

  it('les quatre langues ont les trois libellés, et aucune ne retombe sur le repli', () => {
    const fautifs: string[] = []
    for (const langue of LANGUES) {
      const j = JSON.parse(readFileSync(repoPath(`src/i18n/locales/${langue}/common.json`), 'utf8')) as {
        audit: { action: Record<string, string> }
      }
      for (const a of actionsDuBackend()) {
        const v = j.audit.action[a]
        if (!v) { fautifs.push(`${langue} : ${a} absente`); continue }
        // ⚠ LA COMPARAISON AU REPLI NE VAUT PAS EN ANGLAIS, et c'est structurel :
        // les identifiants SONT de l'anglais en snake_case, donc `humanize()` en
        // rend une phrase correcte — « Email received » est à la fois le repli et
        // la bonne traduction. C'est précisément pourquoi ce repli existe. La
        // clause distinguerait donc « traduit » de « pas traduit » sur trois
        // langues et lèverait un faux positif sur la quatrième ; en anglais il
        // reste le contrôle de PRÉSENCE, ci-dessus.
        if (langue === 'en') continue
        // Le repli de `auditActionLabel` : `email_received` → « Email received ».
        const repli = a.replace(/[_.]+/g, ' ').replace(/^./, (c) => c.toUpperCase())
        if (v === repli) fautifs.push(`${langue} : ${a} vaut son propre repli (« ${v} ») — donc rien n'est traduit`)
      }
    }
    expect(fautifs, `libellé d'action manquant ou creux :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  it('auditActionLabel rend le libellé traduit, pas l’identifiant déridé', async () => {
    await i18n.changeLanguage('fr')
    expect(auditActionLabel('email_received')).toBe('E-mail reçu')
    expect(auditActionLabel('email_sent')).toBe('E-mail envoyé')
    expect(auditActionLabel('document_filed_from_email')).toBe('Pièce classée depuis un e-mail')
    // Le repli EXISTE toujours, et c'est ce qui rend les trois lignes ci-dessus
    // significatives : sans lui elles seraient vraies par construction.
    expect(auditActionLabel('action_qui_nexiste_pas')).toBe('Action qui nexiste pas')
  })

  it('le mobile classe les trois actions en « e-mail »', () => {
    for (const a of actionsDuBackend()) {
      expect(timelineCat(a).labelKey, `${a} mal classée`).toBe('mobile.detail.timeline.cat.email')
    }
  })

  /**
   * ⛔ LE CONTRAT, ÉCRIT PLUTÔT QUE SUPPOSÉ. `useContactTimeline` filtre sur
   * `entity_id` et RIEN d'autre : un e-mail apparaît dans la fiche d'un contact
   * si et seulement si le lot 1 a écrit l'événement avec `entity_id =
   * contact_id`. Le commentaire du hook promettait « OR metadata contains
   * contact_id » — jamais implémenté. Élargir le hook changerait ce que
   * `mail-attachment` et `ingest` doivent garantir : c'est une décision, pas un
   * détail, et elle ne doit pas se glisser dans un lot.
   */
  it('le hook de timeline filtre sur entity_id, et sur rien d’autre', () => {
    const hook = readFileSync(repoPath('src/hooks/useContactTimeline.ts'), 'utf8')
    expect(hook).toContain(".eq('entity_id', contactId)")
    expect(hook, 'le hook a été élargi — le contrat du lot 1 doit être revu avec').not.toMatch(/\.or\(/)
  })
})
