// Unitaire — composition du courriel de décision KYB (étape 7, tâche 6).
//
// Le module testé est PUR (aucun import, aucun Deno.env.get, aucun fetch), donc importable
// tel quel depuis vitest — même discipline que _shared/kyb-sources.ts, et pour la même
// raison : les libellés, les destinataires et l'échappement se vérifient sans pile Deno ni
// clé Resend.
//
// CE QUI EST EN JEU. Avant cette tâche, ni une validation ni un rejet n'émettait quoi que ce
// soit. Le cas qui compte le plus est la CORRECTION : son motif est obligatoire côté RPC
// précisément pour être actionnable, et il ne l'est que s'il atteint le dirigeant. Sans ce
// courriel, il resoumettait à l'identique.

import { describe, it, expect } from 'vitest'
import {
  isNotifiableStatus,
  noticeRecipients,
  buildVerificationNotice,
  NOTIFIABLE_STATUSES,
} from '../../supabase/functions/_shared/agency-verification-notice'

describe('isNotifiableStatus — liste blanche, jamais liste noire', () => {
  it('les quatre décisions sont notifiables', () => {
    for (const s of NOTIFIABLE_STATUSES) expect(isNotifiableStatus(s)).toBe(true)
  })

  it('manual_review est notifiable : c\'est un accusé de réception, pas un verdict', () => {
    // Le dirigeant qui soumet ne recevait RIEN — ni à la soumission, ni au passage en revue.
    // Or une agence suisse finit toujours là (le véto id_document exige un humain), donc
    // « état d'attente » décrivait en réalité l'issue NORMALE du parcours, pas un cas de bord.
    expect(isNotifiableStatus('manual_review')).toBe(true)
  })

  it('pending reste muet : c\'est l\'instant entre la soumission et le premier passage du moteur', () => {
    // Quelques centaines de ms en usage normal. Notifier ici enverrait deux courriels
    // pour une seule soumission.
    expect(isNotifiableStatus('pending')).toBe(false)
  })

  it('un statut futur ou absent ne déclenche rien tant que personne n\'a écrit quoi en dire', () => {
    expect(isNotifiableStatus('quelque_chose_de_neuf')).toBe(false)
    expect(isNotifiableStatus(null)).toBe(false)
    expect(isNotifiableStatus(undefined)).toBe(false)
    expect(isNotifiableStatus('')).toBe(false)
  })
})

describe('noticeRecipients — les dirigeants, jamais toute l\'équipe', () => {
  it('retient admin et manager', () => {
    expect(noticeRecipients([
      { email: 'chef@agence.ch', role: 'admin' },
      { email: 'gerant@agence.ch', role: 'manager' },
      { email: 'agent@agence.ch', role: 'agent' },
    ], null)).toEqual(['chef@agence.ch', 'gerant@agence.ch'])
  })

  it('écarte agent et assistant — le motif porte des données de conformité', () => {
    expect(noticeRecipients([
      { email: 'agent@agence.ch', role: 'agent' },
      { email: 'assistant@agence.ch', role: 'assistant' },
    ], null)).toEqual([])
  })

  it('dédoublonne et normalise la casse', () => {
    expect(noticeRecipients([
      { email: 'Chef@Agence.ch', role: 'admin' },
      { email: 'chef@agence.ch', role: 'manager' },
    ], null)).toEqual(['chef@agence.ch'])
  })

  it('se replie sur l\'adresse de l\'agence quand aucun dirigeant n\'est joignable', () => {
    // Cas réel : invitation en attente, compte supprimé. La décision ne doit pas disparaître
    // en silence faute de destinataire.
    expect(noticeRecipients([{ email: 'agent@agence.ch', role: 'agent' }], 'contact@agence.ch'))
      .toEqual(['contact@agence.ch'])
  })

  it('ne se replie PAS quand un dirigeant existe — l\'adresse générique n\'est pas un doublon', () => {
    expect(noticeRecipients([{ email: 'chef@agence.ch', role: 'admin' }], 'contact@agence.ch'))
      .toEqual(['chef@agence.ch'])
  })

  it('écarte les adresses vides ou malformées plutôt que de les envoyer à Resend', () => {
    expect(noticeRecipients([
      { email: null, role: 'admin' },
      { email: '   ', role: 'admin' },
      { email: 'pas-une-adresse', role: 'admin' },
    ], null)).toEqual([])
  })

  it('rend un tableau vide, jamais une erreur, quand rien n\'est joignable', () => {
    expect(noticeRecipients([], null)).toEqual([])
  })
})

describe('buildVerificationNotice', () => {
  const base = { agencyName: 'Regie Test SA', appUrl: 'https://app.megga.ch' }

  it('une validation annonce ce que l\'agence peut désormais faire', () => {
    const n = buildVerificationNotice({ ...base, status: 'validated', reason: null })
    expect(n.subject).toMatch(/verifiee/i)
    expect(n.html).toContain('Regie Test SA')
    expect(n.html).toMatch(/KYC/)
  })

  it('auto_validated dit la même chose qu\'une validation humaine — côté agence, l\'effet est le même', () => {
    const human = buildVerificationNotice({ ...base, status: 'validated', reason: null })
    const engine = buildVerificationNotice({ ...base, status: 'auto_validated', reason: null })
    expect(engine.subject).toBe(human.subject)
  })

  it('une correction porte son MOTIF et un lien vers le formulaire', () => {
    const n = buildVerificationNotice({
      ...base, status: 'correction_requested', reason: 'Le numero de registre a un chiffre de trop',
    })
    expect(n.html, 'sans le motif, le dirigeant resoumettrait a l\'identique')
      .toContain('Le numero de registre a un chiffre de trop')
    expect(n.html).toContain('https://app.megga.ch/dashboard/identite')
  })

  it('un rejet porte son motif mais AUCUN lien vers le formulaire', () => {
    const n = buildVerificationNotice({ ...base, status: 'rejected', reason: 'Documents falsifies' })
    expect(n.html).toContain('Documents falsifies')
    expect(
      n.html,
      'rejected est terminal : proposer de reprendre le formulaire promettrait une reprise qui n\'existe pas',
    ).not.toContain('/dashboard/identite')
  })

  it('une validation n\'affiche AUCUN bloc motif, même si un motif traîne', () => {
    // Défensif : l'edge function lit le dernier motif dans activity_events, et un dossier
    // validé après un rejet en porte un. L'afficher dirait quelque chose de faux.
    const n = buildVerificationNotice({ ...base, status: 'validated', reason: 'motif d une decision anterieure' })
    expect(n.html).not.toContain('motif d une decision anterieure')
    expect(n.html).not.toContain('Motif')
  })

  it('un motif vide ou blanc n\'affiche pas de bloc vide', () => {
    for (const reason of [null, '', '   ']) {
      const n = buildVerificationNotice({ ...base, status: 'correction_requested', reason })
      expect(n.html).not.toContain('>Motif<')
    }
  })

  it('échappe le motif — c\'est un texte libre saisi par un relecteur, rendu dans du HTML', () => {
    const n = buildVerificationNotice({
      ...base,
      status: 'correction_requested',
      reason: '<script>alert("x")</script> & <b>gras</b>',
    })
    expect(n.html).not.toContain('<script>')
    expect(n.html).toContain('&lt;script&gt;')
    expect(n.html).toContain('&amp;')
  })

  it('échappe aussi le nom de l\'agence — il vient de la saisie du dirigeant', () => {
    const n = buildVerificationNotice({
      ...base, agencyName: 'Regie <img src=x onerror=alert(1)> SA', status: 'validated', reason: null,
    })
    expect(n.html).not.toContain('<img')
    expect(n.html).toContain('&lt;img')
  })
})

describe('buildVerificationNotice — accusé de réception de mise en revue', () => {
  const base = { agencyName: 'Agence Test SA', reason: null, appUrl: 'https://app.megga.ch' }

  it('annonce un examen en cours, jamais une décision', () => {
    const { subject, html } = buildVerificationNotice({ ...base, status: 'manual_review' })
    expect(subject).toBe("Verification d'identite : dossier recu")
    expect(html).toContain('en cours d&#39;examen')
    expect(html).toContain('Agence Test SA')
  })

  it('ne promet aucun délai — on ne tient pas ce qu\'on ne mesure pas', () => {
    const { html } = buildVerificationNotice({ ...base, status: 'manual_review' })
    expect(html).not.toMatch(/\d+\s*(heures?|jours?|ouvrés?)/i)
  })

  it('n\'affiche ni bloc Motif ni bouton : il n\'y a rien à corriger et rien à reprendre', () => {
    const { html } = buildVerificationNotice({
      ...base, status: 'manual_review', reason: 'un motif qui traine d\'une decision anterieure',
    })
    expect(html).not.toContain('Motif')
    expect(html).not.toContain('Reprendre le formulaire')
    expect(html).not.toContain('un motif qui traine')
  })

  it('le pied de page ne parle pas de décision pour un dossier simplement reçu', () => {
    const recu = buildVerificationNotice({ ...base, status: 'manual_review' })
    const decide = buildVerificationNotice({ ...base, status: 'validated' })
    expect(recu.html).not.toContain('une decision a ete prise')
    expect(decide.html).toContain('une decision a ete prise')
  })
})
