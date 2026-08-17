// La carte WhatsApp des Réglages n'offre PLUS qu'un chemin : saisir son numéro, recevoir
// un code, le taper.
//
// ── Pourquoi une garde, alors qu'il s'agit d'un choix de produit ────────────
// Parce que le code retiré ici a été redemandé trois fois avant de l'être. L'appairage
// (« MEGGA affiche huit chiffres, envoyez-les depuis votre WhatsApp ») prouve davantage
// et ne coûte rien : c'est un argument technique solide, et il a suffi à le faire
// survivre à chaque passage. Ce qu'il ne dit pas, c'est que l'agent doit quitter le CRM,
// ouvrir une autre application et recopier un code pour établir ce qu'un code REÇU
// établit sans rien quitter. La décision (Julien, 17.08.2026) tranche en faveur du
// parcours, pas de la preuve.
//
// Une garde par CONSTAT de fichier, donc, et pas par rendu : ce qui est défendu n'est pas
// un comportement mais une ABSENCE, et une absence ne se teste pas en cliquant.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const CARTE = readFileSync('src/components/crm/settings/WhatsAppPairingCard.tsx', 'utf8')

/** Blanchit les commentaires : ce fichier RACONTE le retrait, il ne doit pas s'auto-accuser. */
const code = CARTE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe("fiche profil — l'indice de la ligne WhatsApp est ATTEIGNABLE", () => {
  const KIT = readFileSync('src/components/crm/settings/focus/pfKit.tsx', 'utf8')

  it('rend `row.hint` en dehors de la branche `locked`', () => {
    // ⛔ DÉFAUT MESURÉ, ET IL EXPLIQUE UN CONSTAT UTILISATEUR. `row.hint` n'avait qu'un
    // lecteur : `title={row.hint}` sur le cadenas des lignes VERROUILLÉES. La ligne
    // « Numéro WhatsApp » n'est pas verrouillée — son indice n'était donc rendu nulle
    // part, pas même en infobulle. Sur le bureau, un agent sans numéro vérifié voyait
    // une ligne vide de plus, indiscernable des six autres, sans un mot sur l'endroit
    // où la remplir. Le CRM mobile, lui, l'écrivait déjà : deux écrans du même produit
    // ne disaient pas la même chose du même champ.
    const lecteurs = KIT.match(/row\.hint/g) ?? []
    expect(
      lecteurs.length,
      'row.hint doit avoir un lecteur hors du cadenas, sinon l\'indice est mort',
    ).toBeGreaterThan(1)
    // Et ce lecteur doit vivre dans la branche « ligne vide » : c'est là qu'il renseigne.
    expect(KIT).toMatch(/\) : row\.hint \? \(/)
  })
})

describe('carte WhatsApp des Réglages — la saisie du code est le seul chemin', () => {
  it("n'appelle plus la génération de code d'appairage", () => {
    expect(code).not.toMatch(/generateCode/)
  })

  it("n'affiche plus de code à recopier ni de lien wa.me pré-rempli", () => {
    // `buildWaMeUrl` ouvrait WhatsApp avec le code déjà écrit : l'ergonomie de la voie
    // retirée, donc son dernier vestige visible.
    expect(code).not.toMatch(/buildWaMeUrl/)
    expect(code).not.toMatch(/pairing_code/)
  })

  it('rend la saisie du numéro SANS la conditionner à la sonde de disponibilité', () => {
    // ⛔ LE DÉFAUT EXACT SIGNALÉ EN PRODUCTION. Le bloc de saisie était enveloppé dans
    // `{otpAvailable && (…)}`. Tant que l'appairage servait de repli, masquer une voie non
    // armée était juste. Seul chemin restant, la même garde rendait un écran SANS AUCUN
    // geste dès que la sonde échouait — et elle échouait, `require-agent-auth` refusant
    // tout profil sans agence. La sonde AVERTIT désormais, elle n'efface plus.
    expect(code).not.toMatch(/\{otpAvailable && \(/)
    expect(code).toMatch(/otpAvailable === false/)
  })
})

describe('la copie ne renvoie plus vers un bouton qui n\'existe pas', () => {
  // Deux messages d'erreur disaient « utilisez Générer un code ci-dessous » et « utilisez
  // l'appairage ci-dessous ». Un message qui désigne une affordance absente est pire que
  // pas de message : il fait chercher.
  const LANGUES = ['fr', 'de', 'en', 'it'] as const
  const RENVOIS = [
    /Générer un code/i, /Generate a code/i, /Code generieren/i, /Genera un codice/i,
    /appairage/i, /pairing/i, /Verknüpfung/i, /collegamento/i,
  ]

  for (const langue of LANGUES) {
    it(`${langue} : aucun renvoi vers l'appairage dans les erreurs de la voie OTP`, () => {
      const bloc = JSON.parse(readFileSync(`src/i18n/locales/${langue}/settings.json`, 'utf8'))
      const otp = bloc.integrations.whatsapp.otp
      const textes = [...Object.values(otp.errors as Record<string, string>), otp.probeFailed]
      const coupables = textes.filter((s) => RENVOIS.some((r) => r.test(s)))
      expect(coupables).toEqual([])
    })

    it(`${langue} : l'indice de la fiche profil de BUREAU non plus`, () => {
      // ⚠ TROIS BLOCS DE COPIE POUR LE MÊME CHAMP, et j'en ai raté un à chaque passe.
      // `integrations.whatsapp.*` habille la carte, `profile.*` la fiche MOBILE, et
      // `focus.profile.*` la fiche de BUREAU. Corriger l'un ne corrige pas les autres :
      // le bureau a continué d'annoncer « Vérifié par appairage WhatsApp » une passe
      // entière après que l'appairage a disparu de l'écran voisin.
      const bloc = JSON.parse(readFileSync(`src/i18n/locales/${langue}/settings.json`, 'utf8'))
      const focus = bloc.focus.profile as Record<string, string>
      const textes = Object.entries(focus)
        .filter(([k]) => /whatsapp/i.test(k))
        .map(([, v]) => v)
      expect(textes.filter((s) => RENVOIS.some((r) => r.test(s)))).toEqual([])
    })

    it(`${langue} : la fiche profil MOBILE non plus`, () => {
      // ⛔ OUBLI RÉEL, trouvé après coup. La première passe n'avait nettoyé que le bloc
      // `integrations.whatsapp` — celui de la carte. La fiche profil, elle, vit sous
      // `profile.*` et continuait d'annoncer « Vérifié par appairage WhatsApp » et
      // « Appairez WhatsApp depuis le CRM sur ordinateur » : une consigne qui désigne un
      // bouton supprimé, sur l'écran même où l'agent vient chercher son numéro.
      const bloc = JSON.parse(readFileSync(`src/i18n/locales/${langue}/settings.json`, 'utf8'))
      const profil = bloc.profile as Record<string, string>
      const textes = Object.entries(profil)
        .filter(([k]) => /whatsapp/i.test(k))
        .map(([, v]) => v)
      expect(textes.filter((s) => RENVOIS.some((r) => r.test(s)))).toEqual([])
    })
  }
})
