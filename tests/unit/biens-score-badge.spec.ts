/**
 * Garde-fou : la pastille de SCORE DE BIEN reste lisible dans les deux thèmes.
 *
 * ⛔ CE QUI A MOTIVÉ CE FICHIER. `BnScoreBadge` pose sa teinte de palier en
 * ENCRE sur un fond qui n'est que cette même teinte à 10 % — le contraste ne
 * dépend donc pas de la couleur choisie mais du THÈME sous elle. Un jeu unique
 * servait les deux : mesuré le 12 août 2026, il rendait **2,41 / 2,51 /
 * 2,80:1** en clair, quand le seuil du texte est 4,5. La pastille qui porte le
 * score du bien était l'élément le moins lisible de sa propre carte.
 *
 * Pourquoi personne ne l'avait vu : en SOMBRE les mêmes valeurs tenaient
 * (6,74 / 6,48 / 5,81). Le défaut n'existait que dans le thème par défaut, et
 * les captures de la refonte avaient été prises en sombre.
 *
 * ⚠ CE TEST NE PORTE PAS SUR L'ÉCHELLE. Ces trois teintes sont SÉMANTIQUES —
 * elles disent le palier (chaud / à animer / en veille), ce que les neutres et
 * l'accent ne savent pas dire — et sortent donc légitimement des barreaux de la
 * vitrine, comme `danger` ou `goal` côté mobile. Ce qui se vérifie ici est leur
 * LISIBILITÉ, pas leur provenance : deux questions distinctes, et c'est d'avoir
 * confondu les deux que le défaut a survécu à la migration.
 */
import { describe, it, expect } from 'vitest'
import { TIER_COLORS } from '@/components/crm-sugar/biens/scoreTiers'
import { mxCrmPalette } from '@/components/megga-x-crm/tokens'

const canal = (hex: string): [number, number, number] =>
  [0, 2, 4].map((i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16)) as [number, number, number]

function luminance(hex: string): number {
  return canal(hex)
    .map((v) => {
      const c = v / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    .reduce((acc, c, i) => acc + [0.2126, 0.7152, 0.0722][i] * c, 0)
}

function contraste(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Le fond RÉEL de la pastille : `background: color + '1A'`, soit la teinte à
 * 26/255 par-dessus la carte. Mesurer l'encre contre la carte NUE surestimerait
 * le contraste — le voile remonte le fond vers la teinte, donc le réduit.
 */
function fondPastille(teinte: string, carte: string): string {
  const a = 26 / 255
  const [t, c] = [canal(teinte), canal(carte)]
  return '#' + t.map((v, i) => Math.round(v * a + c[i] * (1 - a)).toString(16).padStart(2, '0')).join('')
}

const AA = 4.5

describe('Pastille de score — lisible dans les deux thèmes', () => {
  // Sans ça, une table vidée rendrait le test suivant vrai par vacuité.
  it('les deux jeux couvrent les trois paliers', () => {
    for (const jeu of ['light', 'dark'] as const) {
      expect(Object.keys(TIER_COLORS[jeu]).sort()).toEqual(['a_animer', 'chaud', 'en_veille'])
    }
  })

  it.each([false, true])('chaque palier passe l’AA sur son propre voile (sombre=%s)', (dark) => {
    const carte = mxCrmPalette(dark).cardBg
    const jeu = TIER_COLORS[dark ? 'dark' : 'light']
    const faibles: string[] = []
    for (const [palier, teinte] of Object.entries(jeu)) {
      const r = contraste(teinte, fondPastille(teinte, carte))
      if (r < AA) faibles.push(`${palier} (${teinte}) = ${r.toFixed(2)}:1`)
    }
    expect(faibles, `paliers sous ${AA}:1 :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * Les deux jeux doivent RESTER deux. Les fusionner ramènerait le défaut : une
   * teinte qui tient sur `#090909` ne tient pas sur `#ffffff`, et inversement.
   */
  it('le clair et le sombre ne convergent pas', () => {
    for (const palier of Object.keys(TIER_COLORS.light)) {
      expect(TIER_COLORS.light[palier], `${palier} a le même ton dans les deux thèmes`)
        .not.toBe(TIER_COLORS.dark[palier])
    }
  })

  /**
   * La palette porte le thème ; sans ce drapeau la pastille devrait le deviner
   * depuis la luminance d'une surface, ou importer le proxy du wizard.
   */
  it('la palette dit son thème', () => {
    expect(mxCrmPalette(false).isDark).toBe(false)
    expect(mxCrmPalette(true).isDark).toBe(true)
  })
})
