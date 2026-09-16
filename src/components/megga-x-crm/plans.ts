/**
 * Les couleurs des TROIS FORMULES — Gratuit, Pro, Custom — et le nom affiché d'une formule
 * lue en base.
 *
 * ⚖ Julien, 16.09.2026 : « coloré, avec un dégradé, sans l'étoile ». Chaque formule porte un
 * dégradé à elle, le même sur la pastille du menu du profil et sur la tuile de sa carte dans
 * les réglages : on reconnaît sa formule à sa couleur, où qu'on la croise.
 *
 * ⛔ À CÔTÉ de `tokens.ts`, jamais dedans — même raison que `statut.ts` : ces teintes ENCODENT
 * une formule, ce ne sont pas des barreaux de la vitrine, et le cliquet doit les compter.
 *
 * ⚠ L'ENCRE BLANCHE PORTE LE NOM, donc les deux bouts de chaque dégradé la tiennent à l'AA
 * (texte de 11 px) : sarcelle 700 → 5,47:1, ciel 700 → 5,93:1 ; accent → 5,78:1, violet 600 →
 * 5,70:1 ; rose 700 → 6,04:1, pourpre 700 → 8,3:1. Un dégradé plus clair serait plus vif et
 * illisible sous le nom. Les trois restent dans la même famille froide — du bleu-vert au
 * pourpre, comme le fond de la facturation — : trois couleurs d'une même marque, pas trois
 * alertes (un orange ou un rouge se liraient comme un état).
 */

/** Les formules telles que l'écran les nomme (la base dit `starter` / `pro` / `entreprise`). */
export type FormuleAffichee = 'free' | 'pro' | 'custom'

export const FORMULE_DEGRADE: Record<FormuleAffichee, { de: string; a: string }> = {
  free: { de: '#0f766e', a: '#0369a1' },
  pro: { de: '#424bfb', a: '#7c3aed' },
  custom: { de: '#be185d', a: '#7e22ce' },
}

/** Le dégradé d'une formule, en diagonale — la lumière vient d'en haut à gauche. */
export function degradeFormule(f: FormuleAffichee): string {
  const { de, a } = FORMULE_DEGRADE[f]
  return `linear-gradient(135deg, ${de} 0%, ${a} 100%)`
}

/** `starter` → Gratuit, `entreprise` → Custom : les noms des cartes de la facturation. */
export function formuleDepuisBase(plan: string | null | undefined): FormuleAffichee {
  if (plan === 'pro') return 'pro'
  if (plan === 'entreprise') return 'custom'
  return 'free'
}
