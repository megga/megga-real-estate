import { describe, it, expect } from 'vitest'
import { detectPhantomAction, phantomNextStep, PHANTOM_RETRY_NUDGE } from './whatsapp-phantom-action'
import {
  t, consigne, confirmConsigner, consignationDeja, consignationChangee, consignationNonConfirmee,
  consignationImpossible, consignationEchec, consignerMotifManquant, consignerQuelleReponse, consignerQuelAcheteur,
  consignerAucunBien, consignerPlusieursBiens, consignerTropDeBiens, consignerTropLarge, consignerEchoTropLarge,
  consignerAnnonceRetiree,
} from './whatsapp-i18n'

// L'incident du 10.09.2026, 19:38:52 UTC, mot pour mot : réponse finale de DeepSeek SANS aucun
// appel d'outil. Rien n'était préparé ; un « oui » de l'agent serait reparti au cerveau.
const INCIDENT = "C'est noté, je lance la suppression de *Test Boutous*.\n\nConfirme quand tu veux, c'est définitif."

describe('detectPhantomAction — confirmation simulée ou action annoncée sans outil', () => {
  it('reconnaît l’incident réel', () => {
    expect(detectPhantomAction(INCIDENT)).not.toBeNull()
  })

  it('demande de confirmation d’une action (FR)', () => {
    for (const s of [
      'Je vais supprimer la fiche de Dubois. Tu confirmes ?',
      'Confirme et je retire l’annonce des portails.',
      'Réponds « oui » pour que je publie le bien sur les portails.',
      'Je le supprime dès que tu confirmes.',
      'Tu confirmes la suppression de la fiche de Martin ?',
      'Valide l’envoi et c’est parti.',
      'Tu confirmes que tu veux supprimer la fiche de Dubois ? C’est définitif.',
      'Merci de confirmer la suppression de la fiche de Dubois.',
      'Suppression de la fiche de Dubois : confirme-moi et je lance.',
      'J’envoie le mail à Dubois dès que tu me dis go.',
      'Envoi du lien KYC à Dubois : je le lance dès ton ok.',
      'Je supprime Dubois ? Oui / non',
      // Le gras WhatsApp entoure le verbe.
      'Je prépare la suppression de Dubois.\n*Confirme* quand tu veux.',
      'Est-ce que tu confirmes la suppression de la fiche de Dubois ?',
      'Confirmes-tu la suppression de la fiche de Dubois ?',
      'Je supprime la fiche de Dubois, tu confirmes bien ?',
      'La suppression de la fiche de Dubois est prête, il ne te reste qu’à confirmer.',
      'J’attends ta confirmation pour supprimer la fiche de Dubois.',
    ]) expect(detectPhantomAction(s), s).toBe('confirm_request')
  })

  it('action annoncée ou revendiquée (FR)', () => {
    for (const s of [
      'C’est noté, je supprime la fiche de Dubois.',
      'J’envoie le message à Dubois tout de suite.',
      'Je lance l’envoi de la sélection.',
      'J’ai supprimé la fiche de Dubois.',
      'Je m’apprête à retirer l’annonce.',
      'Je viens de supprimer la fiche de Dubois.',
      'Je m’occupe de la suppression de la fiche de Dubois.',
      'Ok, je l’envoie.',
      'J’efface la fiche de Dubois.',
      'Je lui envoie le message tout de suite.',
      'Je transmets la sélection à Dubois.',
      'J’ai envoyé à Dubois la sélection de 5 biens.',
      'J’ai retiré l’annonce de Carouge des portails.',
      'Je retire Jean Martin du CRM.',
    ]) expect(detectPhantomAction(s), s).toBe('action_claim')
  })

  it('les mêmes motifs en anglais', () => {
    expect(detectPhantomAction('Got it, I’m deleting Dubois’s record. Confirm when you’re ready.')).not.toBeNull()
    expect(detectPhantomAction('*Confirm* when you’re ready and I’ll delete Dubois.')).toBe('confirm_request')
    expect(detectPhantomAction('Reply yes and I’ll send the message to Dubois.')).toBe('confirm_request')
    expect(detectPhantomAction('Should I go ahead and publish it? Confirm?')).toBe('confirm_request')
    expect(detectPhantomAction('Please confirm the deletion of Dubois’s record.')).toBe('confirm_request')
    expect(detectPhantomAction('Can you confirm you want me to delete Dubois?')).toBe('confirm_request')
    expect(detectPhantomAction('Waiting for your confirmation to delete Dubois’s record.')).toBe('confirm_request')
    expect(detectPhantomAction('I’ll delete the contact now.')).toBe('action_claim')
    expect(detectPhantomAction('I have deleted the record.')).toBe('action_claim')
    expect(detectPhantomAction('I’ve sent the message to Dubois.')).toBe('action_claim')
    expect(detectPhantomAction('I’m going to delete Dubois’s record.')).toBe('action_claim')
  })

  it('un mot du passé n’excuse ni une annonce du tour, ni le passé d’une AUTRE phrase', () => {
    for (const s of [
      'C’est noté, je lance la suppression de la fiche de Dubois, créée hier.',
      'Dubois a déjà une autre fiche : je supprime celle-ci.',
      'J’envoie le message à Dubois, je l’ai déjà préparé.',
      'You already have his email. I’ll delete the duplicate record now.',
      'Dubois a signé hier. J’ai supprimé sa fiche en double.',
    ]) expect(detectPhantomAction(s), s).toBe('action_claim')
  })

  it('une annonce sans ponctuation, isolée par un retour à la ligne, reste une annonce', () => {
    expect(detectPhantomAction('C’est noté\nJe supprime la fiche de Dubois\nTu veux autre chose ?')).toBe('action_claim')
  })

  // La mémoire de conversation montre au copilote les questions et les comptes rendus du SYSTÈME :
  // il peut les imiter mot pour mot, sans qu'aucune action ne soit préparée ni faite.
  it('recopie une question de confirmation du système', () => {
    for (const s of [
      'Voici ce que je propose d’envoyer à Pierre :\n\nBonjour Pierre, voici 3 biens…\n\nJ’envoie ? (« oui » / « non »)',
      'Je vais effectuer cette action. Tu confirmes ? (« oui » / « non »)',
      'J’envoie à Marie le lien sécurisé pour déposer ses pièces KYC par email (marie@example.ch) ? C’est facultatif. (« oui » / « non »)',
      'I’ll record an offer of CHF 850’000 from Dubois (buyer) on the deal "Carouge". Confirm? ("yes" / "no")',
      t('fr', 'templateOffer'),
      t('en', 'templateOffer'),
    ]) expect(detectPhantomAction(s), s).toBe('confirm_request')
  })

  it('recopie un compte rendu que seul l’exécuteur écrit, après le « oui »', () => {
    for (const s of [
      t('fr', 'clientMsgSent'), t('en', 'clientMsgSent'),
      // L'envoi de biens au client est retiré (21.09.2026) : son compte rendu n'a plus de clé,
      // mais le cerveau peut encore l'inventer, et c'est alors une fausse annonce certaine.
      '✅ Sélection envoyée au client.', '✅ Selection sent to the client.',
      t('fr', 'templateSent'), t('en', 'templateSent'),
      '✅️ Message envoyé au client.', // avec le sélecteur de variante emoji
    ]) expect(detectPhantomAction(s), s).toBe('action_claim')
  })

  it('un brouillon suivi de « Tu confirmes ? » demande bien de confirmer un envoi', () => {
    expect(detectPhantomAction('Voici le brouillon pour Mme Rossi :\n\nBonjour Madame, je vous envoie la sélection.\n\nTu confirmes ?'))
      .toBe('confirm_request')
  })

  // Les FAUX POSITIFS coûtent une relance, puis au pire la réponse honnête à la place d'une réponse
  // légitime : chacun de ces cas est une réponse normale du copilote, qui doit PASSER.
  it('laisse passer une demande d’information', () => {
    for (const s of [
      'Confirme-moi l’adresse du bien, s’il te plaît.',
      'C’est bien Dubois, de Genève ? Tu confirmes ?',
      'Tu confirmes que c’est bien à la fiche de Dubois que le message doit partir ?',
      'C’est bien la fiche de Jean Dubois que tu veux supprimer ? Confirme-moi le prénom.',
      'Pour l’offre, confirme-moi le montant : 850’000 ou 870’000 ?',
      'Tu veux la version confidentielle ou publique ? Confirme.',
      'Est-ce que tu confirmes que c’est bien la fiche de Dubois qu’il faut supprimer ?',
      'Il ne te reste qu’à confirmer la visite avec Dubois.',
      'Could you confirm the visit date?',
      // Relevé le 10.09.2026 à 19:47:43 UTC : question de clarification, pas une action simulée.
      'Il n’y a qu’une seule fiche « Test Boutons » à présent, c’est celle que je viens de recréer. '
        + 'Tu confirmes que c’est bien à celle-là que le message doit partir ? Si oui, donne-moi le texte '
        + 'du message de bienvenue (ou dis-moi de le rédiger), et je l’envoie.',
    ]) expect(detectPhantomAction(s), s).toBeNull()
  })

  it('laisse passer une offre ou une question, qui n’annonce rien', () => {
    for (const s of [
      'Tu veux que je supprime la fiche de Dubois ?',
      'Tu veux que j’envoie le message à Dubois ?',
      'Veux-tu que j’envoie la sélection à Dubois ?',
      'Tu veux que je lance la suppression de la fiche ?',
      'Il y a deux fiches « Test Boutons ». Laquelle je supprime ?',
      'Laquelle je supprime, celle de M. Dubois ?',
      'Voici l’annonce publique. Je la publie sur immobilier.ch ?',
      'Voici le brouillon pour Dubois : « Bonjour… ». Tu veux que je l’envoie ?',
      'Voici le brouillon pour Dubois. Tu me confirmes que je l’envoie ?',
      'Je peux publier le bien sur les portails si tu veux.',
      'Si tu veux, je supprime la fiche.',
      'Si oui, donne-moi le texte et je l’envoie.',
      'Dès que tu me donnes le texte, je l’envoie à Dubois.',
      'Do you want me to delete the record?',
      'Shall I send it?',
      'If you want, I’ll send the message to Dubois.',
      'Let me know and I’ll send the draft to Dubois.',
    ]) expect(detectPhantomAction(s), s).toBeNull()
  })

  it('laisse passer un constat où « confirme » n’est pas une demande à l’agent', () => {
    for (const s of [
      'Je te confirme : le message a bien été envoyé à Dubois.',
      'Je confirme, la fiche de Dubois a bien été supprimée.',
      'C’est confirmé, le lien KYC est parti chez Dubois.',
      'Dubois confirme : il retire son offre.',
      'L’acheteur veut que tu confirmes l’offre avant vendredi.',
      'I can confirm: the message was sent to Dubois.',
      'Confirmed, the selection went out to Dubois.',
    ]) expect(detectPhantomAction(s), s).toBeNull()
  })

  it('laisse passer la retouche d’un brouillon', () => {
    for (const s of [
      'C’est corrigé, j’ai supprimé la mention du prix : « Bonjour Monsieur Dubois, … »',
      'J’ai retiré l’adresse exacte de la version confidentielle, voici le texte :',
      'J’ai supprimé la dernière phrase du brouillon, voici la nouvelle version :',
      'Je supprime la formule de politesse et je raccourcis : « … »',
      'Je retire ma question : j’ai trouvé la fiche.',
      'I’ve removed the price from the draft: "Hello Mr Dubois…"',
      'I’ll remove the exact address from the confidential version:',
    ]) expect(detectPhantomAction(s), s).toBeNull()
  })

  it('laisse passer ce qui n’est pas la voix de MEGGA : une citation, un texte au vouvoiement', () => {
    for (const s of [
      'Voici le brouillon pour Mme Rossi :\n\n« Bonjour Madame, comme convenu je retire l’annonce des portails dès demain et je vous envoie le compromis. »\n\nTu veux que je l’envoie ?',
      'Lettre de M. Dubois (lue, à vérifier) : « Par la présente, je retire mon offre du 3 septembre sur l’annonce de Carouge. »',
      'Dans le groupe, Marie écrit : « Je supprime la visite de jeudi, confirme-moi la nouvelle date. » Aucune fuite détectée.',
      'Here’s the draft for Mrs Rossi: "Hello, as agreed I’ll withdraw the listing from the portals tomorrow." Want me to send it?',
      // Sans guillemets : le vouvoiement suffit, le copilote tutoie l'agent (megga-prose.ts).
      'Voici le brouillon pour Mme Rossi :\n\nBonjour Madame, j’ai bien publié votre bien sur immobilier.ch.\n\nTu veux que je l’envoie ?',
    ]) expect(detectPhantomAction(s), s).toBeNull()
  })

  it('laisse passer le compte rendu d’une action réellement faite ou passée', () => {
    for (const s of [
      'Contact *Test Boutons* créé.',
      'C’est fait, rappel créé pour demain 9h.',
      // update_pipeline passé en auto : réellement exécuté dans ce tour, annulable.
      'J’ai retiré le dossier de Dubois du pipeline actif (Perdu). /annuler dans les 60 s.',
      'J’ai retiré Dubois du pipeline actif, sa fiche reste dans le CRM.',
      'I’ve removed Dubois from the active pipeline.',
      'C’est fait — Dubois passé en Offre. Tape /annuler dans les 60 s pour revenir en arrière.',
      'Le message a été envoyé hier à Dubois.',
      'Sa fiche a été supprimée tout à l’heure.',
      'Oui, j’ai bien envoyé la sélection à Dubois ce matin.',
      'Dubois a retiré son offre hier.',
      'The report was sent yesterday.',
      'I have published the listing on immobilier.ch this morning, it’s live.',
    ]) expect(detectPhantomAction(s), s).toBeNull()
  })

  it('laisse passer ce que MEGGA envoie à l’AGENT lui-même', () => {
    for (const s of [
      'Je t’envoie la liste des visites de demain :',
      'Je te l’envoie ici :',
      'Je te renvoie le brouillon corrigé :',
      'I’ll send you the list.',
    ]) expect(detectPhantomAction(s), s).toBeNull()
  })

  it('rien pour une réponse vide ou absente', () => {
    expect(detectPhantomAction('')).toBeNull()
    expect(detectPhantomAction(null)).toBeNull()
    expect(detectPhantomAction(undefined)).toBeNull()
  })

  // Les deux écarts CONNUS, épinglés pour qu'une évolution de la garde les voie bouger.
  it('LIMITE — une revendication passive ou sans verbe passe encore', () => {
    // Même forme qu'un compte rendu légitime (« le message a été envoyé à 14h12 ») : rien dans la
    // phrase ne les sépare.
    for (const s of [
      'C’est fait, la fiche de Dubois est supprimée.',
      'Fiche de Dubois supprimée.',
      'Message sent to Dubois.',
    ]) expect(detectPhantomAction(s), s).toBeNull()
  })

  it('FAUX POSITIF ASSUMÉ — « oui, j’ai supprimé… » sans marqueur de temps', () => {
    // Réponse à « tu l'as supprimée ? »… mais aussi, mot pour mot, la simulation qui suit une offre et
    // un « oui » nu. Dans le doute, une relance : la consigne laisse répondre d'après l'historique.
    expect(detectPhantomAction('Oui, j’ai supprimé la fiche de Dubois, comme tu me l’avais demandé.')).toBe('action_claim')
  })
})

describe('phantomNextStep — une relance, puis la vérité', () => {
  it('une réponse saine passe', () => {
    expect(phantomNextStep('Contact créé.', true)).toBe('pass')
    expect(phantomNextStep('Contact créé.', false)).toBe('pass')
  })

  it('première simulation, relance possible : relance', () => {
    expect(phantomNextStep(INCIDENT, true)).toBe('retry')
  })

  it('relance déjà faite, ou dernier tour : la réponse honnête, jamais la fausse', () => {
    expect(phantomNextStep(INCIDENT, false)).toBe('fallback')
  })
})

describe('textes', () => {
  it('la consigne de relance exige l’appel d’outil, sans le doubler ni refaire confirmer à la main', () => {
    expect(PHANTOM_RETRY_NUDGE).toMatch(/appelle/i)
    expect(PHANTOM_RETRY_NUDGE).toMatch(/search_contacts/)
    expect(PHANTOM_RETRY_NUDGE).toMatch(/confirm/i)
    expect(PHANTOM_RETRY_NUDGE).toMatch(/déjà abouti/)
    expect(PHANTOM_RETRY_NUDGE).toMatch(/historique/)
  })

  it('la réponse honnête dit que l’action n’est ni faite ni en attente, et n’est pas elle-même détectée', () => {
    expect(t('fr', 'phantomAction')).not.toBe(t('en', 'phantomAction'))
    expect(t('fr', 'phantomAction')).toMatch(/ni faite, ni en attente/)
    expect(t('en', 'phantomAction')).toMatch(/neither done nor waiting/)
    expect(detectPhantomAction(t('fr', 'phantomAction'))).toBeNull()
    expect(detectPhantomAction(t('en', 'phantomAction'))).toBeNull()
  })
})

describe('lot D2 — consigner la réponse d’un acheteur passe par l’outil', () => {
  it('une consignation simulée est détectée (FR, EN)', () => {
    for (const s of [
      'Je consigne : Julie pas intéressée par Florissant, motif prix. Tu confirmes ?',
      'C’est noté, je consigne le refus de Julie.',
      '✅ Consigné pour Julie Martin : « Attique 4 p. » — intéressé·e.',
      "J'ai consigné le refus de Julie pour Florissant.",
      "I'll record that Julie is not interested. Confirm?",
      '✅ Recorded for Julie Martin: « Attique » — interested.',
      "I've recorded her answer.",
    ]) expect(detectPhantomAction(s), s).not.toBeNull()
  })

  // Isole le mot d'action `consign` : « consignation » ne forme ni « je consigne », ni « j'ai
  // consigné », ni un écho `✅` — seule sa présence dans ACTION_WORD, combinée à une demande de
  // confirmation, doit faire détecter ce cas.
  it('une forme nominale de « consigner » compte aussi comme mot d’action', () => {
    expect(detectPhantomAction('La consignation de l’intérêt de Julie est prête. Tu confirmes ?')).toBe('confirm_request')
    expect(detectPhantomAction('Julie : pas intéressée, à consigner. Confirme quand tu veux.')).toBe('confirm_request')
    expect(detectPhantomAction('Recording her answer as interested — confirm?')).toBe('confirm_request')
  })

  // Lot D2 : normalize() retire l'accent — « consigné » (participe masculin, 8 lettres) devient l'exact
  // « consigne » que la négation `(?!es?\b)` écarte comme nom, et il ne suit pas « je » non plus (« sera
  // consigné », pas « je consigné »). Lu sur le texte BRUT (accent intact), où il se distingue du nom.
  it('le participe masculin « consigné(s) » (accent intact) reste un mot d’action', () => {
    for (const s of [
      'Son refus sera consigné. Tu confirmes ?',
      'Consigné pour Julie Martin : « Attique » — intéressée. Tu confirmes ?',
      'Les deux refus de Julie seront consignés. Tu confirmes ?',
      "Son intérêt pour l'Attique sera consigné. Confirme quand tu veux.",
    ]) expect(detectPhantomAction(s), s).toBe('confirm_request')
  })

  // Contrepartie acceptée : le même mécanisme (mot d'action n'importe où + « Tu confirmes ? » nu, ailleurs dans
  // le texte) reprend aussi ces deux constats sans rapport avec une consignation en cours — un défaut déjà
  // documenté de la garde (elle ne relie pas la phrase qui porte le mot d'action à celle qui demande l'accord).
  it('CONTREPARTIE — un participe/nom déjà associé ailleurs redevient pris avec lui', () => {
    expect(detectPhantomAction('Julie Martin a déjà un intérêt consigné pour l’Attique. C’est bien d’elle ? Tu confirmes ?')).not.toBeNull()
    expect(detectPhantomAction('L’acompte de CHF 50’000 est consigné chez le notaire. C’est bien le dossier Dubois ? Tu confirmes ?')).not.toBeNull()
  })

  it('une offre, une question, ou un fait passé nommé comme tel, passe', () => {
    for (const s of [
      'Tu veux que je consigne son refus ?',
      'Si tu veux, je consigne le refus de Julie.',
      "J'ai consigné son refus hier pour Florissant.",
      'Want me to record her answer?',
    ]) expect(detectPhantomAction(s), s).toBeNull()
  })

  it('les comptes rendus de l’exécuteur sont ceux que la garde reconnaît', () => {
    expect(detectPhantomAction(consigne('fr', { reponse: 'interesse', nom: 'Julie Martin', bien: 'Attique' }))).toBe('action_claim')
    expect(detectPhantomAction(consigne('en', { reponse: 'pas_encore', nom: 'Julie Martin', bien: 'Attique' }))).toBe('action_claim')
  })

  // Les quatre réponses possibles, dans les deux langues : `consigne()` change de gabarit selon
  // `reponse` (« proposé », « intéressé·e », « pas intéressé·e », « n'a pas encore répondu »), et
  // chacun doit rester reconnu comme écho de l'exécuteur — pas seulement les deux cas du texte.
  it('les quatre réponses de record_match_outcome sont toutes reconnues, dans les deux langues', () => {
    const base = { nom: 'Julie Martin', bien: 'Attique 4 p. · Florissant 12, Genève', motif: 'prix' } as const
    for (const lang of ['fr', 'en'] as const) {
      for (const reponse of ['propose', 'interesse', 'pas_interesse', 'pas_encore'] as const) {
        expect(detectPhantomAction(consigne(lang, { ...base, reponse })), `${lang}/${reponse}`).toBe('action_claim')
      }
    }
  })

  // `record` (lot D2) ne prend que le VERBE — le NOM « record » (la fiche, whatsapp-i18n.ts ~l.125/189/229/
  // 312/515 : « her record », « two records », « a record high ») n'est plus un mot d'action à lui seul.
  it('le NOM « record » (la fiche) n’est pas un mot d’action', () => {
    for (const s of [
      "I found two records named Julie Martin, one in Geneva and one in Carouge. Which one — can you confirm?",
      "That's Julie Martin's record, right? Confirm?",
      "Julie Martin's record shows a budget of CHF 1.2M. Can you confirm?",
      "Got it. For the record, Julie already has a visit on Monday. Confirm?",
      "That's Julie Martin's record for 2026, right? Confirm?",
      'I updated the record this morning. Confirm?',
      "There's no record that Julie answered. Can you confirm?",
      'Her track record this year shows 3 visits. Confirm?',
      "That's a new record this month for the agency. Confirm?",
      'Julie’s record this year shows 3 visits. Confirm?',
    ]) expect(detectPhantomAction(s), s).toBeNull()
  })

  // « recording »/« record » restent HORS de portée quand rien ne l'emploie comme verbe avec un objet de
  // réponse : « records » (nom, noté ailleurs), « recording » (gérondif sans sujet), « on record » (un autre
  // verbe, « keep ») — le mot lui-même ne suffit pas, il faut un vrai contexte de verbe transitif.
  it('« record » reste hors de portée quand rien ne l’emploie comme verbe transitif d’action', () => {
    for (const s of [
      "I've noted it in your records?",
      'The recording of the visit is already in the calendar.',
      "I'll keep this on record for now.",
    ]) expect(detectPhantomAction(s), s).toBeNull()
  })

  // « Confirm the address? I'll record it. » ANNONCE l'action (« je vais l'enregistrer »), symétrique du futur
  // proche français « Je vais consigner… » : elle rejoint les cas pris.
  it('« I’ll record it » ANNONCE l’action, comme le futur proche français', () => {
    expect(detectPhantomAction("Confirm the address? I'll record it.")).not.toBeNull()
  })

  // Lot D2 : « je vais/viens de/m'apprête à consigner » (FR), et le futur/« going to »/passé élargi (EN) —
  // parallèles aux verbes déjà gardés (supprimer/envoyer/publier).
  it('les autres temps de « consigner »/« record » sont pris', () => {
    for (const s of [
      'Je viens de consigner le refus de Julie pour Florissant.',
      'Je vais consigner son refus pour Florissant.',
      "Je m'apprête à consigner son intérêt.",
      "I've just recorded her answer.",
      "I've recorded Julie's answer.",
      "I've recorded that Julie is not interested.",
      "I'll record her answer.",
      'I will record that Julie is not interested.',
      "I'm going to record her refusal.",
    ]) expect(detectPhantomAction(s), s).not.toBeNull()
  })

  // Lot D2 : l'offre « donne/précise/indique-moi X et je le consigne », « dis-(le|la|les)-moi », « dis-moi ce
  // qu'/quel/… » (paraphrases de consignerMotifManquant/consignerQuelleReponse, le refus rendu au modèle sur le
  // chemin principal) n'annonce rien — elle demande une information qui PRÉCÈDE « et je ». EN « tell/give me » :
  // même famille.
  it('une offre « donne/dis-moi … et je le consigne » n’est pas une annonce', () => {
    for (const s of [
      'Donne-moi le motif et je le consigne.',
      'Dis-le-moi et je le consigne.',
      'Je le consigne dès que tu me dis ce qu’elle a répondu.',
      'Précise-moi le bien et je consigne sa réponse.',
      // L'élision n'est pas la seule forme de « ce qu' » : « ce que » aussi. « , » ou « et » devant « je » :
      // même famille de coordination.
      'Dis-moi ce que Julie a répondu et je le consigne.',
      'Dis-moi ce qu’elle a répondu, je le consigne.',
      'Tell me the reason and I’ll record it.',
      'Give me the reason and I’ll record her answer.',
    ]) expect(detectPhantomAction(s), s).toBeNull()
  })

  // Un DÉLAI (« une seconde », « deux minutes », « a moment ») n'est pas l'information qu'une offre demande —
  // contrairement à « le motif »/« the reason », il ne dit rien sur l'action annoncée : la phrase reste une
  // revendication, seulement précédée d'un mot de politesse.
  it('un délai (« une seconde », « a moment ») n’exempte pas la revendication qui suit', () => {
    for (const s of [
      'Give me a second and I’ll send the message to Dubois.',
      'Donne-moi une seconde et je l’envoie.',
      'Donne-moi deux minutes et je supprime la fiche de Dubois.',
      'Give me a moment and I’ll delete Dubois’s record.',
    ]) expect(detectPhantomAction(s), s).not.toBeNull()
  })

  // Une revendication qui PRÉCÈDE « dis-moi »/« tell me » n'est pas une offre : le « dis-moi » vient APRÈS le
  // fait annoncé, jamais avant « et je »/« and I'll » — c'est une VARIANTE de l'incident d'origine du module (qui
  // disait « Confirme quand tu veux », pas « dis-moi quand c'est bon »). Si l'offre exemptait la PHRASE entière
  // dès qu'elle contenait « dis-moi »/« tell me », la revendication qui la précède passerait avec elle.
  it('une revendication suivie de « dis-moi »/« tell me » dans la même phrase reste prise', () => {
    for (const s of [
      'C’est noté, je lance la suppression de Test Boutons, dis-moi quand c’est bon.',
      'Je consigne son refus pour Florissant, dis-moi si c’est bon.',
      'I’ve sent the message to Dubois — tell me if you need anything else.',
      'I’ll delete the contact now, tell me if that’s wrong.',
    ]) expect(detectPhantomAction(s), s).not.toBeNull()
  })

  // Une demande D'ACCORD déguisée en offre (« dis-moi si c'est bon », « donne-moi ton go ») n'en est pas une —
  // contrairement à une demande d'INFORMATION, elle n'apprend rien à l'agent : il ne reste, comme dans « Valide
  // et je l'envoie », qu'à répondre oui ou non.
  it('une demande d’accord déguisée en offre reste une demande de confirmation', () => {
    for (const s of [
      'Voici le brouillon pour Dubois : « Bonjour Monsieur, je reviens vers vous pour la visite. » Dis-moi si c’est bon et je l’envoie.',
      'Dis-moi quand tu es prêt et je supprime la fiche de Dubois.',
      'Donne-moi ton accord et je le supprime.',
      'Donne-moi ton go et je le supprime.',
      'Dis-moi « go » et je le supprime.',
      'Dis-moi « ok » et je l’envoie.',
      'Give me the go-ahead and I’ll delete Dubois’s record.',
      'Tell me when you’re ready and I’ll delete Dubois’s record.',
      // Un avis n'est pas non plus une information sur l'action elle-même.
      'Précise-moi ton avis et je l’envoie.',
      'Indique-moi ce que tu en penses et je l’envoie.',
      'Tell me what you think and I’ll send it to Dubois.',
      // Témoins : la même forme, avec un autre verbe d'introduction ou une autre formule d'accord.
      'Précise-moi juste si c’est bon et je l’envoie.',
      'Indique-moi quand tu es prêt et je supprime la fiche de Dubois.',
      'Tell me when it suits you and I’ll delete Dubois’s record.',
    ]) expect(detectPhantomAction(s), s).not.toBeNull()
  })

  // … et la confirmation EXPLICITE reste prise : élargir l'offre à « dis-moi »/« donne-moi » ne doit pas laisser
  // passer une vraie demande de « go »/« feu vert », guillemets compris.
  it('« dis-moi go » / « donne-moi ton feu vert » restent des demandes de confirmation', () => {
    for (const s of [
      'Dis-moi go et je le supprime.',
      'Donne-moi ton feu vert et je le supprime.',
      'Dis-moi ok et je l’envoie.',
      'Dis-moi « go » et je le supprime.',
    ]) expect(detectPhantomAction(s), s).toBe('confirm_request')
  })

  // Lot D2 : le nom « consigne » (une instruction, whatsapp-tools comme le CRM en parlent) n'est une action QUE
  // quand c'est le COPILOTE qui dit « je » — avec ou sans déterminant/possessif devant, au singulier ou au
  // pluriel, ce n'en est jamais une : un blocage par liste de déterminants PRENAIT À TORT un nom SANS aucun
  // déterminant (« Consigne reçue »), ou au pluriel (« tes consignes »), que la liste ne couvrait pas.
  it('le nom « consigne », déterminé ou non, singulier ou pluriel, n’est pas un mot d’action', () => {
    for (const s of [
      'Bien reçu ta consigne : relancer Dubois vendredi à 9h. Tu confirmes ?',
      'Envoie-moi la pièce avec ta consigne. Tu confirmes que c’est pour Dupont ?',
      'Voici cette consigne pour l’équipe. Tu confirmes ?',
      'C’est une consigne de Julien. Tu confirmes ?',
      'Bien reçu tes consignes : relancer Dubois vendredi à 9h. Tu confirmes ?',
      'Voici les consignes d’accès pour la visite de demain. Tu confirmes ?',
      'Consigne reçue : relancer Dubois vendredi à 9h. Tu confirmes ?',
    ]) expect(detectPhantomAction(s), s).toBeNull()
  })

  // Lot D2 : le pronom objet « la »/« les » devant le verbe (« je LA consigne ») reste une action — la forme
  // conjuguée l'emporte sur l'exclusion du nom, qui ne s'applique qu'en l'absence de « je ». « te » (rare) : un
  // pronom datif, même position.
  it('« je la/les/te consigne » (pronom objet) reste un mot d’action', () => {
    expect(detectPhantomAction('Tu me confirmes et je la consigne ?')).not.toBeNull()
    expect(detectPhantomAction('Sa réponse, je la consigne dès que tu confirmes.')).not.toBeNull()
    expect(detectPhantomAction('Je te consigne ça pour Julie. Tu confirmes ?')).not.toBeNull()
    // Sans marqueur de confirmation ailleurs : seule la revendication PRESENT_CLAIMS peut la prendre.
    expect(detectPhantomAction('Je te consigne ça pour Julie.')).toBe('action_claim')
  })

  // Lot D2 : objet restreint du passé français — le relais d'add_note (« j'ai consigné ta note »)
  // n'est pas une consignation de réponse, contrairement à « j'ai consigné son refus ».
  it('« j’ai consigné »/« I’ve recorded » exigent un objet de réponse, pas n’importe quel objet', () => {
    expect(detectPhantomAction('J’ai consigné ta note dans la fiche de Julie.')).toBeNull()
    expect(detectPhantomAction('C’est noté, j’ai consigné l’appel dans sa timeline.')).toBeNull()
    expect(detectPhantomAction('I have recorded the note in her file.')).toBeNull()
    // Toujours pris : la classe déjà documentée (FAUX POSITIF ASSUMÉ) d'un passé sans marqueur de temps,
    // ici avec un objet qui EST dans la liste restreinte (« refus »).
    expect(detectPhantomAction('Oui, j’ai consigné son refus pour Florissant.')).toBe('action_claim')
  })

  // Lot D2 : « pour » (la forme même du gabarit `consigne()`) et l'élision « qu' » manquaient à l'objet restreint
  // du passé français ; « as (not) interested » et un nom possessif (Julie's) à l'anglais, au passé, au présent
  // et au futur.
  it('« consigné pour »/« qu’elle » (FR) et « … as (not) interested » (EN) sont pris', () => {
    for (const s of [
      'J’ai consigné pour Julie Martin : « Attique » — intéressée.',
      'J’ai consigné qu’elle n’est pas intéressée par Florissant.',
      'I’ve recorded her as not interested.',
      'I’ve recorded Julie as not interested in Florissant.',
      'I’ll record Julie’s answer.',
      'I’ll record her as not interested.',
      'I am going to record her answer.',
      'I’m recording Julie as interested.',
    ]) expect(detectPhantomAction(s), s).not.toBeNull()
  })

  // Lot D2 : « I'm recording » exige un objet de réponse — le récit AUTO de schedule_visit en cours
  // (« I'm recording it in the CRM now ») n'en a pas.
  it('« I’m recording » exige un objet de réponse, pas un « it » nu', () => {
    expect(detectPhantomAction('Visit scheduled for Monday 2pm with Julie. I’m recording it in the CRM now — /undo within 30 s.')).toBeNull()
    expect(detectPhantomAction('I’m recording her answer now.')).toBe('action_claim')
  })

  // Lot D2 : le passé élargi (« that »/« it » nus) prenait aussi un relais AUTO réellement fait — un rendez-vous,
  // une note, un rappel — qui n'a rien à voir avec la consignation d'une réponse d'acheteur. « that » n'est gardé
  // que si un mot de réponse (interested/answer/reply/refus…) suit dans la phrase ; « it » nu ne compte plus.
  it('le passé élargi ne prend plus les relais AUTO réels (rendez-vous, note, rappel)', () => {
    for (const s of [
      'Visit scheduled for Monday 6 October at 2pm (30 min) for Julie Martin — « Attique ». I’ve recorded it in the calendar.',
      'Done — I’ve recorded it in Julie’s timeline: “call back Monday”.',
      'Reminder set for Friday 9am. I’ve recorded that you want to call the notary.',
    ]) expect(detectPhantomAction(s), s).toBeNull()
  })

  // Lot D2 : un simple préfixe `✅ consigne`/`✅ recorded` prendrait aussi un relais d'add_note ou une note libre
  // portant le même préfixe. `CONSIGNE_ECHO` ne reconnaît que la FORME des quatre gabarits.
  it('un préfixe `✅ consigne`/`✅ recorded` qui n’est pas la forme de consigne() n’est pas pris', () => {
    for (const s of [
      '✅ Consigné dans la fiche de Julie : « rappeler lundi ».',
      "✅ Recorded in Julie's timeline: “call back Monday”.",
      // Même préposition que le gabarit (« pour X »), mais sans le tiret final qui le referme : proche, pas la forme.
      '✅ Consigné pour Julie : « rappeler lundi ».',
    ]) expect(detectPhantomAction(s), s).toBeNull()
  })

  // Lot D2 : `confirmConsigner` pour « propose » et « pas_encore » ne portait aucun mot d'action (« Je note
  // que… ») — son imitation SANS le suffixe système « (« oui » / « non ») » passait. Les huit gabarits (4
  // réponses × 2 langues) sont tous pris, suffixe ou non.
  it('l’imitation de la question système, SANS son suffixe, est prise pour les quatre réponses', () => {
    for (const lang of ['fr', 'en'] as const) {
      for (const reponse of ['propose', 'interesse', 'pas_interesse', 'pas_encore'] as const) {
        const question = confirmConsigner(lang, { reponse, nom: 'Julie Martin', bien: 'Attique 4 p. · Florissant 12, Genève', motif: 'prix' })
        const sansSuffixe = question.replace(/\s*\((?:«|")[^)]*\)$/, '')
        expect(sansSuffixe, `${lang}/${reponse} : suffixe retiré`).not.toBe(question)
        expect(detectPhantomAction(sansSuffixe), `${lang}/${reponse} : ${sansSuffixe}`).not.toBeNull()
      }
    }
  })

  // Le compte rendu d'un AUTRE outil ne doit pas être pris pour l'écho de la consignation — ni par un
  // mot d'action isolé (`offre`, `record`), ni par les mots « consigné »/« consigner » que
  // schedule_visit emploie pour RAPPORTER un état (jamais en « je »), ni par l'impératif d'un refus.
  it('le compte rendu d’un AUTRE outil n’est pas pris pour l’écho de la consignation', () => {
    for (const s of [
      // record_offer (whatsapp-actions.ts) : « enregistrée », jamais « consignée », et sans ✅.
      'Offre de CHF 850’000 enregistrée sur le dossier (statut : en attente).',
      'Offer of CHF 850’000 recorded on the deal (status: pending).',
      // schedule_visit (whatsapp-matching-outils.ts) : nomme « consigné »/« consigner » en rapportant
      // un état de tiers, jamais en « je consigne »/« j'ai consigné ».
      'Visite planifiée le lundi 6 octobre à 14h00 (30 min) pour Julie Martin — « Attique 4 p. · Florissant 12, Genève ». '
        + 'L’intérêt de Julie Martin pour ce bien n’est pas consigné : demande à l’agent s’il faut le consigner (record_match_outcome).',
      // consignerEchoTropLarge (whatsapp-i18n.ts) : un impératif adressé à l'agent, pas une revendication.
      'Too many of Julie Martin’s properties match the words of « attique » for me to settle this over WhatsApp: record the answer from the CRM.',
      'Contact *Julie Martin* créé.',
    ]) expect(detectPhantomAction(s), s).toBeNull()
  })

  it('un « ✅ Consigné » recopié au milieu d’une réponse est pris, comme au début', () => {
    expect(detectPhantomAction('Voici où on en est.\n✅ Consigné pour Julie Martin : « Attique » — intéressé·e.\nAutre chose ?')).toBe('action_claim')
    expect(detectPhantomAction('Done — ✅ Recorded for Julie Martin: « Attique » — interested. Anything else?')).toBe('action_claim')
  })

  // Les phrases voisines ajoutées pour cet outil (whatsapp-i18n.ts) : aucune n'annonce ni ne revendique
  // une action — ce sont des refus (rien n'est écrit) ou des constats d'état, jamais un « je consigne ».
  it('les refus et statuts de consignation ne sont jamais pris pour une confirmation simulée', () => {
    const nom = 'Julie Martin', bien = 'Attique 4 p. · Florissant 12, Genève', autreBien = 'Duplex 3 p. · Carouge'
    for (const s of [
      consignationDeja('fr', nom, bien), consignationDeja('en', nom, bien),
      consignationChangee('fr', nom, bien), consignationChangee('en', nom, bien),
      consignationImpossible('fr'), consignationImpossible('en'),
      consignationEchec('fr'), consignationEchec('en'),
      consignationNonConfirmee('fr'), consignationNonConfirmee('en'),
      consignerMotifManquant('fr'), consignerMotifManquant('en'),
      consignerQuelleReponse('fr'), consignerQuelleReponse('en'),
      consignerQuelAcheteur('fr'), consignerQuelAcheteur('en'),
      consignerAucunBien('fr', 'interesse', nom, []), consignerAucunBien('en', 'interesse', nom, []),
      consignerAucunBien('fr', 'interesse', nom, [bien]), consignerAucunBien('en', 'interesse', nom, [bien]),
      consignerPlusieursBiens('fr', nom, [bien, autreBien]), consignerPlusieursBiens('en', nom, [bien, autreBien]),
      consignerTropDeBiens('fr', 'interesse', nom), consignerTropDeBiens('en', 'interesse', nom),
      consignerTropLarge('fr', nom, 'attique'), consignerTropLarge('en', nom, 'attique'),
      consignerEchoTropLarge('fr', nom, 'attique geneve'), consignerEchoTropLarge('en', nom, 'attique geneve'),
      consignerAnnonceRetiree('fr', [bien]), consignerAnnonceRetiree('en', [bien]),
      consignerAnnonceRetiree('fr', [bien, autreBien]), consignerAnnonceRetiree('en', [bien, autreBien]),
    ]) expect(detectPhantomAction(s), s).toBeNull()
  })
})
