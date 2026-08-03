/**
 * Garde-fou : le lien KYC envoyé au client mène à une route qui EXISTE.
 *
 * Ce qu'il gardait. Les deux fonctions d'envoi bâtissaient `https://kyc.megga.ch/
 * <jeton>` — un hôte sans aucun enregistrement DNS, donc une erreur de résolution
 * avant même un 404. Rien ne rougissait : aucune suite n'observe cette URL (les
 * tests backend ne postent pas d'e-mail réel, les e2e non plus), et le réglage
 * censé la corriger, `MEGGA_KYC_PUBLIC_DOMAIN`, n'était déclaré nulle part.
 *
 * Ce que ce fichier vérifie, et POURQUOI il ne se contente pas de chercher
 * « app.megga.ch » dans la chaîne : l'hôte n'a jamais été le problème. Le piège
 * était le CHEMIN — le parcours client est `/kyc/:token`, une route du routeur,
 * pas la racine d'un domaine. On extrait donc le chemin de l'URL construite et on
 * le confronte aux routes réellement déclarées dans `src/App.tsx`.
 *
 * Ce que le test ne prouve PAS : que l'hôte répond (aucun appel réseau), ni qu'un
 * `MEGGA_APP_URL` mal posé en production pointe au bon endroit. Il prouve que la
 * forme du lien correspond à ce que le routeur sait servir.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { kycMagicLinkUrl } from '../../supabase/functions/_shared/app-url'

/** Jeton de forme réaliste : base64url, avec le point qui sépare payload et signature. */
const JETON = 'eyJpZCI6IjljMiIsImV4cCI6MX0.c2lnbmF0dXJl-_x'

/**
 * `app-url.ts` lit `Deno.env` — absent sous Node. Le module le lit DANS la
 * fonction (et non dans une `const`), ce qui permet de rejouer plusieurs
 * configurations dans le même fichier.
 */
function poserEnv(valeurs: Record<string, string> = {}): void {
  ;(globalThis as unknown as { Deno: { env: { get: (k: string) => string | undefined } } }).Deno = {
    env: { get: (k: string) => valeurs[k] },
  }
}

/**
 * Chemins absolus déclarés par le routeur.
 *
 * Le fourre-tout `path="*"` est volontairement hors du lot : y correspondre, c'est
 * précisément tomber sur la page 404.
 */
function routesDeclarees(): string[] {
  const source = readFileSync(resolve(__dirname, '../../src/App.tsx'), 'utf8')
  const chemins = [...source.matchAll(/path="(\/[^"]*)"/g)].map((m) => m[1])
  if (chemins.length < 20) {
    throw new Error(
      `seulement ${chemins.length} routes extraites de src/App.tsx — l'extraction ne prouve plus rien`,
    )
  }
  return chemins
}

/** Routes qui servent ce chemin. Un `:param` couvre un segment, un `*` final la fin du chemin. */
function routesServant(chemin: string): string[] {
  return routesDeclarees().filter((route) => {
    const motif = route
      .split('/')
      .map((seg) => {
        if (seg.startsWith(':')) return '[^/]+'
        if (seg === '*') return '.+'
        return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      })
      .join('/')
    return new RegExp(`^${motif}$`).test(chemin)
  })
}

describe('URL du lien magique KYC', () => {
  beforeEach(() => poserEnv())

  it('produit un chemin servi par une route déclarée dans src/App.tsx', () => {
    const chemin = new URL(kycMagicLinkUrl(JETON)).pathname
    // Égalité stricte plutôt qu'un simple « au moins une » : renommer la route
    // sans déplacer le constructeur (ou l'inverse) doit rougir ici.
    expect(routesServant(chemin)).toEqual(['/kyc/:token'])
  })

  it("l'ancienne forme, jeton à la racine d'un domaine dédié, ne correspond à aucune route", () => {
    // Contrôle négatif : sans lui, on ne saurait pas que la vérification a des dents.
    // C'est exactement ce que produisait `https://${PUBLIC_DOMAIN}/${token}`.
    expect(routesServant(`/${JETON}`)).toEqual([])
  })

  it('retombe sur le domaine de l\'app quand rien n\'est configuré', () => {
    expect(kycMagicLinkUrl(JETON)).toBe(`https://app.megga.ch/kyc/${JETON}`)
  })

  it('le réglage porte une base, pas un domaine qui remplacerait le chemin', () => {
    // Un futur domaine dédié change l'hôte ; le segment `/kyc` reste, parce qu'il
    // appartient à la route et non au réglage. Slash final toléré : une valeur
    // recopiée depuis un navigateur en porte un, et `//kyc/` ne serait pas servi.
    poserEnv({ MEGGA_APP_URL: 'https://kyc.megga.ch/' })
    const url = kycMagicLinkUrl(JETON)
    expect(url).toBe(`https://kyc.megga.ch/kyc/${JETON}`)
    expect(routesServant(new URL(url).pathname)).toEqual(['/kyc/:token'])
  })
})

describe('Les deux émetteurs du lien', () => {
  const FONCTIONS = ['magic-link-create', 'magic-link-send-email'] as const
  const source = (fn: string) =>
    readFileSync(resolve(__dirname, `../../supabase/functions/${fn}/index.ts`), 'utf8')

  it.each(FONCTIONS)('%s n\'en construit aucun lui-même', (fn) => {
    const src = source(fn)
    // Le lien rendu à l'agent et celui du bouton de l'e-mail sont le MÊME lien :
    // ils sont identiques parce qu'un seul code les fabrique, pas par discipline.
    expect(src).toContain('kycMagicLinkUrl(')
    expect(
      /https:\/\/\$\{/.test(src),
      'une URL assemblée sur place peut diverger de celle du constructeur partagé',
    ).toBe(false)
  })

  it.each(FONCTIONS)('%s ne lit plus MEGGA_KYC_PUBLIC_DOMAIN', (fn) => {
    // Réglage retiré : il promettait un domaine là où la route exige un segment de
    // chemin, et son repli désignait un hôte sans DNS.
    expect(source(fn)).not.toContain('MEGGA_KYC_PUBLIC_DOMAIN')
  })
})
