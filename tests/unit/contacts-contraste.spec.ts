/**
 * Garde-fou : sur « Contacts », l'encre posée sur un aplat de DONNÉES reste
 * lisible.
 *
 * ⛔ CE QUI A MOTIVÉ CE FICHIER. Deux atomes de la liste peignaient leur libellé
 * en blanc figé sur un aplat qui, lui, vient de la donnée : l'avatar
 * (`sp.accentInk` sur `pickAvatarBg(id)`) et la pilule de type (`'#fff'` sur
 * `CTP_FN[audience]`). Personne ne relit ces couleurs avant qu'elles
 * s'affichent — l'une est indexée par un hachage de l'id du contact, l'autre par
 * son type — donc c'est en production qu'on apprend qu'une teinte est illisible.
 *
 * ⚠ POURQUOI `biens-contraste.spec.ts` NE COUVRAIT PAS ÇA, alors qu'il teste la
 * MÊME palette d'avatar par le MÊME `pickAvatarBg`. Il vérifie que la RÈGLE
 * tient — « ces huit teintes sont lisibles sous l'encre que `encreSur` en
 * dérive » — et c'est vrai. Mais « Contacts » n'appelait pas `encreSur` : la
 * garde était verte pendant que l'écran était faux. Une garde sur une règle ne
 * dit rien de son APPLICATION ; il faut lier la règle au code qui la porte,
 * d'où le second bloc de ce fichier.
 *
 * ⚠ Le défaut ne dépend PAS du thème, contrairement aux neuf de « Mes biens »
 * qui ne cassaient qu'en clair. `accentInk` vaut `n1000` (#ffffff) dans les DEUX
 * branches de `mxCrmPalette`, et `CTP_FN` ne varie pas non plus. Regarder les
 * deux thèmes reste la règle — mais ici, un seul aurait suffi à le voir.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { encreSur } from '@/components/megga-x-crm/tokens'
import { CTP_FN } from '@/components/crm-sugar/contacts-pager/ctpTokens'
import { pickAvatarBg } from '@/lib/sugarAdapters'
import { corpsDeFonction } from './helpers/ts-source'

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
 * Seuil 4,5 et non 3 : le palier « grand texte » de WCAG commence à 18,66 px en
 * gras. Les initiales d'avatar font `size * 0.36`, soit 13,7 px à la taille par
 * défaut (38) et 17,3 px sur le héro de la fiche (48) — sous le palier dans les
 * deux cas. Le libellé de la pilule est à `--crm-text-sm`. Aucun des deux n'est
 * du grand texte.
 */
const AA = 4.5

const LISTE = 'src/components/crm-sugar/contacts-pager/ContactsPager.tsx'
const FICHE = 'src/components/crm-sugar/contacts-pager/ContactDetailPager.tsx'

/**
 * Les tons d'aplat de la fiche (`buildPal`), par thème. Ils sont SÉMANTIQUES —
 * ils disent l'état d'un match ou d'un lien — et sortent donc légitimement des
 * barreaux de la vitrine. Ce qui se vérifie ici est leur LISIBILITÉ, pas leur
 * provenance : confondre les deux est ce qui a laissé le défaut passer.
 */
const TONS_FICHE = {
  clair: { ghost: '#B5BAC2', buyer: '#1E5BC6', ok: '#059669', cyan: '#0891B2', wait: '#7A8088', danger: '#8E1F3D' },
  sombre: { ghost: '#4C505A', buyer: '#6F8CFF', ok: '#34D399', cyan: '#38BDD8', wait: '#8A909B', danger: '#E0738C' },
} as const

/**
 * ── CE QUE CE BLOC GARDE VRAIMENT ────────────────────────────────────────────
 *
 * ⚠ PAS les teintes. Mesuré par balayage du cube RVB : avec les deux pôles de
 * `encreSur` (#ffffff et #030303), la teinte la plus défavorable qui existe
 * (#735ff0) atteint encore 4,541:1 sous la meilleure des deux encres. AUCUNE
 * couleur ne peut donc faire rougir les deux tests ci-dessous — ajouter une
 * neuvième teinte d'avatar ne les mettra pas à l'épreuve, et s'y fier pour ça
 * serait se tromper sur ce qu'on a.
 *
 * Ce qu'ils gardent, c'est l'ÉCART DES PÔLES. Si `n100` s'éclaircissait ou
 * `n1000` s'assombrissait — un geste d'échelle, pas de contraste —, ce plancher
 * de 4,54 passerait sous l'AA et la règle cesserait silencieusement de tenir sa
 * promesse partout. Le test `le plancher de la règle` ci-dessous mesure ce
 * plancher au lieu de le supposer.
 *
 * Ce qui garde l'APPLICATION de la règle est le bloc suivant, pas celui-ci.
 */
describe('L’encre suit l’aplat — les valeurs', () => {
  /**
   * Le plancher de `encreSur` sur TOUT le cube RVB. C'est la propriété dont
   * dépendent les deux tests suivants ; sans elle ils sont vrais par
   * construction et ne disent rien.
   */
  it('le plancher de la règle reste au-dessus de l’AA', () => {
    let pire = Number.POSITIVE_INFINITY
    let quoi = ''
    for (let r = 0; r < 256; r += 5) {
      for (let g = 0; g < 256; g += 5) {
        for (let b = 0; b < 256; b += 5) {
          const hex = '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
          const m = contraste(encreSur(hex), hex)
          if (m < pire) { pire = m; quoi = hex }
        }
      }
    }
    expect(pire, `pire teinte du cube : ${quoi} à ${pire.toFixed(3)}:1`).toBeGreaterThanOrEqual(AA)
  })

  /**
   * Mesuré le 12 août 2026, sous encre blanche : SEPT des huit teintes échouent
   * l'AA — #F59E0B 2,15 · #06B6D4 2,43 · #10B981 2,54 · #EC4899 3,53 · #8B5CF6
   * et #E53935 4,23 · #6366F1 4,47. Seule #0041D9 passe (7,61).
   *
   * ⚠ Le plan de refonte en annonçait CINQ. L'écart vient du seuil : à 3:1 il
   * n'y en a que trois, à 4,5 il y en a sept. Le nombre ne veut rien dire sans
   * le seuil qui l'a produit — d'où la note ci-dessus sur le palier « grand
   * texte », qui est ce qui se démontre.
   *
   * ⚠ Ce test vérifie que le chemin réel (`pickAvatarBg`) couvre bien les huit
   * teintes. Il ne peut pas, lui, en réfuter une : voir la note du bloc.
   */
  it('les huit teintes d’avatar sont lisibles sous l’encre dérivée', () => {
    // On passe par `pickAvatarBg` — le chemin réel — plutôt que par la table :
    // une copie dériverait à la première teinte ajoutée.
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
   * Mesuré sous encre blanche : `seller` 4,37 · `tenant` 3,68 · `ok` 3,77 —
   * TROIS des quatre sous le seuil. Seul `buyer` (#1E5BC6) passe, à 6,24.
   */
  it('les quatre couleurs fonctionnelles sont lisibles sous l’encre dérivée', () => {
    const faibles: string[] = []
    for (const [nom, aplat] of Object.entries(CTP_FN)) {
      const r = contraste(encreSur(aplat), aplat)
      if (r < AA) faibles.push(`${nom} (${aplat}) = ${r.toFixed(2)}:1`)
    }
    expect(faibles, `CTP_FN sous ${AA}:1 :\n  ${faibles.join('\n  ')}`).toEqual([])
  })
})

/**
 * ── LA RÈGLE LIÉE AU CODE QUI LA PORTE ───────────────────────────────────────
 *
 * ⛔ SANS CE BLOC, LE FICHIER SERAIT VERT SUR UN ÉCRAN FAUX. C'est exactement ce
 * qui est arrivé : `biens-contraste.spec.ts` vérifie déjà la palette d'avatar
 * sous `encreSur`, il est vert depuis le 12 août, et les avatars de « Contacts »
 * étaient blancs pendant tout ce temps. Vérifier qu'une fonction rend une bonne
 * valeur ne dit rien de qui l'appelle.
 *
 * On lie donc la règle au SOURCE : un aplat qui vient de la donnée ne peut pas
 * porter une encre écrite à la main.
 *
 * ⚠ La garde vise l'EXPRESSION, pas le fichier. `ContactsPager` a de bonnes
 * raisons d'écrire du blanc ailleurs (un glyphe sur l'accent, par exemple) :
 * exempter le fichier en bloc laisserait revenir précisément ce qu'on surveille.
 */
describe('L’encre suit l’aplat — le code l’applique', () => {
  const liste = readFileSync(LISTE, 'utf8')
  const fiche = readFileSync(FICHE, 'utf8')

  /** Le balayage voit encore les fichiers — sinon tout passe par vacuité. */
  it('les sources sont bien lues', () => {
    expect(liste.length).toBeGreaterThan(1000)
    expect(fiche.length).toBeGreaterThan(1000)
    for (const nom of ['CtpAvatar', 'CtpTypePill']) expect(liste).toContain(nom)
    expect(fiche).toContain('CdStatePill')
  })

  /**
   * ⛔ LES APLATS DE LA FICHE QUE LA SONDE DE RENDU NE VOIT PAS TOUS.
   *
   * Trois des quatre sites corrigés sur `ContactDetailPager` ont été trouvés au
   * RENDU (pilules d'état de la boucle et des liens de réception, mesurées
   * jusqu'à 1,95:1 en clair). Le quatrième — l'avatar du héro — ne l'a PAS été :
   * la fiche de démonstration porte `#0041D9`, la seule des huit teintes qui
   * passait déjà. Le banc ne prouve que ce qu'il montre.
   *
   * D'où ce test, qui ne dépend d'aucune donnée : il lit le fichier entier et
   * refuse toute encre écrite à la main posée sur un aplat.
   */
  it('aucune encre figée sur un aplat de la fiche', () => {
    const fautifs: string[] = []
    fiche.split('\n').forEach((ligne, i) => {
      // Un `color:` en dur ET un `background:` non transparent sur la même
      // déclaration : c'est la forme du défaut, quelle que soit la variable.
      if (!/background:\s*[^,;\n]*\b(?:P\.\w+|\w+\.avatarBg|aplat)\b/.test(ligne)) return
      const enDur = ligne.match(/color:\s*(?:'#[0-9a-f]{3,8}'|"#[0-9a-f]{3,8}")/gi)
      if (enDur) fautifs.push(`${FICHE}:${i + 1} — ${enDur.join(' ')}`)
    })
    expect(fautifs, `encre figée sur un aplat :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * Les six tons de `buildPal`, dans les DEUX thèmes. Sous le blanc figé
   * d'avant : quatre échouaient en clair (ghost 1,95 · cyan 3,68 · ok 3,77 ·
   * wait 3,98) et CINQ en sombre (ok 1,92 · cyan 2,22 · danger 3,00 · buyer
   * 3,06 · wait 3,21). `danger` à 3,00 portait le libellé du bouton qui
   * SUPPRIME un contact.
   */
  it.each(Object.entries(TONS_FICHE))('les tons de la fiche sont lisibles (%s)', (_theme, tons) => {
    const faibles: string[] = []
    for (const [nom, aplat] of Object.entries(tons)) {
      const r = contraste(encreSur(aplat), aplat)
      if (r < AA) faibles.push(`${nom} (${aplat}) = ${r.toFixed(2)}:1`)
    }
    expect(faibles, `tons sous ${AA}:1 :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * Les valeurs ci-dessus sont recopiées de `buildPal`, qui n'est pas exporté
   * (c'est un détail interne de la fiche). Une copie dérive — donc on vérifie
   * qu'elle correspond encore au source, au lieu de l'espérer.
   */
  it('les tons recopiés correspondent encore à buildPal', () => {
    const manquants: string[] = []
    for (const tons of Object.values(TONS_FICHE)) {
      for (const aplat of Object.values(tons)) {
        if (!fiche.includes(aplat)) manquants.push(aplat)
      }
    }
    expect(manquants, `tons absents de ${FICHE} :\n  ${manquants.join('\n  ')}`).toEqual([])
  })

  /**
   * Les deux atomes qui posent une encre sur un aplat de données, désignés par
   * leur NOM et non par l'expression qu'ils écrivent aujourd'hui.
   *
   * ⚠ Une première version ancrait sur `background: c.avatarBg` et
   * `background: CTP_FN[`. Elle rougissait bien — mais le correctif, qui range
   * l'aplat dans une variable pour ne pas le calculer deux fois, l'aurait fait
   * passer au VERT sans que l'encre soit corrigée : plus de motif, donc plus de
   * mesure. Une garde qu'on désarme en écrivant le correctif ne garde rien.
   *
   * `aplat` nomme ce que chaque atome doit avoir : un fond qui vient de la
   * donnée. Sans lui l'atome n'a plus rien à surveiller, et la garde le dit au
   * lieu de se taire.
   */
  const ATOMES = [
    { quoi: 'avatar', fn: 'CtpAvatar', aplat: /background:\s*\w+/ },
    { quoi: 'pilule de type', fn: 'CtpTypePill', aplat: /background:\s*\w+/ },
  ]

  it.each(ATOMES)('l’encre de $quoi est dérivée de son aplat', ({ quoi, fn, aplat }) => {
    const corps = corpsDeFonction(liste, fn)
    expect(corps, `${quoi} : ${fn} introuvable — la garde ne mesure plus rien`).not.toBeNull()

    // L'atome pose bien un aplat…
    expect(aplat.test(corps!), `${quoi} : plus d'aplat dans ${fn}`).toBe(true)

    // …son encre vient de la règle…
    expect(
      /color:\s*encreSur\(/.test(corps!),
      `${quoi} : l'encre ne passe pas par encreSur() —\n${corps}`,
    ).toBe(true)

    // …et aucune encre écrite à la main ne subsiste dans l'atome.
    const enDur = corps!.match(/color:\s*(?:'#[0-9a-f]{3,8}'|"#[0-9a-f]{3,8}"|\w+\.accentInk)/gi) ?? []
    expect(enDur, `${quoi} : encre écrite à la main —\n  ${enDur.join('\n  ')}`).toEqual([])
  })
})
