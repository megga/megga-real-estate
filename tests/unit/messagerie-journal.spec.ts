/**
 * Garde-fou : le journal (`activity_events`) reçoit le FAIT d'un courrier, jamais son
 * CONTENU — et la cloche de l'agence ne montre pas le courrier des boîtes.
 *
 * ⛔ CE QUE LE 13.09.2026 A MESURÉ. `ingest.ts` et `mail-send` écrivaient l'objet du mail
 * en `object_label` et ses adresses en métadonnées, sans lire la visibilité de la boîte.
 * `activity_events` n'étant pas gardée par `mail_account_visible`, l'objet d'un courrier
 * PERSONNEL devenait lisible de toute l'agence et du super-admin, titrait la cloche de
 * chaque collègue et partait à DeepSeek par `get_contact_brief` / `prepare_meeting`.
 *
 * Le contrat vit dans `mailAuditEvent` (`_shared/mail/ingest.ts`), éprouvé en unitaire
 * par `ingest.test.ts` et contre la vraie base par
 * `tests/backend/mail-journal-confidentialite.spec.ts`. Cette spec tient ce qu'aucun des
 * deux ne voit : qu'un écrivain ne se remette pas à construire sa ligne À LA MAIN, et que
 * la cloche écarte exactement les actions que le backend écrit — LUES, non recopiées.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { rel, repoPath, scanRoots } from './helpers/fs-scan'

/**
 * Écrivains du journal dans le code de la Messagerie qui n'écrivent PAS un courrier, avec
 * leur raison. `mail-attachment` verse une pièce au dossier du contact : un geste humain
 * explicite, dont le nom est déjà dans `documents.name`.
 */
const HORS_COURRIER: Record<string, string> = {
  'supabase/functions/mail-attachment/index.ts': 'classement explicite d’une pièce au dossier, pas un courrier',
  'supabase/functions/mail-oauth/index.ts': 'connexion d’une boîte, réussie ou refusée (15.09.2026) : un code et un identifiant, ni objet ni adresse',
}

const lire = (f: string) => readFileSync(repoPath(f), 'utf8')

/** Même nettoyage que la garde de catégorie : un commentaire ne compte ni pour ni contre. */
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

/**
 * Tout le code de la Messagerie — les modules `_shared/mail/` et les edges `mail-*` —
 * DÉCOUVERT, pas listé : un nouvel écrivain (le lot 3 IMAP, un audit ajouté dans
 * `mail-actions`) tombe sous la garde sans qu'on pense à l'y inscrire.
 */
function codeDeLaMessagerie(): string[] {
  const scan = scanRoots([
    { root: 'supabase/functions/_shared/mail', keep: (n) => n.endsWith('.ts') && !n.includes('.test.') },
    { root: 'supabase/functions', keep: (n) => n === 'index.ts' },
  ])
  return scan.files.map(rel).filter((f) => f.startsWith('supabase/functions/_shared/mail/') || /^supabase\/functions\/mail-[^/]+\/index\.ts$/.test(f))
}

/**
 * Chaque écriture dans `activity_events`, tolérante aux espaces et aux sauts de ligne —
 * `admin\n  .from('activity_events')\n  .insert({ … })` est une forme vivante du dépôt, et
 * une première version de cette garde, qui ne voyait que la forme sur une ligne, la
 * laissait passer (revue du 13.09.2026). Rend l'argument de chaque écriture.
 */
function ecritures(code: string): string[] {
  const propre = sansCommentaires(code)
  const motif = /activity_events['"]\s*\)\s*\.(?:insert|upsert)\s*\(/g
  const args: string[] = []
  let m: RegExpExecArray | null
  while ((m = motif.exec(propre)) !== null) args.push(propre.slice(m.index + m[0].length).trimStart())
  return args
}

/** Les actions de `MailAuditAction`, lues dans le backend. */
function actionsDuCourrier(): string[] {
  const m = lire('supabase/functions/_shared/mail/ingest.ts').match(/export type MailAuditAction = ([^\n]+)/)
  return [...(m?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort()
}

describe('Messagerie — le journal d’un courrier', () => {
  it('chaque écriture au journal dans le code de la Messagerie passe par mailAuditEvent', () => {
    const fichiers = codeDeLaMessagerie()
    // Les contrôles POSITIFS d'abord : sans eux, une découverte cassée rendrait tout vert.
    expect(fichiers, 'la découverte ne voit plus le code de la Messagerie').toEqual(
      expect.arrayContaining(['supabase/functions/_shared/mail/ingest.ts', 'supabase/functions/mail-send/index.ts', 'supabase/functions/mail-sync/index.ts']))
    const parFichier = new Map(fichiers.map((f) => [f, ecritures(lire(f))]))
    for (const f of ['supabase/functions/_shared/mail/ingest.ts', 'supabase/functions/mail-send/index.ts']) {
      expect(parFichier.get(f)?.length, `${f} n'écrit plus au journal — la garde ne mesure rien`).toBeGreaterThan(0)
    }
    const aLaMain: string[] = []
    for (const [f, args] of parFichier) {
      if (f in HORS_COURRIER) continue
      for (const a of args) if (!a.startsWith('mailAuditEvent(')) aLaMain.push(`${f} : insert(${a.slice(0, 60).replace(/\s+/g, ' ')}…`)
    }
    expect(aLaMain, `ligne de journal construite à la main — objet et adresses peuvent revenir :\n  ${aLaMain.join('\n  ')}`).toEqual([])
  })

  it('la garde voit une écriture chaînée sur plusieurs lignes', () => {
    // Le témoin de la forme que la première version laissait passer.
    const piege = "await admin\n  .from('activity_events')\n  .insert({ action: 'email_sent', metadata: { to } })"
    expect(ecritures(piege)).toHaveLength(1)
    expect(ecritures(piege)[0].startsWith('mailAuditEvent(')).toBe(false)
    expect(ecritures('// admin.from(\'activity_events\').insert({})')).toHaveLength(0)
  })

  it('les exceptions hors courrier restent nommées, et écrivent vraiment', () => {
    for (const [f, raison] of Object.entries(HORS_COURRIER)) {
      expect(raison.length, `l'exception ${f} doit porter une raison écrite`).toBeGreaterThan(20)
      expect(ecritures(lire(f)).length, `${f} n'écrit plus au journal : exception périmée`).toBeGreaterThan(0)
    }
  })

  it('un envoi Outlook ne construit plus son fil provisoire à la main : il passe par recordPendingSend', () => {
    // Sinon le fil naît sans contact, mail-send ne journalise pas, et la synchro non plus.
    const code = sansCommentaires(lire('supabase/functions/mail-send/index.ts'))
    expect(code, 'la branche Graph a disparu — la garde ne mesure rien').toContain('graphSend(')
    expect(code).toMatch(/recordPendingSend\(\s*admin\s*,\s*account\s*,/)
    expect(code).not.toContain('pending-thread:')
    expect(code).not.toMatch(/from\(\s*['"]mail_threads['"]\s*\)\s*\.insert\s*\(/)
    expect(code).not.toMatch(/from\(\s*['"]mail_messages['"]\s*\)\s*\.insert\s*\(/)
  })

  it('un envoi, une ligne : mail-send ne journalise que si la copie locale existe', () => {
    // Sans copie locale, la synchro ingère la copie du fournisseur comme NEUVE et la journalise :
    // un audit gardé par le seul contact du fil écrivait alors les deux lignes.
    const code = sansCommentaires(lire('supabase/functions/mail-send/index.ts'))
    const audit = code.indexOf('mailAuditEvent({')
    expect(audit, 'l’audit de mail-send a disparu — la garde ne mesure rien').toBeGreaterThan(-1)
    expect(code.slice(code.lastIndexOf('if (', audit), audit)).toMatch(/\blocalMessageId\b/)
    // Gmail : la copie se relit même quand l'ingestion lève après avoir inséré le message.
    expect(code).toMatch(/try\s*\{\s*await ingestMessages\(/)
  })

  it('la date du fait : mail-send la fournit, le contrat ne pose jamais created_at', () => {
    expect(sansCommentaires(lire('supabase/functions/mail-send/index.ts'))).toMatch(/mailAuditEvent\(\{[\s\S]*?\bsentAt\s*:/)
    const ingest = sansCommentaires(lire('supabase/functions/_shared/mail/ingest.ts'))
    const debut = ingest.indexOf('export function mailAuditEvent(')
    expect(debut, 'mailAuditEvent introuvable').toBeGreaterThan(-1)
    const corps = ingest.slice(debut, ingest.indexOf('\n}\n', debut))
    expect(corps, 'la date du fait est sent_at').toMatch(/\bsent_at\s*:/)
    // `created_at` est l'horloge de l'audit (garde des 10 ans, purge) : l'antidater est interdit.
    expect(corps).not.toMatch(/\bcreated_at\b/)
  })

  it('aucun object_label du courrier ne porte autre chose que NULL', () => {
    // `mail-send` n'en écrit plus du tout ; `ingest.ts` n'en a qu'un, celui du contrat.
    expect(sansCommentaires(lire('supabase/functions/mail-send/index.ts'))).not.toMatch(/object_label\s*:/)
    const labels = sansCommentaires(lire('supabase/functions/_shared/mail/ingest.ts')).match(/object_label\s*:[^,\n]*/g) ?? []
    expect(labels).toEqual(['object_label: null'])
  })

  it('la cloche écarte exactement les actions du courrier que le backend écrit', () => {
    const backend = actionsDuCourrier()
    expect(backend, 'MailAuditAction introuvable — la garde ne mesure rien').toEqual(['email_received', 'email_sent'])
    const hook = lire('src/hooks/useAgentNotifications.ts')
    const liste = hook.match(/const HORS_CLOCHE = '\(([^)]*)\)'/)?.[1]
    expect(liste, 'HORS_CLOCHE introuvable dans la cloche').toBeTruthy()
    expect(liste!.split(',').sort()).toEqual(backend)
    expect(hook).toContain(".not('action', 'in', HORS_CLOCHE)")
  })
})
