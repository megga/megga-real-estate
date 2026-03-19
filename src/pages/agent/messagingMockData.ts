// ─── Agent Messaging Mock Data ─────────────────────────────────────────────

export interface MessageThread {
  id: string
  contact_name: string
  contact_type: 'buyer' | 'seller'
  avatar_initials: string
  property_title: string | null
  property_id: string | null
  last_message: string
  last_message_at: string
  unread_count: number
}

export interface Message {
  id: string
  thread_id: string
  sender: 'agent' | 'contact'
  sender_name: string
  content: string
  timestamp: string
}

export const MESSAGE_THREADS: MessageThread[] = [
  {
    id: 'th1',
    contact_name: 'Famille R.',
    contact_type: 'buyer',
    avatar_initials: 'FR',
    property_title: 'Appartement 4.5 pièces, Champel',
    property_id: 'al2',
    last_message: 'Nous aimerions planifier une deuxième visite cette semaine si possible.',
    last_message_at: '2026-03-17T09:15:00Z',
    unread_count: 2,
  },
  {
    id: 'th2',
    contact_name: 'Marie Rochat',
    contact_type: 'seller',
    avatar_initials: 'MR',
    property_title: 'Appartement 4.5 pièces, Champel',
    property_id: 'al2',
    last_message: 'Est-ce que la Famille R. a donné suite après la visite ?',
    last_message_at: '2026-03-16T18:00:00Z',
    unread_count: 1,
  },
  {
    id: 'th3',
    contact_name: 'M. Bernard',
    contact_type: 'buyer',
    avatar_initials: 'MB',
    property_title: 'Appartement 4.5 pièces, Champel',
    property_id: 'al2',
    last_message: 'Merci, je confirme ma visite le 20 mars à 10h.',
    last_message_at: '2026-03-15T14:00:00Z',
    unread_count: 0,
  },
  {
    id: 'th4',
    contact_name: 'Couple Dubois',
    contact_type: 'buyer',
    avatar_initials: 'CD',
    property_title: 'Villa avec jardin, Cologny',
    property_id: 'al5',
    last_message: 'Le dossier hypothécaire est en cours, nous devrions avoir une réponse sous 10 jours.',
    last_message_at: '2026-03-14T16:30:00Z',
    unread_count: 0,
  },
  {
    id: 'th5',
    contact_name: 'Mme Kowalski',
    contact_type: 'buyer',
    avatar_initials: 'MK',
    property_title: 'Loft industriel, Carouge',
    property_id: 'al3',
    last_message: 'Je suis malheureusement indisponible cette semaine. Peut-on reporter à la semaine prochaine ?',
    last_message_at: '2026-03-13T11:00:00Z',
    unread_count: 0,
  },
  {
    id: 'th6',
    contact_name: 'Paul Müller',
    contact_type: 'seller',
    avatar_initials: 'PM',
    property_title: 'Immeuble commercial, Plainpalais',
    property_id: 'al8',
    last_message: 'Avez-vous besoin d\'autres documents pour compléter le dossier KYC ?',
    last_message_at: '2026-03-12T10:00:00Z',
    unread_count: 0,
  },
  {
    id: 'th7',
    contact_name: 'Famille Tran',
    contact_type: 'buyer',
    avatar_initials: 'FT',
    property_title: 'Appartement 4.5 pièces, Champel',
    property_id: 'al2',
    last_message: 'Très bien, nous allons étudier l\'offre et revenir vers vous.',
    last_message_at: '2026-03-11T15:30:00Z',
    unread_count: 0,
  },
  {
    id: 'th8',
    contact_name: 'Jean-Pierre Arnaud',
    contact_type: 'buyer',
    avatar_initials: 'JA',
    property_title: 'Penthouse Quai du Mont-Blanc',
    property_id: 'al4',
    last_message: 'Le prix est ferme ou y a-t-il une marge de négociation ?',
    last_message_at: '2026-03-10T09:45:00Z',
    unread_count: 0,
  },
  {
    id: 'th9',
    contact_name: 'Sophie Laurent',
    contact_type: 'seller',
    avatar_initials: 'SL',
    property_title: 'Maison familiale, Thônex',
    property_id: 'al9',
    last_message: 'Merci pour les photos, elles sont magnifiques ! Quand serons-nous en ligne ?',
    last_message_at: '2026-03-08T14:20:00Z',
    unread_count: 0,
  },
]

export const MESSAGES: Message[] = [
  // ─── Thread 1: Famille R. — 2ème visite ───
  { id: 'm1-1', thread_id: 'th1', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Bonjour, suite à votre visite de samedi, j\'aimerais savoir si vous souhaitez planifier une deuxième visite de l\'appartement de Champel.', timestamp: '2026-03-16T10:00:00Z' },
  { id: 'm1-2', thread_id: 'th1', sender: 'contact', sender_name: 'Famille R.', content: 'Oui absolument ! Nous avons été très impressionnés par la luminosité et la vue sur le parc. Mon mari aimerait revoir la cuisine et les rangements.', timestamp: '2026-03-16T11:30:00Z' },
  { id: 'm1-3', thread_id: 'th1', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Parfait ! Je peux vous proposer mercredi 19 mars à 14h ou jeudi 20 mars à 10h. Quelle date vous conviendrait le mieux ?', timestamp: '2026-03-16T12:00:00Z' },
  { id: 'm1-4', thread_id: 'th1', sender: 'contact', sender_name: 'Famille R.', content: 'Jeudi à 10h serait idéal. Est-ce possible de prendre quelques mesures pendant la visite ? Nous aimerions vérifier si nos meubles rentrent.', timestamp: '2026-03-16T14:00:00Z' },
  { id: 'm1-5', thread_id: 'th1', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Bien sûr, aucun problème ! Vous pouvez prendre toutes les mesures nécessaires. Je vous enverrai aussi le plan de l\'appartement par e-mail d\'ici là.', timestamp: '2026-03-16T14:30:00Z' },
  { id: 'm1-6', thread_id: 'th1', sender: 'contact', sender_name: 'Famille R.', content: 'Merci beaucoup ! Une dernière question : savez-vous si le financement via UBS est possible pour ce type de bien ?', timestamp: '2026-03-17T08:30:00Z' },
  { id: 'm1-7', thread_id: 'th1', sender: 'contact', sender_name: 'Famille R.', content: 'Nous aimerions planifier une deuxième visite cette semaine si possible.', timestamp: '2026-03-17T09:15:00Z' },

  // ─── Thread 2: Marie Rochat — Suivi offre ───
  { id: 'm2-1', thread_id: 'th2', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Bonjour Marie, je voulais vous informer que la visite de samedi avec la Famille R. s\'est très bien passée.', timestamp: '2026-03-15T16:00:00Z' },
  { id: 'm2-2', thread_id: 'th2', sender: 'contact', sender_name: 'Marie Rochat', content: 'Super nouvelle ! Ils ont eu l\'air intéressé par le prix ?', timestamp: '2026-03-15T17:30:00Z' },
  { id: 'm2-3', thread_id: 'th2', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Ils n\'ont pas négocié à ce stade, mais ont trouvé le prix cohérent avec le marché. Leur financement est en cours de validation.', timestamp: '2026-03-15T18:00:00Z' },
  { id: 'm2-4', thread_id: 'th2', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Par ailleurs, nous avons reçu une offre officielle de CHF 1\'280\'000. Je vous ai envoyé les détails par e-mail. Souhaitez-vous qu\'on en discute ?', timestamp: '2026-03-16T14:45:00Z' },
  { id: 'm2-5', thread_id: 'th2', sender: 'contact', sender_name: 'Marie Rochat', content: 'Oui, j\'ai bien reçu l\'offre. C\'est un peu en dessous du prix demandé. Pensez-vous qu\'une contre-offre serait appropriée ?', timestamp: '2026-03-16T16:00:00Z' },
  { id: 'm2-6', thread_id: 'th2', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Je recommanderais d\'attendre la deuxième visite de la Famille R. avant de répondre. Si leur intérêt se confirme, cela nous donnera une meilleure position.', timestamp: '2026-03-16T16:30:00Z' },
  { id: 'm2-7', thread_id: 'th2', sender: 'contact', sender_name: 'Marie Rochat', content: 'Est-ce que la Famille R. a donné suite après la visite ?', timestamp: '2026-03-16T18:00:00Z' },

  // ─── Thread 3: M. Bernard — Confirmation visite ───
  { id: 'm3-1', thread_id: 'th3', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Bonjour M. Bernard, je vous confirme la disponibilité du bien au 45 avenue de Champel pour une visite. Seriez-vous disponible le 20 mars à 10h ?', timestamp: '2026-03-14T09:00:00Z' },
  { id: 'm3-2', thread_id: 'th3', sender: 'contact', sender_name: 'M. Bernard', content: 'Bonjour, oui le 20 mars me convient. Combien de pièces fait exactement l\'appartement ?', timestamp: '2026-03-14T10:30:00Z' },
  { id: 'm3-3', thread_id: 'th3', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'C\'est un 4.5 pièces de 115 m², au 4ème étage avec vue dégagée sur le parc. Cuisine entièrement équipée, rénovée en 2023. Je vous enverrai la fiche complète.', timestamp: '2026-03-14T11:00:00Z' },
  { id: 'm3-4', thread_id: 'th3', sender: 'contact', sender_name: 'M. Bernard', content: 'Parfait, ça correspond bien à ce que je cherche. Y a-t-il un parking inclus ?', timestamp: '2026-03-14T14:00:00Z' },
  { id: 'm3-5', thread_id: 'th3', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Oui, une place de parking en sous-sol est incluse dans le prix. Il y a aussi une cave de 8 m².', timestamp: '2026-03-14T14:30:00Z' },
  { id: 'm3-6', thread_id: 'th3', sender: 'contact', sender_name: 'M. Bernard', content: 'Merci, je confirme ma visite le 20 mars à 10h.', timestamp: '2026-03-15T14:00:00Z' },

  // ─── Thread 4: Couple Dubois — Suivi financement ───
  { id: 'm4-1', thread_id: 'th4', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Bonjour, je voulais prendre des nouvelles de votre dossier de financement pour la villa de Cologny.', timestamp: '2026-03-12T09:00:00Z' },
  { id: 'm4-2', thread_id: 'th4', sender: 'contact', sender_name: 'Couple Dubois', content: 'Bonjour Gregory, nous avons soumis notre dossier à la BCV et au Crédit Suisse. La BCV nous a demandé des justificatifs supplémentaires.', timestamp: '2026-03-12T11:00:00Z' },
  { id: 'm4-3', thread_id: 'th4', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'D\'accord, c\'est tout à fait normal. N\'hésitez pas si vous avez besoin d\'aide avec les documents liés au bien (estimation, descriptif technique, etc.).', timestamp: '2026-03-12T11:30:00Z' },
  { id: 'm4-4', thread_id: 'th4', sender: 'contact', sender_name: 'Couple Dubois', content: 'Justement, pourriez-vous nous envoyer le rapport d\'estimation et le CECB ? La banque les demande.', timestamp: '2026-03-13T09:00:00Z' },
  { id: 'm4-5', thread_id: 'th4', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Bien sûr, je vous les envoie par e-mail dans l\'heure. Avez-vous aussi besoin de l\'extrait du registre foncier ?', timestamp: '2026-03-13T09:30:00Z' },
  { id: 'm4-6', thread_id: 'th4', sender: 'contact', sender_name: 'Couple Dubois', content: 'Oui, si vous l\'avez, ce serait parfait. Merci beaucoup pour votre réactivité !', timestamp: '2026-03-13T10:00:00Z' },
  { id: 'm4-7', thread_id: 'th4', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'C\'est envoyé ! Les trois documents sont en pièce jointe. Tenez-moi au courant de l\'avancement.', timestamp: '2026-03-13T10:30:00Z' },
  { id: 'm4-8', thread_id: 'th4', sender: 'contact', sender_name: 'Couple Dubois', content: 'Le dossier hypothécaire est en cours, nous devrions avoir une réponse sous 10 jours.', timestamp: '2026-03-14T16:30:00Z' },

  // ─── Thread 5: Mme Kowalski — Report visite ───
  { id: 'm5-1', thread_id: 'th5', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Bonjour Mme Kowalski, je vous propose une visite du loft de Carouge ce vendredi à 16h. Cela vous conviendrait-il ?', timestamp: '2026-03-12T14:00:00Z' },
  { id: 'm5-2', thread_id: 'th5', sender: 'contact', sender_name: 'Mme Kowalski', content: 'Bonjour, je suis malheureusement en déplacement professionnel cette semaine. Le loft a-t-il un espace extérieur ?', timestamp: '2026-03-12T16:00:00Z' },
  { id: 'm5-3', thread_id: 'th5', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Oui, il dispose d\'une terrasse de 25 m² orientée sud-ouest. Très agréable en été ! Voulez-vous qu\'on planifie la visite la semaine prochaine plutôt ?', timestamp: '2026-03-12T16:30:00Z' },
  { id: 'm5-4', thread_id: 'th5', sender: 'contact', sender_name: 'Mme Kowalski', content: 'Je suis malheureusement indisponible cette semaine. Peut-on reporter à la semaine prochaine ?', timestamp: '2026-03-13T11:00:00Z' },

  // ─── Thread 6: Paul Müller — Documents KYC ───
  { id: 'm6-1', thread_id: 'th6', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Bonjour M. Müller, pour avancer sur le dossier de vente de votre immeuble, j\'aurais besoin de quelques documents complémentaires pour le KYC.', timestamp: '2026-03-10T09:00:00Z' },
  { id: 'm6-2', thread_id: 'th6', sender: 'contact', sender_name: 'Paul Müller', content: 'Bonjour Gregory, de quels documents avez-vous besoin exactement ?', timestamp: '2026-03-10T10:00:00Z' },
  { id: 'm6-3', thread_id: 'th6', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Il me faudrait : 1) L\'extrait du registre du commerce à jour, 2) Une copie de la pièce d\'identité du représentant légal, 3) Le dernier bilan annuel de la société.', timestamp: '2026-03-10T10:30:00Z' },
  { id: 'm6-4', thread_id: 'th6', sender: 'contact', sender_name: 'Paul Müller', content: 'D\'accord, je prépare tout ça. Pour le bilan, est-ce que celui de 2025 convient ou faut-il celui de 2024 ?', timestamp: '2026-03-10T14:00:00Z' },
  { id: 'm6-5', thread_id: 'th6', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Le bilan 2025 serait idéal. Si vous ne l\'avez pas encore, celui de 2024 est acceptable en attendant.', timestamp: '2026-03-10T14:30:00Z' },
  { id: 'm6-6', thread_id: 'th6', sender: 'contact', sender_name: 'Paul Müller', content: 'Parfait, je vous envoie le tout d\'ici vendredi. Avez-vous besoin d\'autres documents pour compléter le dossier KYC ?', timestamp: '2026-03-12T10:00:00Z' },

  // ─── Thread 7: Famille Tran — Étude offre ───
  { id: 'm7-1', thread_id: 'th7', sender: 'contact', sender_name: 'Famille Tran', content: 'Bonjour, nous avons visité l\'appartement de Champel hier et nous sommes très intéressés. Quel est le processus pour faire une offre ?', timestamp: '2026-03-09T10:00:00Z' },
  { id: 'm7-2', thread_id: 'th7', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Bonjour ! Ravi que le bien vous plaise. Pour faire une offre, il suffit de m\'indiquer le montant souhaité et les éventuelles conditions. Je transmettrai ensuite au vendeur.', timestamp: '2026-03-09T10:30:00Z' },
  { id: 'm7-3', thread_id: 'th7', sender: 'contact', sender_name: 'Famille Tran', content: 'Le prix demandé est de CHF 1\'350\'000. Nous aimerions proposer CHF 1\'300\'000, est-ce réaliste ?', timestamp: '2026-03-09T14:00:00Z' },
  { id: 'm7-4', thread_id: 'th7', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Le bien suscite pas mal d\'intérêt, mais je peux transmettre votre proposition. Avez-vous déjà une confirmation de financement de votre banque ?', timestamp: '2026-03-09T14:30:00Z' },
  { id: 'm7-5', thread_id: 'th7', sender: 'contact', sender_name: 'Famille Tran', content: 'Nous avons un accord de principe de la BCGE pour un montant allant jusqu\'à CHF 1\'350\'000. Nous pouvons vous fournir l\'attestation.', timestamp: '2026-03-10T09:00:00Z' },
  { id: 'm7-6', thread_id: 'th7', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Excellent, c\'est un bon dossier. Envoyez-moi l\'attestation et je présenterai votre offre à la vendeuse dans les meilleures conditions.', timestamp: '2026-03-10T09:30:00Z' },
  { id: 'm7-7', thread_id: 'th7', sender: 'contact', sender_name: 'Famille Tran', content: 'Très bien, nous allons étudier l\'offre et revenir vers vous.', timestamp: '2026-03-11T15:30:00Z' },

  // ─── Thread 8: Jean-Pierre Arnaud — Négociation prix ───
  { id: 'm8-1', thread_id: 'th8', sender: 'contact', sender_name: 'Jean-Pierre Arnaud', content: 'Bonjour, j\'ai vu votre annonce pour le penthouse au Quai du Mont-Blanc. Est-il toujours disponible ?', timestamp: '2026-03-08T09:00:00Z' },
  { id: 'm8-2', thread_id: 'th8', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Bonjour M. Arnaud, oui le bien est toujours disponible. C\'est un penthouse exceptionnel de 180 m² avec terrasse panoramique et vue sur le lac et le Mont-Blanc.', timestamp: '2026-03-08T09:30:00Z' },
  { id: 'm8-3', thread_id: 'th8', sender: 'contact', sender_name: 'Jean-Pierre Arnaud', content: 'Le cadre a l\'air magnifique. Serait-il possible de visiter ce week-end ?', timestamp: '2026-03-08T10:00:00Z' },
  { id: 'm8-4', thread_id: 'th8', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Samedi 15 mars à 11h vous conviendrait ? C\'est l\'heure idéale pour apprécier la lumière naturelle dans le salon.', timestamp: '2026-03-08T10:30:00Z' },
  { id: 'm8-5', thread_id: 'th8', sender: 'contact', sender_name: 'Jean-Pierre Arnaud', content: 'Parfait, c\'est noté. Le prix affiché est de CHF 3\'200\'000. Le prix est ferme ou y a-t-il une marge de négociation ?', timestamp: '2026-03-10T09:45:00Z' },

  // ─── Thread 9: Sophie Laurent — Mise en ligne ───
  { id: 'm9-1', thread_id: 'th9', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Bonjour Sophie, le photographe est passé hier et les photos de votre maison sont superbes. Je vous les envoie pour validation.', timestamp: '2026-03-07T14:00:00Z' },
  { id: 'm9-2', thread_id: 'th9', sender: 'contact', sender_name: 'Sophie Laurent', content: 'Oh merci ! J\'ai hâte de les voir. Le jardin est bien mis en valeur ?', timestamp: '2026-03-07T15:00:00Z' },
  { id: 'm9-3', thread_id: 'th9', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Absolument, il a pris des photos du jardin sous plusieurs angles, y compris avec la terrasse couverte. Vous allez adorer le résultat.', timestamp: '2026-03-07T15:30:00Z' },
  { id: 'm9-4', thread_id: 'th9', sender: 'contact', sender_name: 'Sophie Laurent', content: 'Magnifique ! Et pour le texte de l\'annonce, vous vous en occupez ?', timestamp: '2026-03-08T09:00:00Z' },
  { id: 'm9-5', thread_id: 'th9', sender: 'agent', sender_name: 'Gregory Lyonnet', content: 'Oui, je rédige le descriptif et je vous l\'envoie pour relecture avant publication. Nous devrions être en ligne d\'ici lundi.', timestamp: '2026-03-08T09:30:00Z' },
  { id: 'm9-6', thread_id: 'th9', sender: 'contact', sender_name: 'Sophie Laurent', content: 'Merci pour les photos, elles sont magnifiques ! Quand serons-nous en ligne ?', timestamp: '2026-03-08T14:20:00Z' },
]

export const UNREAD_THREAD_COUNT = MESSAGE_THREADS.filter((t) => t.unread_count > 0).length
