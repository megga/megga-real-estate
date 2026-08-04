// supabase/functions/_shared/pii-redaction.ts
// Server-side PII scrubbing layer shared across AI Edge Functions.
//
// Pourquoi : un prospect peut coller dans un message libre (Import Lead)
// des données ultra-sensibles (N° AVS, IBAN, mot de passe, passeport CH).
// Ces données :
//   1. ne doivent JAMAIS être envoyées au LLM (cross-border + minimisation nLPD)
//   2. ne doivent pas être stockées en clair côté serveur
//
// Stratégie : redaction regex BEFORE l'appel LLM + BEFORE le stockage du
// rawText. Les substitutions utilisent des marqueurs typés ([REDACTED:AVS],
// [REDACTED:IBAN], etc.) pour préserver la structure du texte et permettre
// au LLM de comprendre qu'il y avait là une donnée sans la voir.
//
// Deuxième famille, arrivée après coup (août 2026) : les secrets que le produit
// ÉMET lui-même (TOKEN). Un jeton de lien magique n'est pas une PII, c'est un
// DROIT D'ACCÈS — et il ressort dans des textes qu'on croit techniques, typiquement
// le corps d'erreur d'un service tiers qui recopie l'URL qu'il n'a pas pu charger.
// Ces textes-là finissent en journal, en `activity_events` et dans des réponses
// d'API : ils passent par ici comme le reste.
//
// **À utiliser sur tout chemin où du texte libre rentre dans le système** :
//   - extract-lead (Sprint 3)
//   - extract-property-pdf (post-Sprint 3 rétrofit recommandé)
//   - extract-property-url (idem)
//   - ai-copilot quand un agent colle un message client
//
// Spec : RED_TEAM_SPRINT_3.md §A.A1, §G.1 (A1 renforcé).

/** Marqueur de remplacement standardisé. */
export type RedactionKind =
  | 'AVS'        // N° AVS suisse (756.XXXX.XXXX.XX)
  | 'IBAN'       // IBAN (CH, FR, DE, etc.)
  | 'CARD'       // Carte bancaire 13-19 chiffres
  | 'PASSPORT'   // Passeport / carte d'identité CH (1 lettre + 7 chiffres)
  | 'PASSWORD'   // Pattern password/mot de passe/mdp/pwd
  | 'API_KEY'    // sk-..., AKIA..., ghp_..., etc.
  | 'DOB'        // Date de naissance explicite (Né(e) le ...)
  | 'ACCESS_CODE' // Digicode / code d'accès / code wifi / PIN — valeur de FORME contrainte
  | 'TOKEN'      // Jeton de capacité MEGGA (lien magique KYC, lien de réception) : <b64url>.<b64url>

export interface RedactionResult {
  redactedText: string
  counts: Record<RedactionKind, number>
  /** Total redactions = sum(counts). Pratique pour audit log. */
  total: number
}

/**
 * Catalogue des patterns. Ordre important : on applique les patterns les
 * plus spécifiques d'abord (AVS, IBAN) avant les génériques (CARD).
 *
 * Chaque entrée a un `pattern` (regex globale) et un `label` (RedactionKind).
 * Le replacement génère `[REDACTED:LABEL]` pour préserver la structure.
 *
 * RÈGLE D'ORDRE (juil. 2026, mesurée) : les motifs ANCRÉS PAR MARQUEUR dont la valeur
 * capturée est libre — PASSWORD — passent EN DERNIER, après ceux dont la valeur a une
 * forme contrainte (AVS, IBAN, CARD, DOB…). Motif : leur capture avale le token qui suit
 * le marqueur, donc un faux positif ne mutile pas seulement du texte, il FRAGMENTE le
 * secret suivant et DÉSARME le détecteur d'après. Mesuré avant correction :
 * « Mot de passe :\nNé le 12.03.1985 » rendait « [REDACTED:PASSWORD] le 12.03.1985 » —
 * l'ancre « Né » mangée, la date de naissance en clair. Placer PASSWORD après DOB et CARD
 * ramène ces fuites à zéro sans coûter un seul vrai positif.
 *
 * COROLLAIRE SYMÉTRIQUE (août 2026) : un motif qui, lui, ne peut avaler AUCUNE ancre passe
 * en TÊTE — c'est le cas de TOKEN, dont l'alphabet ne contient ni espace ni « : » ni « = ».
 * Il n'a rien à perdre à passer premier, et beaucoup à y gagner : c'est LUI qui se fait
 * grignoter par un motif large (le détail est sur l'entrée TOKEN).
 */
const PATTERNS: { kind: RedactionKind; pattern: RegExp }[] = [
  // Jeton de capacité MEGGA — lien magique KYC et lien de réception acheteur.
  // Forme émise par _shared/magic-link-token.ts : <base64url(payload)>.<base64url(HMAC-SHA256)>,
  // soit ≥ 80 caractères de payload (il encode un UUID et `exp`) et exactement 43 de signature.
  // Un JWT, à 3 segments, rentre dans la même forme et est couvert par la même passe.
  //
  // EN TÊTE DU CATALOGUE, pour la raison INVERSE de celle qui envoie PASSWORD en queue.
  // Désarmer un motif aval, c'est manger son ANCRE en laissant sa VALEUR en clair ; celui-ci
  // ne le peut pas. Sa classe [\w-] ne contient ni espace, ni « : », ni « = », ni guillemet —
  // les séparateurs qui, chez PASSWORD, DOB et ACCESS_CODE, tiennent l'ancre à sa valeur : il
  // ne franchit donc jamais la frontière entre les deux, et là où il englobe un marqueur, il
  // englobe aussi la valeur, si bien que rien ne survit en clair.
  // L'inverse est possible : un motif large qui mord une tranche du jeton le rend
  // méconnaissable ICI, et la moitié restante part en clair. Mesuré sur un jeton dont le
  // payload est intégralement majuscules/chiffres (base64 valide, juste improbable — 0 cas sur
  // 20 000 jetons tirés) : IBAN avale le payload et la signature reste lisible. Le risque est
  // donc théorique aujourd'hui ; la place en tête le maintient à zéro quel que soit le motif
  // large ajouté demain.
  //
  // BORNES — un motif trop gourmand est pire qu'absent, et le plancher de 24 caractères ne
  // suffit PAS. Mesuré sur les 969 fichiers de texte du dépôt, CSS et HTML compris : le seul
  // plancher rendait 103 prises légitimes, toutes de la même famille — des sélecteurs CSS en
  // kebab-case joints par un point, « bg-image-gradient-overlay.rectangle-gradient-bottom »,
  // « w-richtext-figure-selected.w-richtext-figure-type-video ». Ce n'est pas théorique ici :
  // `magic-link-send-email` passe désormais le corps d'erreur de Resend dans ce catalogue, et
  // ce corps peut recopier le HTML de l'e-mail.
  //
  // D'où la MAJUSCULE exigée dans chaque segment. C'est le discriminant : le base64url d'un
  // JSON (le payload encode un UUID et `exp`) comme celui de 32 octets aléatoires (la
  // signature) en contient toujours une — mesuré sur 200 000 jetons tirés selon la forme de
  // `_shared/magic-link-token.ts`, 200 000 captés, aucun manqué. Un identifiant kebab-case,
  // lui, n'en porte jamais. Après cet ajout : 0 prise légitime sur les 969 fichiers, les 4
  // restantes étant de VRAIS jetons (clé anon Supabase, fixtures de tests).
  // ⚠ Ne pas « renforcer » en exigeant aussi un CHIFFRE : essayé, 10 jetons sur 20 000
  // passaient à travers (la signature peut n'en porter aucun). Manquer un jeton est une
  // fuite, un faux positif n'est qu'un journal moins lisible — l'asymétrie décide.
  //
  // Les frontières sont des lookarounds sur [\w-] et NON sur [\w.-] : le point est de la
  // ponctuation autant qu'un séparateur de segments, et l'exclure des frontières faisait
  // manquer le jeton en fin de phrase (« …a échoué sur <jeton>. ») ou précédé d'un point.
  {
    kind: 'TOKEN',
    pattern: /(?<![\w-])(?=[\w-]*[A-Z])[\w-]{24,}(?:\.(?=[\w-]*[A-Z])[\w-]{24,}){1,2}(?![\w-])/g,
  },

  // Même jeton, reconnu par son PORTEUR et non par sa forme : query `?token=`
  // (buyer-reception-get/-react), en-tête `x-magic-link-token` (magic-link-get/-confirm/
  // -upload), ou SEGMENT DE CHEMIN (`/kyc/`, `/kyc-report/`, `/reception/`, `/rendez-vous/`,
  // `/rendez-vous-accueil/` — l'appel d'accueil, ajouté le 04.08.2026 en même temps que sa
  // route ; il précède `rendez-vous` dans l'alternation pour la MÊME raison que
  // `kyc-report` précède `kyc` : l'inverse ferait mordre `rendez-vous` d'abord, et le `\/`
  // qui suit échouerait sur le `-` d'« -accueil », laissant le jeton en clair —
  // `/accept-invite/`). Utile quand la valeur n'a plus la forme canonique — jeton TRONQUÉ par
  // le journal qui le recopie, ou percent-encodé — cas où le motif précédent ne peut conclure.
  //
  // Le chemin n'est pas un ancrage de confort : c'est la forme DOMINANTE. Quatre des cinq
  // parcours publics portent leur jeton dans l'URL, pas en query — et c'est précisément par
  // là qu'un texte d'erreur tiers le recopie (« net::ERR_… at https://…/kyc-report/<jeton> »),
  // souvent tronqué, donc hors de portée du motif de forme.
  // `kyc-report` précède `kyc` dans l'alternation : l'inverse ferait mordre `kyc` d'abord et
  // laisserait « -report/<jeton> » hors de la capture.
  //
  // Gourmandise bornée par deux gardes repris d'ACCESS_CODE :
  //  1. le séparateur est [ \t]* et non \s* : il ne traverse pas un saut de ligne, donc ne peut
  //     pas capturer le premier mot de la ligne suivante ;
  //  2. la valeur doit contenir AU MOINS UN CHIFFRE, lookahead borné à la MÊME classe qu'elle
  //     (avec une classe plus large, le lookahead traverse le texte et valide n'importe quoi).
  //     Un mot de prose n'a pas de chiffre : « x-magic-link-token: manquant » reste lisible,
  //     tandis que tout jeton réel est pris — son payload encode `exp`, un nombre.
  {
    kind: 'TOKEN',
    pattern: /(?:[?&]token=|x-magic-link-token[ \t]*[:=][ \t]*|\/(?:kyc-report|kyc|reception|rendez-vous-accueil|rendez-vous|accept-invite)\/)((?=[\w.%-]*\d)[\w.%-]{12,})/gi,
  },

  // AVS Suisse — format officiel 756.XXXX.XXXX.XX (avec ou sans points/espaces).
  // Doit matcher avant CARD (13 chiffres collés ressemblent à une carte).
  {
    kind: 'AVS',
    pattern: /\b756[.\s-]?\d{4}[.\s-]?\d{4}[.\s-]?\d{2}\b/g,
  },

  // IBAN — préfixe pays (CH/FR/DE/IT/LU/LI…) suivi de 11-30 caractères
  // alphanumériques, séparateurs optionnels entre les chars (CH IBAN = 21
  // chars total, ne se divise pas proprement en groupes de 4 → on ne peut
  // PAS exiger des quad-groupes stricts).
  {
    kind: 'IBAN',
    pattern: /\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]){11,30}\b/g,
  },

  // Passeport / carte d'identité CH — 1 lettre majuscule + 7 chiffres
  // (format émis depuis 2003). Limité à un préfixe explicite pour éviter
  // les faux positifs sur des refs propriétés type "MG-2026-101".
  {
    kind: 'PASSPORT',
    pattern: /(?:passeport|carte\s+d['']identit[ée]|cni|pass\.?|ID\s*n[°o]?)\s*:?\s*([A-Z]\d{7})\b/gi,
  },

  // Clés API typiques — préfixes connus + 16-64 chars alphanumériques.
  // sk- (OpenAI/Stripe), AKIA (AWS), ghp_ (GitHub), xoxb-/xoxp- (Slack).
  {
    kind: 'API_KEY',
    pattern: /\b(?:sk-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16}|ghp_[A-Za-z0-9]{30,}|xox[bp]-[A-Za-z0-9-]{20,})\b/g,
  },

  // Carte bancaire — 13 à 19 chiffres, groupés par 4 ou collés.
  // Placé après AVS pour ne pas attraper les AVS.
  {
    kind: 'CARD',
    pattern: /\b(?:\d{4}[\s-]?){3,4}\d{1,4}\b/g,
  },

  // Date de naissance explicite — "Né le 12.03.1985", "Née le ...",
  // "Né(e) le ...", "DDN: 12/03/1985". Le `(e)` féminin entier est optionnel.
  // On évite de scrubber TOUTES les dates (sinon on perd les deadlines etc.).
  {
    kind: 'DOB',
    pattern: /\b(?:n[ée](?:\(?e\)?)?\s+le|date\s+de\s+naissance|ddn|d\.n\.)\s*:?\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/gi,
  },

  // Mot de passe explicite — capture la valeur après marker.
  // Cible "mot de passe: xxx", "password = xxx", "mdp xxx", "pwd: xxx".
  //
  // PLACÉ EN DERNIER : sa valeur capturée est LIBRE (un mot de passe n'a pas de forme), donc
  // c'est le seul motif capable d'avaler le token qui suit et de désarmer un détecteur aval.
  // Le faire passer après CARD et DOB annule ce risque (cf. la règle d'ordre en tête de tableau).
  //
  // L'alternative `passe` NUE a été retirée. En français « passe » est d'abord un verbe, et le
  // motif mordait sur de la prose courante : « ce qui se passe : on attend le notaire » devenait
  // « ce qui se [REDACTED:PASSWORD] attend le notaire », la capture (\S+) avalant en prime le mot
  // suivant. Ce catalogue étant partagé par TOUS les sites de redaction, le texte arrivait mutilé
  // au LLM (brouillon d'email, résumé) et donc sous les yeux de l'agent.
  //
  // Ce n'était pas qu'un défaut cosmétique : à l'époque PASSWORD tournait AVANT CARD et DOB, et
  // le mot avalé FRAGMENTAIT le secret suivant, désarmant le détecteur d'après. Mesuré alors :
  // « ce qui se passe : 4111 1111 1111 1111 » laissait 12 chiffres de carte EN CLAIR (CARD exige
  // 13-19 chiffres, donc ne matchait plus le reste) ; « ce qui se passe : Né le 12.03.1985 »
  // laissait la date, son ancre « Né » ayant été mangée. Deux corrections indépendantes ferment
  // cette classe de fuite : le retrait de l'alternative, et le déplacement en fin de tableau.
  //
  // Perte assumée : « passe : <valeur> » sans « mot de » n'est plus couvert ici. Le sens suisse
  // de la clé (« le passe : 4521 ») est en revanche repris par ACCESS_CODE, qui exige un
  // DÉTERMINANT devant (« le/mon/votre passe ») ET une valeur de forme contrainte — deux gardes
  // que l'homographe verbal ne franchit pas.
  //
  // La capture est bornée par `"` au lieu de \S+ : les résultats d'outils CRM réinjectés dans les
  // boucles LLM sont du JSON COMPACT, où plus rien n'est blanc après la valeur. Un `(\S+)` glouton
  // avalait donc le guillemet fermant puis tout le document jusqu'au prochain espace — perte
  // SILENCIEUSE mesurée à 106 caractères sur un brief à 2 contacts, le second contact et son UUID
  // entièrement effacés, JSON invalide, sans que le modèle puisse savoir qu'il lisait une vue
  // amputée. Exclure le seul `"` suffit (une valeur JSON s'y termine) et redacte STRICTEMENT PLUS
  // qu'exclure aussi `,;}]` : un mot de passe contenant une virgule reste couvert en entier.
  {
    kind: 'PASSWORD',
    pattern: /\b(?:password|mot[\s-]?de[\s-]?passe|mdp|pwd)\s*[:=]\s*([^\s"]+)/gi,
  },

  // Code d'accès physique ou wifi (digicode, boîte à clés, PIN, portail).
  //
  // Ce n'est pas une donnée LBA/LPD, mais c'est un SECRET qui n'a rien à faire chez un
  // fournisseur LLM. Le marqueur seul ne suffit pas : mesuré sur 155 phrases de prose
  // immobilière, « code d'accès : » et « code wifi : » introduisent des faux positifs, parce
  // qu'en note d'agent ces lignes servent surtout à dire QUI détient le code et QUAND il sera
  // transmis (« Code d'accès : le propriétaire le donnera chez le notaire »).
  //
  // D'où la CONTRAINTE DE FORME sur la valeur, comme le fait PASSPORT : 3 à 12 caractères
  // alphanumériques dont AU MOINS UN CHIFFRE. La prose ne la satisfait jamais, un vrai code
  // toujours. Mesuré : 0 faux positif sur les 155 phrases, 6/6 vrais codes attrapés.
  // Le marqueur « code » NU est délibérément absent : 48 des 155 phrases le contiennent
  // (code postal, code EGID, Code des obligations…) et « Code : 1201 » — un code postal
  // genevois — est indiscernable d'un secret par la seule forme.
  //
  // DEUX GARDE-FOUS, appris d'une régression attrapée en revue :
  //  1. le lookahead « au moins un chiffre » est borné à la MÊME classe que la valeur
  //     ([0-9A-Za-z*#-]* et non [^ \t]*). Avec [^ \t]*, le lookahead TRAVERSAIT un deux-points :
  //     sur « Code d'accès : mdp:Hunter2024 » il validait « mdp » comme un code, ACCESS_CODE
  //     avalait le marqueur de PASSWORD, et le mot de passe partait EN CLAIR — exactement la
  //     classe de panne que ce tableau documente ;
  //  2. ACCESS_CODE passe APRÈS PASSWORD, si bien qu'un marqueur de mot de passe est de toute
  //     façon consommé en premier. Défense en profondeur : chacun des deux suffit.
  //
  // « le passe » (le passe-partout suisse) est admis, mais SEULEMENT précédé d'un déterminant.
  // C'est ce qui distingue le NOM du VERBE, homographe qui avait justifié de retirer « passe »
  // de PASSWORD : « ce qui se passe : … » et « je te le passe : … » n'ont pas de déterminant
  // collé au mot, et leur valeur est de la prose. Mesuré sur 155 phrases de corpus + 12 pièges
  // construits exprès (verbe, pronom objet, valeurs numériques après pronom) : 0 faux positif,
  // 5/5 vrais passes attrapés.
  {
    kind: 'ACCESS_CODE',
    pattern: /\b(?:digicode|code[\s-]?pin|(?:l[ea]|mon|ton|son|votre|notre|un)\s+passe|code\s+(?:d['’]acc[èe]s|secret|wifi|(?:du|de\s+la|de|des)\s+(?:portail|bo[îi]te\s+[àa]\s+cl[ée]s|parking|immeuble)))[ \t]*[:=][ \t]*((?=[0-9A-Za-z*#-]{3,12}\b)(?=[0-9A-Za-z*#-]*\d)[0-9A-Za-z*#-]{3,12})\b/gi,
  },
]

/**
 * Redacte les PII dans un texte libre.
 *
 * @param text Texte source (email, SMS, message libre)
 * @returns Texte avec marqueurs [REDACTED:KIND] + compteurs par catégorie
 *
 * @example
 * redactPII("AVS 756.1234.5678.90, mdp: secret123")
 * // → { redactedText: "AVS [REDACTED:AVS], [REDACTED:PASSWORD]",
 * //     counts: { AVS: 1, PASSWORD: 1, ... }, total: 2 }
 */
export function redactPII(text: string): RedactionResult {
  const counts: Record<RedactionKind, number> = {
    AVS: 0, IBAN: 0, CARD: 0, PASSPORT: 0, PASSWORD: 0, API_KEY: 0, DOB: 0, ACCESS_CODE: 0, TOKEN: 0,
  }

  let out = text

  for (const { kind, pattern } of PATTERNS) {
    out = out.replace(pattern, () => {
      counts[kind]++
      return `[REDACTED:${kind}]`
    })
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  return { redactedText: out, counts, total }
}

/**
 * Helper pour générer un résumé compact des redactions, à logger dans
 * activity_events.metadata.
 *
 * @example formatRedactionSummary({ AVS: 1, IBAN: 0, PASSWORD: 2, ... })
 *          // → "AVS×1, PASSWORD×2"
 */
export function formatRedactionSummary(counts: Record<RedactionKind, number>): string {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}×${n}`)
    .join(', ')
}
