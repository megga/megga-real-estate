/**
 * Garde-fou : la COULEUR est gardée par une RÈGLE, plus par une liste.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────
 * ⛔ LE CLIQUET DE GRAMMAIRE NE PROSCRIT QUE QUATRE VALEURS. Trois noirs de Sugar
 * (`#0B0C0E`, `#0A0A0F`, `#0A0B0D`) et un gris-bleu (`#0F172A`), énumérés. Le code
 * vivant, lui, écrit **1 122 littéraux hors barreaux** — mesuré, commentaires
 * retirés. Une garde par ÉNUMÉRATION se contourne par voisinage : `#0A0B0E`
 * diffère du proscrit `#0A0B0D` d'un seul chiffre hexadécimal, et passait.
 *
 * ⚠ CE FICHIER NE PRÉTEND PAS JUGER LES 1 122. Beaucoup ENCODENT — les teintes
 * d'étape d'un deal (`CRM_STAGE_HUE`), les palettes d'avatar, les séries d'un
 * graphique, les couleurs de marque des icônes sociales. Elles sont hors de la
 * direction **par nature**, et le dépôt le dit déjà. Les bannir serait faux ; les
 * ignorer serait renoncer. La troisième voie est un PLAFOND : le compte est figé
 * zone par zone et ne peut que baisser.
 *
 * ── LA RÈGLE DURE, ET POURQUOI ELLE EST ÉTROITE ──────────────────────────────
 * Un QUASI-NOIR posé en SURFACE doit être un barreau. C'est la seule famille sur
 * laquelle une règle sans inventaire tient, et c'est un raisonnement, pas un
 * choix de périmètre :
 *
 *  · un quasi-noir n'ENCODE jamais rien — aucune information ne se lit dans
 *    l'écart entre `#0A0B0E` et `#090909` ; c'est une surface ou une encre ;
 *  · posé en SURFACE, il définit un palier de l'échelle sombre, et MEGGA X en
 *    fixe exactement quatre (canvas `n100`, sous-surface `n200`, carte `n300`,
 *    élevée `n400`). Un cinquième palier n'est pas une nuance, c'est une échelle
 *    concurrente ;
 *  · les DÉGRADÉS et les OMBRES en sont exclus, et pas par commodité : un voile
 *    noir à 6 % sur une photo n'est pas un palier, c'est une transparence. Les y
 *    soumettre ferait rougir du code correct, et une clause qui refuse du code
 *    correct se fait désarmer, pas corriger.
 *
 * ── CE QUE LA MESURE A TROUVÉ (16 août 2026) ─────────────────────────────────
 * QUATORZE surfaces hors échelle. Sept vivantes, reprises au même lot et mappées
 * par RÔLE — jamais par proximité de teinte, sans quoi on recopie l'erreur d'un
 * cran plus fin : la pastille flottante d'Analytics et le tooltip des Réglages
 * montent sur `n400` (élevée), le recouvrement de galerie de la page d'accueil
 * descend sur `n100` (canvas), sa scène photo sur `n200`, sa pellicule sur `n300`.
 * Les sept autres portent une exemption ÉCRITE ci-dessous.
 */
import { describe, it, expect } from 'vitest'
import { emptyRoots, readFileSafely, rel, repoPath, scanRoots } from './helpers/fs-scan'

/** Au-delà, ce n'est plus un quasi-noir : la règle cesse de s'appliquer. */
const SEUIL_NOIR = 34

/* ─── Les barreaux, DÉRIVÉS de la source ─────────────────────────────────────
 * ⛔ Jamais recopiés. Figer une liste ici la ferait diverger de la direction au
 * premier changement de jeton — et cette garde se mettrait à refuser la
 * direction elle-même, ce qui est le mode d'échec le plus coûteux : on croirait
 * le code fautif alors que c'est la garde qui a vieilli.
 */
const sansCommentaires = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, (b) => '\n'.repeat((b.match(/\n/g) ?? []).length))
    .replace(/\/\/[^\n]*/g, ' ')

function lire(chemin: string): string {
  const lu = readFileSafely(repoPath(chemin))
  expect(lu.status, `${chemin} illisible : la garde ne mesure rien`).toBe('ok')
  return lu.status === 'ok' ? lu.value : ''
}

/** `#abc` → `#aabbcc` ; `#rrggbbaa` → `#rrggbb`. L'alpha ne change pas la teinte. */
function normaliser(hex: string): string {
  const h = hex.toLowerCase()
  if (h.length === 4) return '#' + [...h.slice(1)].map((c) => c + c).join('')
  if (h.length === 9) return h.slice(0, 7)
  return h
}

const BARREAUX = new Set<string>()
for (const source of ['src/components/megga-x-crm/tokens.ts', 'src/styles/megga-x.generated.css']) {
  const brut = source.endsWith('.css') ? lire(source) : sansCommentaires(lire(source))
  for (const m of brut.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) BARREAUX.add(normaliser(m[0]))
}

/* ─── Le balayage ────────────────────────────────────────────────────────────── */

const scan = scanRoots([{ root: 'src', keep: (n) => /\.tsx?$/.test(n) }])
const SOURCES = scan.files.map((abs) => ({
  chemin: rel(abs),
  code: sansCommentaires(readFileSafely(abs).status === 'ok' ? (readFileSafely(abs) as { value: string }).value : ''),
}))

/** La zone d'un fichier : `src/<a>/<b>`, ou le fichier lui-même s'il est plus haut. */
function zoneDe(chemin: string): string {
  const p = chemin.split('/')
  return p.length > 3 ? p.slice(0, 3).join('/') : chemin
}

/**
 * ⛔ LES SURFACES QUI RESTENT HORS ÉCHELLE *PAR DÉCISION*, et « absent » n'en est
 * pas une. Chaque entrée porte son motif ; une entrée qui ne correspond plus à
 * aucun code fait rougir — sans quoi une exemption survit à ce qu'elle exemptait.
 */
/*
 * ⚠ L'EXEMPTION DU GABARIT D'E-MAIL A ÉTÉ RETIRÉE — non pas parce que son motif
 * était faux, mais parce qu'il a DÉMÉNAGÉ. `src/hooks/useSendAgentEmail.ts`
 * construisait son HTML en clair, fond littéral compris ; le chantier de la
 * coquille e-mail (arrivé par `main`) l'a déplacé dans
 * `supabase/functions/_shared/email-shell.ts`, hors de `src/` et donc hors de ce
 * balayage. Le motif reste vrai — un client de messagerie ne connaît ni
 * `data-theme` ni les variables du CRM — mais il n'a plus rien à couvrir ici.
 *
 * ⛔ C'est la clause « chaque exemption correspond encore à du code » qui l'a
 * signalé, et elle ne l'a fait qu'en CI : la CI teste la FUSION avec `main`,
 * pendant que la branche était en retard de 35 commits. Une exemption calibrée
 * sur un arbre local peut être périmée à la seconde où elle est écrite.
 */
const SURFACES_EXEMPTEES: { fichier: string; motif: string }[] = [
  {
    fichier: 'src/pages/dev/OnboardingPreviewPage.tsx',
    motif:
      'banc de développement ABSENT du bundle (ternaire `import.meta.env.DEV`), déjà exempté ' +
      'par écrit dans le cliquet de grammaire et gardé par `dev-bancs-frontiere.spec.ts`.',
  },
  {
    fichier: 'src/pages/dev/PublicShowcasePage.tsx',
    motif:
      'même motif : banc absent du bundle, exemption écrite et gardée par ' +
      '`dev-bancs-frontiere.spec.ts`.',
  },
]

/**
 * Zone → littéraux hors barreaux ENCORE tolérés. Relevé le 16 août 2026.
 *
 * ⛔ IL NE PEUT QUE RÉTRÉCIR. Un inventaire dont personne ne descend le compte
 * quand une zone est nettoyée n'est plus un cliquet : c'est une photographie qui
 * vieillit, et le lot suivant y réintroduirait ce que le précédent a retiré.
 */
/*
 * ⚠ `src/components/megga-x-crm` N'Y FIGURE PAS, et ce n'est pas un oubli : les
 * barreaux sont DÉRIVÉS de ce dossier, donc chacun de ses littéraux en est un par
 * construction. Sa ligne vaudrait toujours zéro. L'inscrire ferait rougir la
 * clause « aucune entrée ne garde de crédit » à chaque exécution.
 */
const HORS_ASSUMES = new Map<string, number>([
  ['src/components/crm', 538],
  ['src/components/crm-mobile', 141],
  ['src/components/crm-dossiers', 68],
  ['src/components/crm-wizard', 48],
  ['src/components/propertyx', 40],
  ['src/components/listings', 37],
  ['src/pages/dev', 26],
  ['src/pages/agent', 4],
  ['src/components/kyc-magic-link', 24],
  ['src/components/auth-bento', 22],
  ['src/components/kyc-report', 22],
  ['src/components/matching-recherche', 23],
  ['src/components/ai-copilot', 14],
  ['src/hooks/useAdminSurfaces.ts', 10],
  ['src/hooks/useAtelierMatching.ts', 8],
  ['src/hooks/useRelanceLeads.ts', 8],
  ['src/lib/crmAdapters.ts', 8],
  ['src/hooks/useAgentProfileScreen.ts', 7],
  ['src/hooks/useCalendarScreen.ts', 6],
  ['src/pages/public', 6],
  ['src/components/auth', 4],
  ['src/components/buyer-reception', 4],
  ['src/types/visit.ts', 4],
  ['src/components/matching-atelier', 3],
  ['src/components/admin', 2],
  ['src/components/layout', 1],
  ['src/components/ui', 1],
])

/** Le témoin : la preuve que le balayage voit encore l'arbre. */
const TEMOIN = 'src/components/crm/tokens.ts'

describe('Couleur — les barreaux de MEGGA X, et ce qui s’en écarte', () => {
  it('le balayage voit l’arbre et les barreaux', () => {
    expect(emptyRoots(scan), 'racine vide : chemin cassé, pas dépôt propre').toEqual([])
    expect(scan.unreadable).toEqual([])
    expect(SOURCES.length, 'le balayage ne voit plus src/').toBeGreaterThan(300)
    expect(SOURCES.map((s) => s.chemin)).toContain(TEMOIN)
    // ⛔ CONTRÔLE POSITIF sur les barreaux : dérivés d'une source illisible, ils
    // rendraient un ensemble VIDE — et tout littéral serait alors « hors », ou
    // (pire) la règle des surfaces ne trouverait plus aucun barreau à opposer.
    expect(BARREAUX.size, 'aucun barreau dérivé : les sources de la direction ne sont plus lues')
      .toBeGreaterThan(80)
    for (const attendu of ['#030303', '#050505', '#090909', '#181818', '#424bfb']) {
      expect([...BARREAUX], `barreau ${attendu} absent — la dérivation a changé de source`).toContain(attendu)
    }
  })

  /**
   * ⛔ LA RÈGLE DURE — sans inventaire, parce qu'elle est étroite ET raisonnée.
   * Voir l'en-tête pour les trois raisons qui la bornent aux surfaces.
   */
  it('aucun quasi-noir hors échelle n’est posé en SURFACE', () => {
    const exemptes = new Set(SURFACES_EXEMPTEES.map((e) => e.fichier))
    const fautifs: string[] = []
    for (const { chemin, code } of SOURCES) {
      if (exemptes.has(chemin)) continue
      code.split('\n').forEach((ligne, i) => {
        // Une SURFACE : la ligne pose un fond, et ce n'est ni un dégradé ni une ombre.
        if (!/(background|backgroundColor)\s*:/.test(ligne)) return
        if (/gradient|shadow|inset/i.test(ligne)) return
        for (const m of ligne.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
          const hex = normaliser('#' + m[1])
          if (BARREAUX.has(hex)) continue
          const canaux = [0, 2, 4].map((k) => parseInt(m[1]!.slice(k, k + 2), 16))
          if (Math.max(...canaux) > SEUIL_NOIR) continue
          fautifs.push(`${chemin}:${i + 1} → ${hex}`)
        }
      })
    }
    expect(
      fautifs,
      'palier sombre hors échelle : MEGGA X en fixe quatre (n100 canvas, n200 sous-surface, ' +
        'n300 carte, n400 élevée). Un cinquième n’est pas une nuance, c’est une échelle ' +
        'concurrente — mapper par RÔLE, pas par proximité de teinte :\n  ',
    ).toEqual([])
  })

  /**
   * ⚠ Une exemption qui ne correspond plus à rien laisse croire qu'un écart est
   * couvert alors qu'il a disparu — ou, pire, en couvre un neuf par accident.
   */
  it('chaque exemption de surface correspond encore à du code', () => {
    const mortes: string[] = []
    for (const { fichier, motif } of SURFACES_EXEMPTEES) {
      expect(motif.length, `${fichier} : exemption sans motif écrit`).toBeGreaterThan(60)
      const s = SOURCES.find((x) => x.chemin === fichier)
      if (!s) { mortes.push(`${fichier} : absent du balayage`); continue }
      const aUnNoirDeSurface = s.code.split('\n').some((l) => {
        if (!/(background|backgroundColor)\s*:/.test(l) || /gradient|shadow|inset/i.test(l)) return false
        return [...l.matchAll(/#([0-9a-fA-F]{6})\b/g)].some((m) => {
          const hex = normaliser('#' + m[1])
          if (BARREAUX.has(hex)) return false
          return Math.max(...[0, 2, 4].map((k) => parseInt(m[1]!.slice(k, k + 2), 16))) <= SEUIL_NOIR
        })
      })
      if (!aUnNoirDeSurface) mortes.push(`${fichier} : plus aucun quasi-noir de surface — retirer l'exemption`)
    }
    expect(mortes, `exemption sans support :\n  ${mortes.join('\n  ')}`).toEqual([])
  })

  /* ─── Le plafond ─────────────────────────────────────────────────────────── */

  function horsParZone(): Map<string, number> {
    const vu = new Map<string, number>()
    for (const { chemin, code } of SOURCES) {
      for (const m of code.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        if (BARREAUX.has(normaliser(m[0]))) continue
        const z = zoneDe(chemin)
        vu.set(z, (vu.get(z) ?? 0) + 1)
      }
    }
    return vu
  }

  it('aucune zone ne dépasse son inventaire de couleurs hors barreaux', () => {
    const vu = horsParZone()
    const trop: string[] = []
    for (const [zone, n] of vu) {
      const permis = HORS_ASSUMES.get(zone)
      if (permis === undefined) { trop.push(`${zone} : ${n} littéraux hors barreaux, aucune entrée d'inventaire`); continue }
      if (n > permis) trop.push(`${zone} : ${n} > ${permis} permis`)
    }
    expect(
      trop,
      'couleur hors barreaux au-delà de l’inventaire — passer par un jeton, ou écrire ce ' +
        'que la teinte ENCODE :\n  ',
    ).toEqual([])
  })

  /**
   * ⛔ ET L'INVENTAIRE NE GARDE AUCUN CRÉDIT. Sans cette clause, une zone nettoyée
   * conserverait sa marge et le lot suivant pourrait y réintroduire en silence ce
   * que le précédent a retiré.
   */
  it('l’inventaire des couleurs ne garde aucun crédit', () => {
    const vu = horsParZone()
    const perimees: string[] = []
    for (const [zone, permis] of HORS_ASSUMES) {
      const n = vu.get(zone)
      if (n === undefined) { perimees.push(`${zone} : zone absente du balayage — l'entrée ne garde plus rien`); continue }
      if (n < permis) perimees.push(`${zone} : ${n} réels < ${permis} inscrits — descendre le compte`)
    }
    expect(perimees, `inventaire à resserrer :\n  ${perimees.join('\n  ')}`).toEqual([])
  })
})
