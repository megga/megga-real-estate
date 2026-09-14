/**
 * La saisie des destinataires et le choix de la boîte d'envoi du composeur (Julien,
 * 14.09.2026 : « comme Google » — une adresse validée devient une capsule, on en pose
 * plusieurs, Cc et Cci, et la boîte d'envoi se choisit dans un déroulé).
 *
 * Pur, sans React : c'est la partie qui décide de ce qui PART, donc celle qui se teste
 * (`tests/unit/mail-destinataires.spec.ts`).
 */
import type { MailAccount } from '@/hooks/useMailAccounts'
import type { MailAddress } from './format'

/**
 * Le motif de `mail-send` (`isAddr`), à l'identique : l'écran n'accepte que ce que le
 * serveur accepte.
 *
 * ⛔ Plus lâche ici, une adresse mal tapée partirait au serveur — qui l'ÉCARTE en
 * silence (`addrList` filtre sans rien rendre). Le destinataire tombait de l'envoi, et
 * l'agent croyait l'avoir mis en copie.
 */
const ADRESSE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Vrai si `email` est une adresse que `mail-send` acceptera. */
export function adresseValide(email: string): boolean {
  return ADRESSE.test(email)
}

/**
 * Un destinataire saisi : « a@b.ch », « Nom <a@b.ch> », « "Rochat, Camille" <a@b.ch> »,
 * « mailto:a@b.ch ». `null` pour une saisie vide.
 *
 * ⚠ Une saisie qui n'est pas une adresse est rendue TELLE QUELLE, casse comprise : c'est
 * ce que l'agent a tapé, et c'est ce que la capsule en alerte doit lui montrer.
 */
export function lireDestinataire(brut: string): MailAddress | null {
  const s = brut.trim().replace(/^mailto:/i, '')
  if (!s) return null
  const m = s.match(/^(.*?)<([^<>]*)>$/)
  const nom = m ? m[1].trim().replace(/^"(.*)"$/, '$1').trim() : ''
  const adresse = (m ? m[2] : s).trim()
  return { name: nom || null, email: adresseValide(adresse.toLowerCase()) ? adresse.toLowerCase() : adresse }
}

/**
 * Une saisie ou un collage → ses destinataires. Séparateurs : virgule, point-virgule,
 * retour à la ligne, tabulation — et l'espace, entre des adresses nues seulement.
 *
 * ⚠ Les séparateurs ne comptent pas entre guillemets ni entre chevrons : le carnet
 * d'adresses d'Outlook écrit « "Rochat, Camille" <c@exemple.ch> », et couper à la
 * virgule en faisait deux capsules fausses.
 */
export function decouperDestinataires(saisie: string): MailAddress[] {
  return morceaux(saisie).flatMap((m) => {
    // « a@b.ch c@d.ch », collé d'un tableur : des adresses nues séparées par des espaces.
    const mots = m.trim().split(/\s+/)
    if (mots.length > 1 && !m.includes('<') && mots.every((x) => adresseValide(x.toLowerCase()))) {
      return mots.map((x) => ({ name: null, email: x.toLowerCase() }))
    }
    const a = lireDestinataire(m)
    return a ? [a] : []
  })
}

/**
 * Pendant la frappe : ce qui est COMPLET — suivi d'un séparateur — et ce qui reste à
 * taper. `null` tant qu'aucun séparateur n'est tapé : rien n'est encore à valider.
 */
export function scinderSaisie(saisie: string): { complets: MailAddress[]; reste: string } | null {
  const m = morceaux(saisie)
  if (m.length < 2) return null
  return { complets: decouperDestinataires(m.slice(0, -1).join('\n')), reste: m[m.length - 1].trimStart() }
}

/** Les morceaux d'une saisie, coupés aux séparateurs qui ne sont ni entre guillemets ni entre chevrons. */
function morceaux(saisie: string): string[] {
  const out: string[] = []
  let courant = ''
  let guillemets = false
  let chevrons = false
  for (const c of saisie) {
    if (c === '"' && !chevrons) guillemets = !guillemets
    else if (c === '<' && !guillemets) chevrons = true
    else if (c === '>' && !guillemets) chevrons = false
    if (!guillemets && !chevrons && /[,;\n\r\t]/.test(c)) {
      out.push(courant)
      courant = ''
      continue
    }
    courant += c
  }
  out.push(courant)
  return out
}

/**
 * Ajoute sans doublon — l'adresse fait l'identité, casse ignorée. Un nom qui arrive
 * après coup complète celui qui manquait : l'adresse tapée, puis choisie dans les
 * contacts, garde une capsule et prend le nom.
 */
export function ajouterDestinataires(liste: MailAddress[], ajouts: MailAddress[]): MailAddress[] {
  const out = [...liste]
  for (const a of ajouts) {
    const i = out.findIndex((x) => x.email.toLowerCase() === a.email.toLowerCase())
    if (i < 0) out.push(a)
    else if (!out[i].name && a.name) out[i] = { ...out[i], name: a.name }
  }
  return out
}

/**
 * Une boîte peut-elle ENVOYER ? `mail-send` refuse une boîte qui n'est pas `active`
 * (409 `account_not_active`). ⚠ Le fournisseur ne compte plus : IMAP envoie par SMTP depuis
 * le lot 3 — la règle d'avant éteignait toute boîte IMAP dans le « De », en silence.
 */
export function peutEnvoyerDepuis(boite: Pick<MailAccount, 'status'>): boolean {
  return boite.status === 'active'
}

/**
 * La boîte d'envoi par défaut : la première des `preferees` qui peut envoyer (le
 * brouillon rouvert, puis la boîte ouverte), sinon la première boîte qui le peut.
 *
 * ⚠ Si AUCUNE ne le peut, la préférée quand même, et non `null` : le « De » montre alors
 * la boîte et son motif (« Autorisation à renouveler »), là où un champ vide ne dirait
 * pas pourquoi « Envoyer » reste éteint.
 */
export function boiteDEnvoi(boites: MailAccount[], preferees: (string | null | undefined)[]): string | null {
  const connues = preferees.flatMap((id) => boites.filter((b) => b.id === id))
  return (connues.find(peutEnvoyerDepuis) ?? boites.find(peutEnvoyerDepuis) ?? connues[0] ?? boites[0])?.id ?? null
}
