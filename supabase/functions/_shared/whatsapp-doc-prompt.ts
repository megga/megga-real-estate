// Assemblage du prompt de lecture de document (outils read_document / file_document de
// l'agent WhatsApp). Extrait de whatsapp-actions.ts pour être PUR et donc testable : les
// edge functions Deno ne passent ni par tsc ni par vitest, si bien qu'un invariant qui vit
// dans une fonction non exportée ne peut pas être épinglé par un test.
//
// Invariant épinglé ici : « aucune PII sensible vers DeepSeek ». Ce site ferme la famille des
// fetchs DeepSeek autonomes de whatsapp-actions.ts (prepare_meeting, email, annonce, outils
// groupe) — ceux qui ne passent pas par le point d'étranglement de whatsapp-agent. L'OCR d'un
// mandat ou d'un relevé bancaire contient quasi certainement un IBAN ou un N° AVS.

import { redactPII } from './pii-redaction.ts'
import type { WaLang } from './whatsapp-i18n.ts'

/** L'OCR domine le coût en tokens ; la consigne de l'agent reste marginale. */
const OCR_CHARS = 8000
const FOCUS_CHARS = 300

/**
 * Construit le prompt de lecture de document envoyé à DeepSeek.
 *
 * PII : `ocrText` et `focus` sont rédigés AVANT troncature. L'ordre compte — un slice qui
 * coupe un IBAN en deux le rend invisible au pattern et en laisserait fuir la moitié.
 *
 * Le repli brut servi quand DeepSeek est indisponible ne passe pas par ici : il ne part pas dans
 * ce fetch, et son exposition au modèle — il remonte en résultat d'outil — est couverte par
 * redactLlmMessages côté whatsapp-agent.
 */
export function buildDocReadPrompt(p: { ocrText: string; focus: string | null; lang: WaLang }): string {
  const ocr = redactPII(p.ocrText).redactedText.slice(0, OCR_CHARS)
  const focusLine = p.focus
    ? `\nCONSIGNE de l'agent (priorise ça) : ${redactPII(p.focus).redactedText.slice(0, FOCUS_CHARS)}`
    : ''
  return (
    'Tu lis un document professionnel (souvent immobilier : mandat, relevé, courrier, attestation, pièce). ' +
    'À partir du TEXTE OCR ci-dessous, rends une lecture FIDÈLE et COMPACTE en ' +
    (p.lang === 'en' ? 'anglais' : 'français') + ' (quelques lignes, ~500 caractères max). Structure : ' +
    'type de document ; personnes / parties ; montants et chiffres clés ; dates / échéances ; objet en une phrase. ' +
    "N'invente RIEN : une info absente est OMISE ; une info partiellement lisible est suivie de « (à vérifier) ». " +
    'Pas de préambule, pas de formule commerciale.' + focusLine + '\n\nTEXTE OCR :\n' + ocr
  )
}
