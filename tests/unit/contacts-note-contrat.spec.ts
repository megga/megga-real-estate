/**
 * Garde-fou : l'enregistrement de la note DIT ce qu'il a fait.
 *
 * ⛔ CE QUI A MOTIVÉ CE FICHIER. `onSaveNote` était le seul écrivain de la fiche
 * à ne rien rendre — `(v: string) => void` — quand `onSaveIdentity` et
 * `onSaveCoord` rendaient des `Promise<void>` dont l'échec était traité. La page
 * l'appelait en `void … .then(refreshList)`, sans `catch`. Un refus de la base
 * n'apparaissait donc nulle part : l'agent avait tapé, et croyait que c'était
 * parti.
 *
 * ⚠ CE QUE `tsc` GARDE DÉJÀ, ET QUE CE FICHIER NE REFAIT PAS. Le type de la prop
 * est `Promise<void>` : une fonction rendant `void` n'y est pas assignable, donc
 * un retour en arrière sur le CONTRAT casse la compilation. Inutile de le
 * re-tester ici.
 *
 * ⚠ CE QUE `tsc` NE GARDE PAS, et qui est le défaut d'origine : garder la
 * promesse et IGNORER son issue. `void onSaveNote(v)` compile parfaitement et
 * ramène exactement le silence qu'on vient de retirer. C'est ça qu'on surveille.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { corpsDeFonction, valeurDePropJsx } from './helpers/ts-source'

const FICHE = 'src/components/crm-sugar/contacts-pager/ContactDetailPager.tsx'
const PAGE = 'src/pages/agent/ContactDetailPage.tsx'

const fiche = readFileSync(FICHE, 'utf8')
const page = readFileSync(PAGE, 'utf8')
const cdNote = corpsDeFonction(fiche, 'CdNote')

describe('Le contrat d’enregistrement de la note', () => {
  /** Sans ça, tout ce qui suit passerait par vacuité. */
  it('les sources sont lues et CdNote est trouvé', () => {
    expect(fiche.length).toBeGreaterThan(1000)
    expect(page.length).toBeGreaterThan(1000)
    expect(cdNote, 'CdNote introuvable — la garde ne mesure plus rien').not.toBeNull()
    expect(cdNote).toContain('onSaveNote')
  })

  /**
   * Les DEUX issues sont traitées. `.then(f)` à un seul argument laisserait le
   * rejet filer en silence — c'est précisément la forme d'avant.
   */
  it('l’écriture traite le succès ET l’échec', () => {
    const deuxIssues = /onSaveNote\([^)]*\)\s*\.then\([^)]*,[\s\S]{0,120}?\)/.test(cdNote!)
      || /onSaveNote\([\s\S]{0,200}?\.catch\(/.test(cdNote!)
    expect(deuxIssues, `aucune branche d'échec autour de onSaveNote :\n${cdNote}`).toBe(true)
  })

  /**
   * Un état d'échec qu'on stocke sans le rendre ne vaut pas mieux que pas
   * d'état du tout — c'est même pire, parce qu'il donne l'illusion d'un témoin.
   * On exige donc la variable ET son rendu conditionnel.
   */
  it('l’échec est RENDU, pas seulement stocké', () => {
    expect(cdNote, 'aucun état d’échec').toMatch(/setEchec\(true\)/)
    expect(cdNote, 'l’état d’échec n’est jamais rendu').toMatch(/\{\s*echec\s*&&/)
  })

  /** Le succès emprunte le témoin des deux autres blocs, pas un troisième. */
  it('le succès emprunte le témoin déjà en place', () => {
    expect(cdNote).toMatch(/useSavedFlash\(\)/)
    expect(cdNote).toMatch(/CdSavedToast/)
  })

  /**
   * ⛔ LE DÉMONTAGE CHASSE, IL N'ANNULE PAS. Annuler perdrait la dernière frappe
   * — un défaut plus grave que celui qu'on corrige, et invisible à la relecture.
   * Le comportement lui-même est éprouvé dans `note-planner.spec.ts` ; ici on
   * vérifie seulement que le composant s'y raccorde.
   */
  it('la frappe en attente est chassée au démontage, jamais annulée', () => {
    expect(cdNote, 'CdNote n’utilise pas le planificateur').toMatch(/creerNotePlanner/)
    expect(cdNote, 'aucun nettoyage au démontage').toMatch(/useEffect\(\(\)\s*=>\s*\(\)\s*=>[\s\S]{0,80}?chasser\(\)/)
    expect(cdNote, 'un clearTimeout nu dans CdNote : la frappe serait perdue').not.toMatch(/clearTimeout/)
  })

  /**
   * ⛔ LE DÉLAI A QUITTÉ LA PAGE. Il y vivait dans un `setTimeout` que RIEN ne
   * nettoyait — le fichier n'avait aucun `useEffect`. Le laisser revenir
   * ramènerait les deux défauts d'un coup : le report non nettoyé et l'échec
   * avalé.
   */
  it('la page n’a plus de minuteur pour la note', () => {
    const bloc = valeurDePropJsx(page, 'onSaveNote')
    expect(bloc, 'onSaveNote introuvable dans la page').not.toBeNull()
    expect(bloc!, `un minuteur est revenu :\n${bloc}`).not.toMatch(/setTimeout|clearTimeout/)
    expect(bloc!, 'l’écriture n’est plus attendue').toMatch(/await\s+update\.mutateAsync/)
    expect(page, 'le ref de minuteur de la note est revenu').not.toMatch(/noteTimer/)
  })
})
