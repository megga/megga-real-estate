// Composition PURE du préfixe stable du system prompt de l'agent WhatsApp — extraite de
// whatsapp-agent/index.ts pour la rendre TESTABLE en vitest (les Edge Functions échappent à
// tsc/vitest ; la discipline maison = logique pure dans _shared + test). Sortie BYTE-IDENTIQUE
// au literal d'origine : l'ordre et les séparateurs sont figés ici.
//
// Le GARDE-FOU NBA (anti-initiative, cf. NBA_PROMPT_GUARDRAIL) est BAKED-IN en queue, PAS un
// paramètre : l'appelant ne peut donc pas le retirer sans toucher ce module, et un test dédié
// (agent-system-prompt.test.ts) garde sa présence. C'est ce qui empêche le garde-fou compliance
// de disparaître silencieusement avec une CI verte.

import { NBA_PROMPT_GUARDRAIL } from './contact-nba.ts'

export interface AgentSystemPromptParts {
  /** Persona de base (const SYSTEM). */
  system: string
  /** Bloc de style maison (MEGGA_STYLE_BLOCK). */
  styleGuide: string
  /** Style appris de l'agent — conditionnel, '' si inactif. */
  learnedStyle: string
  /** Voix de l'agence (few-shot) — conditionnel, '' si < 2 exemples. */
  voice: string
  /** Corrections passées (few-shot) — conditionnel, '' si aucune. */
  corrections: string
  /** Consigne comportement groupe. */
  group: string
  /** Consigne descriptif d'annonce. */
  listing: string
  /** Garde anti-fabrication. */
  antiFab: string
}

/** Assemble le préfixe STABLE du system message (hors suffixe horodaté, ajouté par l'appelant
 *  après, pour préserver le cache de préfixe DeepSeek). Le garde-fou NBA est ajouté en dernier,
 *  de façon inconditionnelle. Sortie identique au literal historique de whatsapp-agent/index.ts. */
export function composeAgentSystemPrompt(p: AgentSystemPromptParts): string {
  const nbaGuardrailBlock = `\n\n${NBA_PROMPT_GUARDRAIL}`
  return `${p.system}\n\nConvertis toute date relative en ISO 8601 avec le décalage de Genève (+02:00 en été, +01:00 en hiver), en te basant sur la date/heure actuelle indiquée en toute fin de ce message.\n\nLangue : réponds TOUJOURS dans la langue du dernier message de l'agent (français ou anglais). Ne mélange pas les langues.\n\n${p.styleGuide}${p.learnedStyle}${p.voice}${p.corrections}${p.group}${p.listing}${p.antiFab}${nbaGuardrailBlock}`
}
