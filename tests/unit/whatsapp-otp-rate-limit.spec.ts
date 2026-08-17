// Le plafond d'envois de codes ne doit pas mourir avec la ligne qui le porte.
//
// ⛔ CE QUE CE FICHIER DÉFEND, ET POURQUOI IL EST STATIQUE. Le plafond de trois codes par
// heure vit dans `otp_sent_count` / `otp_window_started_at`, deux colonnes de la ligne
// `whatsapp_agent_links` de l'agent. Tant que `unlink_whatsapp_number()` SUPPRIMAIT cette
// ligne — et que le bouton « Annuler » de l'écran OTP l'appelait — la boucle tenait en
// quatre gestes d'interface : saisir le numéro d'un tiers, envoyer, annuler, recommencer.
// Envois illimités vers un numéro arbitraire, facturés sur le WABA partagé.
//
// La leçon dépasse ce cas : un compteur de débit ne doit pas vivre dans un objet que
// l'utilisateur limité peut détruire.
//
// ⚠ LA LIMITE DE CETTE GARDE EST ASSUMÉE. Elle lit du TEXTE SQL, elle n'exécute rien :
// elle ne prouve pas que le plafond fonctionne, seulement que les deux formes exactes qui
// l'ont cassé ne sont pas revenues. Le prouver demanderait une vraie session
// authentifiée — `auth.uid()` gouverne ces trois fonctions, et le banc backend exécute en
// `postgres`, pour qui `auth.uid()` est NULL : le test lèverait `not_authenticated` sans
// rien éprouver du plafond. Une garde qui dit ce qu'elle vérifie vaut mieux qu'un test
// vert qui n'assure rien.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'supabase/migrations'

/** Corps de la DERNIÈRE définition d'une fonction — c'est elle qui gouverne en base. */
function derniereDefinition(nomFonction: string): string {
  const fichiers = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()
  let corps = ''
  for (const f of fichiers) {
    const sql = readFileSync(join(DIR, f), 'utf8')
    const motif = new RegExp(
      `create\\s+or\\s+replace\\s+function\\s+public\\.${nomFonction}\\s*\\(`,
      'i',
    )
    const debut = sql.search(motif)
    if (debut < 0) continue
    // Jusqu'au `$$;` qui referme le corps.
    const fin = sql.indexOf('$$;', debut)
    corps = fin < 0 ? sql.slice(debut) : sql.slice(debut, fin + 3)
  }
  return corps
}

describe('plafond OTP — il survit à la déliaison', () => {
  it('unlink_whatsapp_number ne SUPPRIME plus la ligne', () => {
    const corps = derniereDefinition('unlink_whatsapp_number')
    expect(corps, 'unlink_whatsapp_number introuvable dans les migrations').not.toBe('')
    // La forme exacte du défaut : `DELETE FROM public.whatsapp_agent_links`.
    expect(
      /delete\s+from\s+public\.whatsapp_agent_links/i.test(corps),
      'unlink_whatsapp_number supprime la ligne — le compteur de débit part avec elle, ' +
        'et « envoyer / annuler / recommencer » redevient un envoi illimité',
    ).toBe(false)
  })

  it('aucune fonction de sortie ne remet le compteur ni sa fenêtre à zéro', () => {
    // `abort_…` a le droit de DÉCRÉMENTER (rien n'est parti, le jeton est rendu) ; ce qui
    // est proscrit est la remise à zéro ou à 1, qui rendrait le plafond gratuit.
    for (const nom of [
      'unlink_whatsapp_number',
      'cancel_whatsapp_number_verification',
      'abort_whatsapp_number_verification',
    ]) {
      const corps = derniereDefinition(nom)
      expect(corps, `${nom} introuvable`).not.toBe('')
      expect(
        /otp_sent_count\s*=\s*[01]\b/i.test(corps),
        `${nom} réécrit otp_sent_count à une constante — le plafond horaire devient gratuit`,
      ).toBe(false)
      expect(
        /otp_window_started_at\s*=\s*(null|now\(\))/i.test(corps),
        `${nom} réarme la fenêtre horaire — même effet qu'une remise à zéro du compteur`,
      ).toBe(false)
    }
  })

  it("le bouton « Annuler » de l'écran OTP n'appelle pas la déliaison", () => {
    const carte = readFileSync('src/components/crm/settings/WhatsAppPairingCard.tsx', 'utf8')
    // On isole le bloc de l'état OTP : du test `if (otpEnCours)` jusqu'à la fin de sa
    // branche (l'état suivant commence au commentaire « unlinked »).
    const debut = carte.indexOf('if (otpEnCours)')
    const fin = carte.indexOf('// — unlinked (défaut) —')
    expect(debut, 'état OTP introuvable dans la carte').toBeGreaterThan(-1)
    expect(fin, 'état unlinked introuvable dans la carte').toBeGreaterThan(debut)
    const bloc = carte.slice(debut, fin)
    expect(
      /unlink\.mutate\(\)/.test(bloc),
      "l'écran OTP appelle unlink.mutate() — c'est précisément le câblage qui offrait des " +
        'envois illimités. Utiliser cancelVerification, qui préserve le compteur.',
    ).toBe(false)
    expect(bloc).toContain('cancelVerification.mutate()')
  })
})

// ── Propriété voisine, même famille de régression ───────────────────────────
//
// ⛔ `profiles.phone` appartient au trigger de vérification WhatsApp depuis le
// 17.08.2026, et l'écran de Profil n'a plus de champ pour le saisir. Or `save()` le
// réécrivait à CHAQUE enregistrement de n'importe quel champ, depuis un instantané client
// que rien n'invalide : vérifier son numéro, revenir sur Profil dans la minute, corriger
// sa « Fonction » suffisait à le remettre à NULL. Le correctif tient en DEUX LIGNES
// SUPPRIMÉES — exactement le genre de chose qu'une PR ultérieure remet sans y penser,
// pour une conséquence (perte silencieuse du numéro sur les trois surfaces clientes, sans
// aucun écran pour la voir ni la réparer) hors de proportion avec la taille du diff.
describe('profiles.phone — le formulaire de Profil ne le réécrit plus', () => {
  const SRC = readFileSync('src/hooks/useAgentProfileScreen.ts', 'utf8')

  /** Le seul objet passé à `.update()` sur la table `profiles`. */
  function payloadProfiles(): string {
    const ancre = SRC.indexOf(".from('profiles')")
    expect(ancre, "l'update de `profiles` est introuvable").toBeGreaterThan(-1)
    const debut = SRC.indexOf('.update({', ancre)
    expect(debut, '`.update({` introuvable après `.from(\'profiles\')`').toBeGreaterThan(-1)
    const fin = SRC.indexOf('})', debut)
    return SRC.slice(debut, fin)
  }

  it("n'écrit ni phone ni mobile_phone", () => {
    const payload = payloadProfiles()
    // Bornés au début de propriété : un commentaire qui NOMME `phone` (il y en a un long,
    // et c'est lui qui explique pourquoi la ligne est partie) ne doit pas faire rougir.
    expect(
      /^\s*phone:/m.test(payload),
      '`save()` réécrit `profiles.phone` — la colonne appartient au trigger de vérification, ' +
        'et le formulaire la remettrait à NULL depuis un cache périmé',
    ).toBe(false)
    expect(
      /^\s*mobile_phone:/m.test(payload),
      '`save()` réécrit `profiles.mobile_phone` alors qu\'aucune UI ne le règle plus : ' +
        "l'écrire ne peut plus rien faire d'autre que l'effacer",
    ).toBe(false)
    // Contre-preuve de non-vacuité : le payload doit rester celui qu'on croit lire.
    expect(payload).toContain('full_name')
  })
})

// ── Plafonds de PLATEFORME ──────────────────────────────────────────────────
//
// ⛔ Le plafond horaire par agent ne borne QUE l'agent : il se multiplie par le nombre de
// comptes, et ne protège pas du tout la personne qu'on cible en boucle. Trois plafonds ont
// été ajoutés le 17.08.2026 (20260817163814), et ce qui compte ici n'est pas leur valeur
// — elle se règle en base — mais l'endroit où vit leur COMPTEUR.
//
// ⚠ Deux socles ont été explicitement ÉCARTÉS, et cette garde interdit d'y revenir :
//   · `whatsapp_agent_links` — l'agent la fait disparaître par déliaison. C'est le défaut
//     déjà corrigé plus haut dans ce fichier ;
//   · `whatsapp_messages` — persistance BEST-EFFORT (le guard rend `ok` même si l'insert
//     échoue) et marqueur de template en CHAÎNE dans `body`. Un plafond adossé à un format
//     de chaîne tombe silencieusement à zéro le jour où ce format change.
describe('plafonds de plateforme — le compteur est hors de portée du client', () => {
  const MIGRATION = 'supabase/migrations/20260817163814_whatsapp_verification_platform_caps.sql'
  const sql = readFileSync(MIGRATION, 'utf8')

  it('le registre ne donne AUCUN droit à anon ni authenticated', () => {
    expect(sql).toMatch(/REVOKE ALL ON public\.whatsapp_verification_sends FROM anon, authenticated/i)
    // RLS active SANS policy : le verrou est l'absence de porte, pas une porte étroite.
    expect(sql).toMatch(/ALTER TABLE public\.whatsapp_verification_sends ENABLE ROW LEVEL SECURITY/i)
    expect(
      /CREATE POLICY[^;]*whatsapp_verification_sends/i.test(sql),
      'une policy sur le registre rouvrirait au client la table qui le borne',
    ).toBe(false)
  })

  it('ne compte PAS dans whatsapp_messages', () => {
    const start = sql.slice(sql.indexOf('FUNCTION public.start_whatsapp_number_verification'))
    expect(
      /whatsapp_messages/i.test(start),
      'le plafond lit whatsapp_messages — persistance best-effort et marqueur en chaîne : ' +
        'il tomberait silencieusement à zéro',
    ).toBe(false)
  })

  it('les plafonds ont un repli CONSERVATEUR quand la config manque', () => {
    // Une clé absente, illisible ou mal formée ne doit pas rendre le chemin illimité.
    expect(sql).toMatch(/coalesce\(\(v_caps->>'platform_daily'\)::int,\s*50\)/)
    expect(sql).toMatch(/coalesce\(\(v_caps->>'distinct_numbers_per_agent_daily'\)::int,\s*3\)/)
    expect(sql).toMatch(/coalesce\(\(v_caps->>'per_number_daily'\)::int,\s*2\)/)
    // Et un JSON invalide ne doit pas faire ÉCHOUER le parcours : il doit fermer.
    expect(sql).toMatch(/EXCEPTION WHEN others THEN\s+v_caps := NULL/)
  })

  it("l'abandon rembourse le registre, pas seulement le compteur horaire", () => {
    const abort = sql.slice(sql.indexOf('FUNCTION public.abort_whatsapp_number_verification'))
    expect(abort).toMatch(/DELETE FROM public\.whatsapp_verification_sends/i)
  })
})
