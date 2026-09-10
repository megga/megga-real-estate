import { describe, it, expect } from 'vitest'
import { detectPhantomAction, phantomNextStep, PHANTOM_RETRY_NUDGE } from './whatsapp-phantom-action'
import { t } from './whatsapp-i18n'

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
      t('fr', 'listingsSent'), t('en', 'listingsSent'),
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
