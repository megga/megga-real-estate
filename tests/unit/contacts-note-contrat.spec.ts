/**
 * Garde-fou : chaque geste du fil de notes DIT ce qu'il a fait.
 *
 * ⛔ CE QUI A MOTIVÉ CE FICHIER (août 2026). `onSaveNote` était le seul écrivain de la
 * fiche à ne rien rendre : un refus de la base n'apparaissait nulle part, l'agent avait
 * tapé et croyait que c'était parti.
 *
 * ⚠ DEPUIS LE 16.09.2026, LA NOTE EST UN FIL (`contact_notes`) : ajouter, modifier,
 * supprimer. Le planificateur de frappe (`notePlanner.ts`) est parti avec le bloc unique
 * qu'il enregistrait à chaque frappe ; l'exigence, elle, reste entière et s'applique aux
 * TROIS gestes : la promesse est attendue, l'échec est RENDU, et le texte tapé survit à
 * un refus.
 *
 * ⚠ CE QUE `tsc` GARDE DÉJÀ : les props rendent `Promise<void>`. CE QU'IL NE GARDE PAS :
 * garder la promesse et IGNORER son issue — `void onAddNote(b)` compile parfaitement.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { corpsDeFonction, valeurDePropJsx } from './helpers/ts-source'

const FICHE = 'src/components/crm/contacts-pager/ContactDetailPager.tsx'
const PAGE = 'src/pages/agent/ContactDetailPage.tsx'

const fiche = readFileSync(FICHE, 'utf8')
const page = readFileSync(PAGE, 'utf8')
const cdNotes = corpsDeFonction(fiche, 'CdNotes')

/** Les deux issues d'un appel : `.then(ok, ko)` ou `.catch(`. */
const deuxIssues = (appel: string) =>
  new RegExp(`${appel}\\([^)]*\\)\\s*\\.then\\([\\s\\S]{0,200}?,[\\s\\S]{0,200}?\\)`).test(cdNotes!)
  || new RegExp(`${appel}\\([\\s\\S]{0,200}?\\.catch\\(`).test(cdNotes!)

describe('Le contrat du fil de notes', () => {
  /** Sans ça, tout ce qui suit passerait par vacuité. */
  it('les sources sont lues et CdNotes est trouvé', () => {
    expect(fiche.length).toBeGreaterThan(1000)
    expect(page.length).toBeGreaterThan(1000)
    expect(cdNotes, 'CdNotes introuvable — la garde ne mesure plus rien').not.toBeNull()
    for (const g of ['onAddNote', 'onUpdateNote', 'onDeleteNote']) expect(cdNotes).toContain(g)
  })

  it('l’ancien bloc unique est parti : plus de CdNote, plus d’écriture de contacts.notes par la page', () => {
    expect(fiche).not.toMatch(/function CdNote\(/)
    expect(fiche).not.toMatch(/onSaveNote/)
    expect(page).not.toMatch(/onSaveNote|notes:\s*note/)
  })

  /** `.then(f)` à un seul argument laisserait le rejet filer en silence. */
  it('ajouter, modifier et supprimer traitent chacun le succès ET l’échec', () => {
    expect(deuxIssues('onAddNote'), `ajout sans branche d'échec :\n${cdNotes}`).toBe(true)
    expect(deuxIssues('onUpdateNote'), 'modification sans branche d’échec').toBe(true)
    expect(deuxIssues('onDeleteNote'), 'suppression sans branche d’échec').toBe(true)
  })

  /** Un échec stocké sans être rendu donne l'illusion d'un témoin. */
  it('chaque échec est RENDU, pas seulement stocké', () => {
    expect(cdNotes).toMatch(/setEchec\(true\)/)
    expect(cdNotes).toMatch(/\{\s*echec\s*&&/)
    expect(cdNotes).toMatch(/setEchecEdition\(/)
    expect(cdNotes).toMatch(/\{\s*echecEdition === n\.id\s*&&/)
    expect(cdNotes).toMatch(/setEchecSuppression\(/)
    expect(cdNotes).toMatch(/\{\s*echecSuppression === n\.id\s*&&/)
  })

  /**
   * ⛔ LE TEXTE TAPÉ SURVIT À UN REFUS. Vider le brouillon AVANT la réponse ferait perdre
   * la note précisément quand l'écriture échoue — le défaut d'origine sous une autre forme.
   */
  it('le brouillon n’est vidé qu’après une écriture réussie', () => {
    const ajout = /onAddNote\(body\)\.then\(\s*\(\)\s*=>\s*\{([\s\S]*?)\},\s*\(\)\s*=>\s*\{([\s\S]*?)\}/.exec(cdNotes!)
    expect(ajout, 'forme de l’ajout non reconnue').not.toBeNull()
    expect(ajout![1]).toMatch(/setBrouillon\(''\)/)
    expect(ajout![2]).not.toMatch(/setBrouillon/)
  })

  /** Seules SES notes portent les gestes — la base le refuse de toute façon (RLS). */
  it('Modifier et Supprimer ne s’offrent que sur ses propres notes', () => {
    expect(cdNotes).toMatch(/n\.mine && !enEdition/)
  })

  it('le succès emprunte le témoin déjà en place', () => {
    expect(cdNotes).toMatch(/useSavedFlash\(\)/)
    expect(cdNotes).toMatch(/CdSavedToast/)
  })

  /** Une note qui disparaît sans témoin ne dit pas si la BASE l'a retirée (16.09.2026). */
  it('une suppression réussie le dit aussi', () => {
    const suppr = /onDeleteNote\(id\)\.then\([\s\S]*?\(\)\s*=>\s*\{([\s\S]*?)\},\s*\(\)\s*=>/.exec(cdNotes!)
    expect(suppr, 'forme de la suppression non reconnue').not.toBeNull()
    expect(suppr![1]).toMatch(/setToast\('deleted'\)/)
    expect(suppr![1]).toMatch(/flashSaved\(\)/)
  })

  /** La page transmet des écritures ATTENDUES, sans minuteur. */
  it('la page attend chaque écriture, sans minuteur', () => {
    for (const prop of ['onAddNote', 'onUpdateNote', 'onDeleteNote']) {
      const bloc = valeurDePropJsx(page, prop)
      expect(bloc, `${prop} introuvable dans la page`).not.toBeNull()
      expect(bloc!, `${prop} : écriture non attendue`).toMatch(/await\s+notesFil\./)
      expect(bloc!, `${prop} : un minuteur est revenu`).not.toMatch(/setTimeout|clearTimeout/)
    }
  })
})
