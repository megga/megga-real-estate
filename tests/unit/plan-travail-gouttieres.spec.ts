/**
 * Garde-fou : les deux gouttières du plan de travail sont ÉGALES.
 *
 * ⛔ ELLES NE L'ÉTAIENT PAS — 12 px entre la barre latérale et le contenu,
 * **40 px** entre le contenu et le dock MEGGA AI ouvert (relevé au rendu par
 * Julien le 20.09.2026). Plus du triple, et la cause tenait à une addition que
 * personne ne faisait : `COPILOT_WIDTH` réservait « le panneau + 32 » en
 * pensant offrir 16 px de gouttière, alors que le contenu porte DÉJÀ son
 * `padding-right` de 24 px. Les deux s'empilaient.
 *
 * ⚠ CETTE CLAUSE NE SE MESURE PAS ELLE-MÊME. Réassertir l'arithmétique de
 * `COPILOT_WIDTH` serait une tautologie ; ce qui est gardé ici, c'est que la
 * gouttière de DROITE vaut le jeton d'espacement qui produit celle de GAUCHE,
 * lu dans `globals.css`. Changer l'un sans l'autre fait rougir.
 */
import { describe, it, expect } from 'vitest'
import { readFileSafely, repoPath } from './helpers/fs-scan'
import { COPILOT_WIDTH, PANEL_W, DOCK_GAP, DOCK_MARGIN } from '@/components/ai-copilot/panel/aiPanel'

describe('Plan de travail — les deux gouttières sont égales', () => {
  const css = (() => {
    const lu = readFileSafely(repoPath('src/styles/globals.css'))
    expect(lu.status, 'globals.css illisible : la clause ne mesure rien').toBe('ok')
    return lu.status === 'ok' ? lu.value : ''
  })()

  /** Un barreau d'espacement de la feuille, en px. */
  function espacement(nom: string): number {
    const m = new RegExp(`--crm-space-${nom}:\\s*(\\d+)px`).exec(css)
    expect(m, `--crm-space-${nom} absent : la clause ne mesure rien`).not.toBeNull()
    return Number(m![1])
  }

  it('la gouttière de droite vaut celle de gauche', () => {
    // La gouttière GAUCHE est le `padding-left` du plan de travail.
    expect(DOCK_GAP, 'la gouttière du dock ne vaut plus le padding du contenu')
      .toBe(espacement('lg'))
  })

  it('la poussée réserve le dock et sa marge, sans compter deux fois la gouttière', () => {
    const padDroit = espacement('7xl')
    expect(COPILOT_WIDTH, 'la poussée ne tient plus compte du padding du contenu')
      .toBe(PANEL_W + DOCK_MARGIN - (padDroit - DOCK_GAP))
    // …et le dock garde SA taille : la poussée ne doit jamais la changer.
    expect(PANEL_W, 'le dock a changé de largeur').toBe(372)
  })

  it('la poussée porte sur la RANGÉE, jamais sur la bande d’onglets', () => {
    /**
     * ⛔ ELLE ENGLOBAIT LA BANDE, et le quart droit reculait de 376 px à chaque
     * ouverture du dock — la cloche, ✦, la bascule de thème et l'avatar
     * quittaient le bord de la fenêtre pour suivre un panneau qui n'est même
     * pas sur leur ligne (relevé par Julien le 20.09.2026).
     *
     * ⚠ Le motif écrit dans le code était RÉEL mais PÉRIMÉ : « ne pousser que
     * la rangée les laisserait sous le dock ». Vrai avant que le dock ne gagne
     * son `top` à `--crm-chrome-top`. Mesuré depuis, à 1440 × 900 : la bande
     * finit à y=42, le dock commence à y=54.
     *
     * Ce que la clause garde : l'ORDRE dans la source. Le spread de
     * `DOCK_PUSH_STYLE` doit venir APRÈS le montage de `<CrmTabsBar`, donc sur
     * la rangée qui suit, et n'apparaître qu'une fois.
     */
    const lu = readFileSafely(repoPath('src/components/crm/CrmWorkspace.tsx'))
    expect(lu.status, 'CrmWorkspace illisible : la clause ne mesure rien').toBe('ok')
    const src = lu.status === 'ok' ? lu.value : ''

    const bande = src.indexOf('<CrmTabsBar')
    const poussee = src.indexOf('...DOCK_PUSH_STYLE')
    expect(bande, '`<CrmTabsBar` introuvable : la clause ne mesure rien').toBeGreaterThan(-1)
    expect(poussee, '`...DOCK_PUSH_STYLE` introuvable : la clause ne mesure rien').toBeGreaterThan(-1)
    expect(
      (src.match(/\.\.\.DOCK_PUSH_STYLE/g) ?? []).length,
      'la poussée est appliquée à plus d’un endroit',
    ).toBe(1)
    expect(
      poussee,
      'la poussée remonte au-dessus de la bande : le quart droit repartira avec le dock',
    ).toBeGreaterThan(bande)
  })
})
