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
