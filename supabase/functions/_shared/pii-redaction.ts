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
 */
const PATTERNS: { kind: RedactionKind; pattern: RegExp }[] = [
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

  // Mot de passe explicite — capture la valeur après marker.
  // Cible "mot de passe: xxx", "password = xxx", "mdp xxx", "pwd: xxx".
  {
    kind: 'PASSWORD',
    pattern: /\b(?:password|mot[\s-]?de[\s-]?passe|mdp|pwd|passe)\s*[:=]\s*(\S+)/gi,
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
    AVS: 0, IBAN: 0, CARD: 0, PASSPORT: 0, PASSWORD: 0, API_KEY: 0, DOB: 0,
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
