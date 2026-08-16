/**
 * Page publique de préférences d'e-mail — route `/desinscription?t=<jeton>`.
 *
 * C'est la page qu'on atteint en cliquant « Se désinscrire » au bas d'un e-mail.
 *
 * ⛔ POURQUOI ELLE EST DANS LA SPA ET NON DANS L'EDGE FUNCTION. `email-unsubscribe` rendait
 * — et rend toujours — du `text/plain`, parce que la passerelle Supabase RÉÉCRIT tout
 * `text/html` en `text/plain` sur le domaine par défaut `<ref>.supabase.co` et y ajoute une
 * CSP `sandbox` (mesuré le 15.08.2026, documenté chez eux : « Serving of HTML content is only
 * supported with custom domains »). La personne recevait donc une page légalement exigée en
 * texte brut. La SPA, elle, sert du HTML sans contrainte.
 *
 * ⚠ ET C'EST POURQUOI IL Y A DEUX URL, PAS UNE. L'en-tête `List-Unsubscribe` continue de
 * pointer sur l'edge, parce que le POST « one-click » (RFC 8058) est ce que Gmail et Outlook
 * appellent depuis leur propre bouton ; seul le LIEN VISIBLE du pied de page mène ici.
 * ⛔ Le piège déjà payé le 15.08 : pointer le lien sur la SPA SANS que la route existe faisait
 * rendre la coquille de l'app en 200, et aucune ligne n'était écrite — la personne lisait
 * « c'est fait » alors que rien ne l'était. La route doit exister avant la bascule.
 *
 * ⚠ AUCUN COMPTE, AUCUNE SESSION : le jeton signé porte l'adresse. Un jeton EXPIRÉ reste
 * accepté — ce lien vit dans un e-mail qu'on relit des mois plus tard, et répondre « lien
 * expiré » à qui demande qu'on le laisse tranquille est un refus déguisé.
 */
import { useEffect, useState } from 'react'
// ⚠ DEUX familles de jetons, et la séparation est voulue : `MLK` porte la DIRECTION
// (surfaces, encre, police), `MLK_STATUT` porte ce qui ENCODE un état (erreur, succès) —
// la direction ne gouverne pas le sens. Ne pas les fusionner.
import { MLK, MLK_STATUT } from '@/components/kyc-magic-link/mlkTokens'
import { SUPABASE_FUNCTIONS_URL } from '@/lib/supabase'
import { DESINSCRIPTION_COPIE, type LangueDesinscription } from './desinscriptionCopie'

/** Les natures refusables. Le transactionnel n'en est pas : il répond à un geste. */
const NATURES = ['relance', 'bien', 'rappel'] as const
type Nature = (typeof NATURES)[number]

/**
 * ⛔ PAR LA CONSTANTE PARTAGÉE, JAMAIS PAR `import.meta.env` EN DIRECT.
 *
 * Cette page lisait `import.meta.env.VITE_SUPABASE_URL` elle-même. Mesuré au banc le
 * 16.08.2026 : la variable est absente en développement, l'URL devenait donc
 * `undefined/functions/v1/email-preferences`, le `fetch` échouait, et la page affichait
 * « Ce lien n'est plus valide » — c'est-à-dire qu'une page légalement exigée annonçait à la
 * personne que son lien était mort alors que le sien était bon.
 *
 * `SUPABASE_FUNCTIONS_URL` porte le même env AVEC son repli en dur (`supabase.ts:29`), qui
 * est ce que tout le reste de l'app utilise. Réécrire la constante, c'était en perdre le filet.
 */
const EDGE = `${SUPABASE_FUNCTIONS_URL}/email-preferences`

/** Ramène une langue déclarée aux quatre du produit. Une table, jamais un ternaire. */
function langue(l: string | null | undefined): LangueDesinscription {
  return l === 'de' || l === 'en' || l === 'it' ? l : 'fr'
}

type Etat =
  | { phase: 'chargement' }
  | { phase: 'invalide' }
  | { phase: 'pret'; bloquees: Set<Nature>; tout: boolean }
  | { phase: 'enregistre' }
  | { phase: 'erreur' }

export default function DesinscriptionPage() {
  const jeton = new URLSearchParams(window.location.search).get('t') ?? ''
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })
  const [lg, setLg] = useState<LangueDesinscription>('fr')
  const [envoi, setEnvoi] = useState(false)
  const t = DESINSCRIPTION_COPIE[lg]

  // La langue vient du CONTACT (rendue par l'edge), jamais du navigateur de qui clique.
  useEffect(() => {
    document.documentElement.lang = lg
  }, [lg])

  useEffect(() => {
    if (!jeton) { setEtat({ phase: 'invalide' }); return }
    let vivant = true
    void (async () => {
      try {
        const r = await fetch(`${EDGE}?t=${encodeURIComponent(jeton)}`)
        if (!r.ok) throw new Error('jeton')
        const d = await r.json() as { locale?: string | null; allBlocked?: boolean; blocked?: string[] }
        if (!vivant) return
        setLg(langue(d.locale))
        setEtat({
          phase: 'pret',
          tout: !!d.allBlocked,
          bloquees: new Set((d.blocked ?? []).filter((x): x is Nature => (NATURES as readonly string[]).includes(x))),
        })
      } catch {
        if (vivant) setEtat({ phase: 'invalide' })
      }
    })()
    return () => { vivant = false }
  }, [jeton])

  const enregistrer = async () => {
    if (etat.phase !== 'pret' || envoi) return
    setEnvoi(true)
    try {
      const r = await fetch(`${EDGE}?t=${encodeURIComponent(jeton)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: etat.tout, blocked: [...etat.bloquees] }),
      })
      if (!r.ok) throw new Error('ecriture')
      setEtat({ phase: 'enregistre' })
    } catch {
      setEtat({ phase: 'erreur' })
    } finally {
      setEnvoi(false)
    }
  }

  const basculer = (n: Nature) => {
    if (etat.phase !== 'pret') return
    const s = new Set(etat.bloquees)
    if (s.has(n)) s.delete(n); else s.add(n)
    // Décocher une case sort forcément du refus total : les deux ne peuvent pas coexister.
    setEtat({ ...etat, bloquees: s, tout: false })
  }

  const basculerTout = () => {
    if (etat.phase !== 'pret') return
    const tout = !etat.tout
    setEtat({ ...etat, tout, bloquees: tout ? new Set(NATURES) : new Set() })
  }

  return (
    <div style={{ minHeight: '100vh', background: MLK.bgGradient, fontFamily: MLK.font,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--crm-space-3xl)' }}>
      <main style={{ width: '100%', maxWidth: 560, background: MLK.card, borderRadius: 'var(--crm-radius-3xl)',
        border: `1px solid ${MLK_STATUT.starOff}`, boxShadow: MLK.shadow, padding: 'var(--crm-space-5xl) var(--crm-space-4xl)' }}>

        {etat.phase === 'chargement' && (
          <p style={{ margin: 0, color: MLK.muted, fontSize: 'var(--crm-text-xl)' }}>{t.T20}</p>
        )}

        {etat.phase === 'invalide' && (
          <>
            <h1 style={{ margin: '0 0 var(--crm-space-md)', fontSize: 'var(--crm-text-4xl)', fontWeight: 600, color: MLK.ink }}>{t.T17}</h1>
            <p style={{ margin: 0, color: MLK.inkSoft, fontSize: 'var(--crm-text-xl)', lineHeight: 1.6 }}>{t.T18}</p>
          </>
        )}

        {etat.phase === 'erreur' && (
          <>
            <h1 style={{ margin: '0 0 var(--crm-space-md)', fontSize: 'var(--crm-text-4xl)', fontWeight: 600, color: MLK_STATUT.errInk }}>{t.T15}</h1>
            <p style={{ margin: 0, color: MLK.inkSoft, fontSize: 'var(--crm-text-xl)', lineHeight: 1.6 }}>{t.T16}</p>
          </>
        )}

        {etat.phase === 'enregistre' && (
          <>
            <h1 style={{ margin: '0 0 var(--crm-space-md)', fontSize: 'var(--crm-text-4xl)', fontWeight: 600, color: MLK_STATUT.okInk }}>{t.T13}</h1>
            <p style={{ margin: '0 0 var(--crm-space-4xl)', color: MLK.inkSoft, fontSize: 'var(--crm-text-xl)', lineHeight: 1.6 }}>{t.T14}</p>
            <p style={{ margin: 0, color: MLK.muted, fontSize: 'var(--crm-text-md)', lineHeight: 1.6 }}>{t.T19}</p>
          </>
        )}

        {etat.phase === 'pret' && (
          <>
            <h1 style={{ margin: '0 0 var(--crm-space-sm)', fontSize: 'var(--crm-text-4xl)', fontWeight: 600, color: MLK.ink }}>{t.T1}</h1>
            <p style={{ margin: '0 0 var(--crm-space-6xl)', color: MLK.inkSoft, fontSize: 'var(--crm-text-xl)', lineHeight: 1.6 }}>{t.T2}</p>

            {([['relance', t.T3, t.T4], ['bien', t.T5, t.T6], ['rappel', t.T7, t.T8]] as const).map(
              ([n, titre, aide]) => (
                <Choix key={n} coche={etat.bloquees.has(n)} onChange={() => basculer(n)} titre={titre} aide={aide} />
              ),
            )}

            <div style={{ height: 1, background: MLK_STATUT.starOff, margin: 'var(--crm-space-4xl) 0' }} />
            <Choix coche={etat.tout} onChange={basculerTout} titre={t.T9} aide={t.T10} />

            <p style={{ margin: 'var(--crm-space-6xl) 0 0', padding: 'var(--crm-space-lg) var(--crm-space-xl)', background: MLK.cardSubtle,
              borderRadius: 'var(--crm-radius-lg)', color: MLK.muted, fontSize: 'var(--crm-text-md)', lineHeight: 1.6 }}>{t.T11}</p>

            <button onClick={enregistrer} disabled={envoi}
              style={{ marginTop: 'var(--crm-space-3xl)', width: '100%', height: 48, border: 0, borderRadius: 'var(--crm-radius-lg)',
                background: MLK.accent, color: '#fff', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)',
                fontWeight: 600, cursor: envoi ? 'default' : 'pointer', opacity: envoi ? 0.6 : 1 }}>
              {t.T12}
            </button>

            <p style={{ margin: 'var(--crm-space-3xl) 0 0', color: MLK.muted, fontSize: 'var(--crm-text-sm)', lineHeight: 1.6 }}>{t.T19}</p>
          </>
        )}
      </main>
    </div>
  )
}

/** Une case et son explication. Cocher = REFUSER cette nature. */
function Choix({ coche, onChange, titre, aide }: { coche: boolean; onChange: () => void; titre: string; aide: string }) {
  return (
    <label style={{ display: 'flex', gap: 'var(--crm-space-md)', alignItems: 'flex-start', padding: 'var(--crm-space-md) 0', cursor: 'pointer' }}>
      <input type="checkbox" checked={coche} onChange={onChange}
        style={{ width: 18, height: 18, marginTop: 'var(--crm-space-2xs)', accentColor: MLK.accent, flexShrink: 0, cursor: 'pointer' }} />
      <span>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: MLK.ink }}>{titre}</span>
        <span style={{ display: 'block', marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: MLK.muted, lineHeight: 1.55 }}>{aide}</span>
      </span>
    </label>
  )
}
