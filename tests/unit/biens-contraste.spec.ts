/**
 * Garde-fou : sur « Mes biens », l'encre posée sur un aplat reste lisible.
 *
 * ⛔ CE QUI A MOTIVÉ CE FICHIER. Quatre composants peignaient leurs libellés en
 * blanc sur un aplat coloré, avec des exceptions écrites à la main là où le
 * résultat devenait franchement invisible. Mesuré le 12 août 2026 : les pilules
 * de statut échouaient l'AA sur SIX des neuf combinaisons (« Réservé » en
 * sombre, 3,11:1 pour un libellé de 12 px), et CINQ des huit couleurs d'avatar
 * (`#F59E0B` : 2,15:1).
 *
 * Pourquoi personne ne l'avait vu : le défaut n'existait que dans le thème par
 * DÉFAUT, et les captures de la refonte avaient été prises en sombre.
 *
 * ⚠ CE TEST NE PORTE PAS SUR L'ÉCHELLE. Les tons de statut sont SÉMANTIQUES —
 * ils disent un état que les neutres et l'accent ne savent pas dire — et
 * sortent donc légitimement des barreaux de la vitrine, comme `danger` ou
 * `goal` côté mobile. Ce qui se vérifie ici est leur LISIBILITÉ, pas leur
 * provenance : deux questions distinctes, et c'est d'avoir confondu les deux
 * que le défaut a survécu à la migration.
 *
 * ⚠ Une troisième famille vivait ici — les trois paliers de la pastille de
 * score, mesurés à 2,41 / 2,51 / 2,80:1 en clair. La pastille a été RETIRÉE de
 * l'interface le 12 août (décision Julien), donc ses tests sont partis avec
 * elle : un garde-fou sur un composant qui n'existe plus est du bruit qui
 * finit par se périmer en silence.
 */
import { describe, it, expect } from 'vitest'
import { encreSur } from '@/components/megga-x-crm/tokens'
import { galStatus } from '@/components/crm/biens/gallery/galHelpers'
import { pickAvatarBg } from '@/lib/crmAdapters'

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

const AA = 4.5

describe('La pastille de score n’est pas revenue', () => {
  /**
   * Elle a été retirée le 12 août 2026 (décision Julien) : elle affichait une
   * ESTIMATION en tête de carte, là où l'agent cherche le titre et le prix. Son
   * composant et sa table de teintes sont supprimés ; ce test empêche qu'un
   * copier-coller la réintroduise sans qu'on en redécide.
   */
  it('son composant et ses jetons restent supprimés', async () => {
    const { existsSync } = await import('node:fs')
    for (const f of [
      'src/components/crm/biens/BnScoreBadge.tsx',
      'src/components/crm/biens/scoreTiers.ts',
    ]) {
      expect(existsSync(f), `${f} est revenu`).toBe(false)
    }
  })
})

/**
 * ── L'ENCRE SUR UN APLAT ─────────────────────────────────────────────────────
 *
 * ⛔ CE QUI A MOTIVÉ CE BLOC. Quatre composants de « Mes biens » posaient du
 * blanc sur leurs aplats, avec des exceptions écrites à la main là où le
 * résultat devenait franchement invisible. Mesuré le 12 août 2026 : les pilules
 * de statut échouaient l'AA sur SIX des neuf combinaisons, la pilule « urgent »
 * du bloc à-suivre sur les DEUX thèmes, et CINQ des huit couleurs d'avatar.
 *
 * La correction n'a pas été de choisir cinq nouvelles encres — c'eût été
 * reproduire le défaut à la teinte suivante — mais de la DÉRIVER de l'aplat.
 * Ces tests vérifient la règle sur les vrais aplats du produit : les tons de
 * statut et la palette d'avatar, qui vient de la donnée et n'est donc jamais
 * relue par un humain.
 */
describe('L’encre suit l’aplat', () => {
  it.each([false, true])('les cinq statuts sont lisibles (sombre=%s)', (dark) => {
    const faibles: string[] = []
    for (const s of ['active', 'reserved', 'draft', 'paused', 'sold']) {
      const { tone, ink } = galStatus(s, dark)
      const r = contraste(ink, tone)
      if (r < AA) faibles.push(`${s} : ${ink} sur ${tone} = ${r.toFixed(2)}:1`)
    }
    expect(faibles, `statuts sous ${AA}:1 :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * La palette d'avatar est indexée par un hachage de l'id du contact : aucun
   * humain ne relit la couleur d'un avatar avant qu'elle s'affiche. Si une
   * teinte n'est lisible que sous une encre, c'est en production qu'on
   * l'apprend.
   */
  it('les huit couleurs d’avatar sont lisibles sous l’encre dérivée', () => {
    // On passe par `pickAvatarBg` plutôt que par la table : c'est le chemin réel,
    // et il couvre la palette entière dès qu'on lui donne assez d'ids.
    const teintes = new Set(Array.from({ length: 200 }, (_, i) => pickAvatarBg(`c-${i}`)))
    expect(teintes.size, 'le hachage ne couvre pas toute la palette').toBeGreaterThanOrEqual(8)
    const faibles: string[] = []
    for (const t of teintes) {
      const r = contraste(encreSur(t), t)
      if (r < AA) faibles.push(`${t} = ${r.toFixed(2)}:1`)
    }
    expect(faibles, `avatars sous ${AA}:1 :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * Contrôle de la règle elle-même : elle doit BASCULER, pas rendre du blanc
   * partout. Un `encreSur` qui répondrait toujours la même chose passerait les
   * deux tests ci-dessus sur une palette assez sombre, et rien ne le dirait.
   */
  it('la règle bascule bien selon l’aplat', () => {
    expect(encreSur('#030303')).toBe('#ffffff')
    expect(encreSur('#ffffff')).toBe('#030303')
    expect(encreSur('#F59E0B')).toBe('#030303')  // 2,15:1 sous blanc, 9,60 sous encre sombre
    expect(encreSur('#0041D9')).toBe('#ffffff')  // 7,61:1 sous blanc
  })
})
