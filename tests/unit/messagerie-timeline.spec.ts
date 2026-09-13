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
import { ACTIONS_DATEES_PAR_LE_COURRIER, LISTE_COURRIER, fusionnerTimeline, occurredAt } from '@/lib/contactTimeline'
import type { TimelineEvent } from '@/hooks/useContactTimeline'
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

/**
 * ⛔ LA DATE D'UN COURRIER EST CELLE DU COURRIER (13.09.2026). La passe initiale d'une
 * boîte journalise 90 jours en quelques heures : trié par `created_at`, le bloc sortait
 * daté du jour de la connexion, dans l'ordre INVERSE, et `limit(50)` gardait les 50 plus
 * VIEUX. La date du fait vit en `metadata.sent_at` (`mailAuditEvent`).
 */
describe('Messagerie — la timeline datée par le fait', () => {
  const JOUR = 86_400_000
  const courrier = (i: number, sent: string, created: string): TimelineEvent => ({
    id: `m${i}`, action: 'email_received', entity_type: 'contact', entity_id: 'c1',
    metadata: { sent_at: sent }, created_at: created, occurred_at: '', actor_name: null,
  })

  it('occurredAt : un courrier prend sa date, borné par l’enregistrement ; le reste garde created_at', () => {
    const enr = '2026-09-13T10:00:00+00:00'
    expect(occurredAt({ action: 'email_received', metadata: { sent_at: '2026-06-15T08:00:00.000Z' }, created_at: enr })).toBe('2026-06-15T08:00:00.000Z')
    expect(occurredAt({ action: 'note_added', metadata: { sent_at: '2026-06-15T08:00:00.000Z' }, created_at: enr }), 'seul le courrier se date par sent_at').toBe(enr)
    expect(occurredAt({ action: 'email_sent', metadata: { sent_at: '2100-01-01T00:00:00.000Z' }, created_at: enr }), 'borné par l’enregistrement').toBe('2026-09-13T10:00:00.000Z')
    expect(occurredAt({ action: 'email_sent', metadata: null, created_at: enr })).toBe(enr)
    expect(occurredAt({ action: 'email_sent', metadata: { sent_at: 'illisible' }, created_at: enr })).toBe(enr)
  })

  it('passe Gmail : 60 courriers ingérés du plus récent au plus ancien, 3 notes des semaines passées', () => {
    const connexion = Date.parse('2026-09-13T08:00:00.000Z')
    // i = 0 est le plus RÉCENT courrier, ingéré en PREMIER (created_at le plus ancien).
    const courriers = Array.from({ length: 60 }, (_, i) => {
      const e = courrier(i, new Date(connexion - (i + 1) * 1.4 * JOUR).toISOString(), new Date(connexion + i * 60_000).toISOString())
      return { ...e, occurred_at: occurredAt(e) }
    })
    const notes = [3, 20, 45].map((j) => ({
      id: `n${j}`, action: 'note_added', entity_type: 'contact', entity_id: 'c1', metadata: null,
      created_at: new Date(connexion - j * JOUR).toISOString(), occurred_at: new Date(connexion - j * JOUR).toISOString(), actor_name: 'G',
    } satisfies TimelineEvent))

    // TÉMOIN de l'ancien comportement : un seul tri par created_at, puis 50.
    const ancien = [...courriers, ...notes].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 50)
    expect(ancien[0].id, 'l’ancien tri ouvrait sur le courrier le plus VIEUX').toBe('m59')

    // Les deux lectures : top 50 des courriers par sent_at, notes par created_at.
    const top50Courriers = [...courriers].sort((a, b) => Date.parse(String(b.metadata!.sent_at)) - Date.parse(String(a.metadata!.sent_at))).slice(0, 50)
    const fusion = fusionnerTimeline(notes, top50Courriers, 50)
    expect(fusion).toHaveLength(50)
    expect(fusion[0].id, 'la fiche ouvre sur le courrier le plus récent').toBe('m0')
    for (let i = 1; i < fusion.length; i++) expect(Date.parse(fusion[i - 1].occurred_at)).toBeGreaterThanOrEqual(Date.parse(fusion[i].occurred_at))
    expect(fusion.map((e) => e.id), 'les notes s’intercalent à leur date').toEqual(expect.arrayContaining(['n3', 'n20', 'n45']))
  })

  it('la liste des actions datées par le courrier est celle que le backend écrit', () => {
    const ingest = readFileSync(repoPath('supabase/functions/_shared/mail/ingest.ts'), 'utf8')
    const decl = ingest.match(/export type MailAuditAction = ([^\n]+)/)?.[1] ?? ''
    const backend = [...decl.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()
    expect(backend, 'MailAuditAction introuvable').toEqual(['email_received', 'email_sent'])
    expect([...ACTIONS_DATEES_PAR_LE_COURRIER].sort()).toEqual(backend)
    expect(LISTE_COURRIER).toBe('(email_received,email_sent)')
    // Le miroir côté Deno (outils IA) : même liste.
    const deno = readFileSync(repoPath('supabase/functions/_shared/contact-timeline.ts'), 'utf8')
    const miroir = deno.match(/export const ACTIONS_COURRIER = \[([^\]]*)\]/)?.[1] ?? ''
    expect([...miroir.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()).toEqual(backend)
  })

  it('le hook lit les deux tops, et l’écran affiche la date du fait', () => {
    const hook = readFileSync(repoPath('src/hooks/useContactTimeline.ts'), 'utf8')
    expect(hook).toContain(".order('metadata->>sent_at', { ascending: false, nullsFirst: false })")
    expect(hook).toContain(".not('action', 'in', LISTE_COURRIER)")
    expect(hook).toContain('fusionnerTimeline(')
    const ecran = readFileSync(repoPath('src/components/crm-mobile/contacts/MobileContactDetailScreen.tsx'), 'utf8')
    expect(ecran).toContain('fmtDay(ev.occurred_at')
    expect(ecran).not.toContain('fmtDay(ev.created_at')
  })

  it('les outils IA (brief, préparation de RDV) lisent les faits datés, plus la timeline par created_at', () => {
    const outils = readFileSync(repoPath('supabase/functions/_shared/whatsapp-actions.ts'), 'utf8')
    expect(outils.match(/lireFaitsContact\(/g) ?? [], 'get_contact_brief ET prepare_meeting').toHaveLength(2)
    expect(outils, 'une lecture de timeline par created_at est revenue').not.toMatch(/from\('activity_events'\)\s*\.select\('action, object_label, created_at'\)/)
  })
})
