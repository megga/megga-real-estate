// Pseudonymisation des noms de contacts avant tout envoi au LLM — module PUR
// (zéro I/O, zéro Deno), testable vitest.
//
// Pourquoi : le briefing matinal (et le digest) assemblent SERVEUR un snapshot
// riche (priorités, rappels) qui contient des noms de clients. DeepSeek étant
// hors-UE, on ne lui envoie JAMAIS un nom : on substitue chaque nom par un jeton
// stable {{C1}} À L'ASSEMBLAGE, on génère, puis on RE-SUBSTITUE le vrai nom
// APRÈS la réponse, côté edge. DeepSeek ne voit que des jetons ; l'agent voit ses
// vrais contacts. C'est ce qui résout la tension résidence PII pour le proactif.

export interface Pseudonymizer {
  /** Jeton stable pour un nom (même nom → même jeton). '' si nom vide. */
  tokenFor(name: string | null | undefined): string
  /** Remplace dans un texte libre tout nom DÉJÀ connu par son jeton (filet de
   *  sécurité pour les champs libres, ex. message d'un rappel). */
  scrub(text: string | null | undefined): string
  /** Re-substitue les jetons {{Cn}} par les vrais noms (tolérant aux espaces). */
  restore(text: string | null | undefined): string
  /** Nombre de noms distincts pseudonymisés. */
  size(): number
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function createPseudonymizer(): Pseudonymizer {
  const byName = new Map<string, string>() // clé = nom normalisé (minuscule) → jeton
  const byToken = new Map<string, string>() // jeton → nom original (1re casse vue)
  let n = 0

  const tokenFor = (name: string | null | undefined): string => {
    const raw = (name ?? '').trim()
    if (!raw) return ''
    const key = raw.toLowerCase()
    let tok = byName.get(key)
    if (!tok) {
      n++
      tok = `{{C${n}}}`
      byName.set(key, tok)
      byToken.set(tok, raw)
    }
    return tok
  }

  return {
    tokenFor,
    scrub(text) {
      if (!text) return text ?? ''
      let out = text
      // Noms les plus longs d'abord (« Jean Dupont » avant « Jean ») pour éviter
      // un remplacement partiel. Insensible à la casse.
      const names = [...byToken.values()].sort((a, b) => b.length - a.length)
      for (const name of names) {
        // ≥3 car. : le scrub est un filet (les noms sont déjà tokenisés via
        // tokenFor) ; un « nom » de 2 lettres sur-remplacerait des fragments
        // courants (« Le dossier »). Un vrai nom court reste couvert par tokenFor.
        if (name.length < 3) continue
        const tok = byName.get(name.toLowerCase())
        if (!tok) continue
        out = out.replace(new RegExp(escapeRegExp(name), 'gi'), tok)
      }
      return out
    },
    restore(text) {
      if (!text) return text ?? ''
      return text.replace(/\{\{\s*(C\d+)\s*\}\}/g, (m, id) => byToken.get(`{{${id}}}`) ?? m)
    },
    size() { return n },
  }
}
