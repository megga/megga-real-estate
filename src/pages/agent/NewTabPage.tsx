/**
 * NewTabPage — la page d'accueil d'un onglet NEUF (`/dashboard/nouvel-onglet`).
 *
 * ── POURQUOI ELLE EXISTE ─────────────────────────────────────────────────────
 * `ouvrirNouvel()` visait `/dashboard`, c'est-à-dire le cockpit « Aujourd'hui ».
 * Trois défauts, chacun suffisant :
 *
 *  1. **Elle contredit le modèle.** L'en-tête de `src/lib/crmTabs.ts` l'écrit en
 *     capitales : « UN ONGLET N'EST PAS UNE DESTINATION ». Un onglet porte un
 *     contexte de travail. Ouvrir un onglet neuf DIRECTEMENT sur une section en
 *     fait une destination, et deux onglets se mettent à revendiquer la même.
 *  2. **Elle allume une section.** `crmSidebarActiveFor('/dashboard')` rend
 *     `today` : la barre latérale annonçait « Aujourd'hui » pour un onglet où
 *     l'agent n'avait encore rien choisi.
 *  3. **Elle coûte un chargement qu'on n'a pas demandé.** Le cockpit tire
 *     l'agenda, les matchs et les relances. Un onglet vide ne doit rien réveiller.
 *
 * ── CE QU'ELLE FAIT, ET LE MODÈLE QU'ELLE SUIT ───────────────────────────────
 * Celui de la page d'accueil d'un navigateur : un champ qui prend le focus, et
 * les destinations sous la main. Rien d'autre — pas de donnée, pas de requête.
 *
 * ⛔ **ELLE NE REFAIT PAS LA RECHERCHE.** Le CRM en a déjà une, immersive et
 * branchée sur les contacts, les biens, les affaires et le copilote
 * (`CrmSearch`, ⌘K). Le champ d'ici n'est qu'une PORTE : la première frappe
 * ouvre la palette en lui passant la lettre tapée (`openCrmSearch(q)`), très
 * exactement ce que fait le champ de la page d'accueil de Chrome avec l'omnibox.
 * Écrire un second moteur ici aurait donné deux recherches à tenir d'accord.
 *
 * ⛔ **ET ELLE NE RECOPIE PAS LA LISTE DES SECTIONS.** La grille est rendue
 * depuis `CRM_SIDEBAR_GROUPS`, la table unique de navigation. C'est le motif
 * même pour lequel ce module a été écrit : vingt et un `switch` recopiés avaient
 * fini par diverger, et un cas manquant devenait un clic mort, silencieux. Une
 * douzième destination ajoutée à la barre apparaît ici sans qu'on y touche ; ce
 * qu'il reste à écrire est son sous-titre.
 *
 * ── LA NAVIGATION EST ORDINAIRE, ET C'EST VOULU ──────────────────────────────
 * Un clic sur une carte `navigate()` : l'onglet actif SUIT, comme un onglet de
 * navigateur suit ses liens (`appliquerNavigation`, useCrmTabs). L'onglet neuf
 * devient donc l'onglet de la destination choisie — il ne s'en ouvre pas un
 * second.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import { CRM_KEYFRAMES } from '@/components/crm/CrmShell'
import { RailIcon } from '@/components/crm/LiquidGlassRail'
import { CRM_SIDEBAR_GROUPS } from '@/components/crm/crmSidebarNav'
import { openCrmSearch } from '@/components/crm/search/openSearch'
import { crmPalette, type CrmPalette } from '@/components/crm/tokens'
import { CRM_DARK_KEY, readCrmDark } from '@/lib/crmDark'

/**
 * Largeur de la colonne de travail.
 *
 * ⚠ Accordée à la grille, pas choisie : trois cartes de 240 px et leurs deux
 * gouttières de 16 font 752 ; 760 laisse la troisième colonne respirer sans
 * qu'une quatrième puisse s'y glisser. Au-delà, les cartes s'étirent et la page
 * cesse de se lire d'un coup d'œil — c'est ce que la référence évite aussi.
 */
const COLONNE = 760

/**
 * Le libellé du raccourci de la palette, selon le clavier qu'on a sous les mains.
 *
 * ⚠ Lu UNE FOIS au chargement du module : la plateforme ne change pas en cours
 * de session, et le recalculer à chaque rendu ferait dépendre un affichage d'un
 * `navigator` qui n'existe pas au rendu serveur.
 */
const RACCOURCI_PALETTE = typeof navigator !== 'undefined'
  && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  ? '⌘K'
  : 'Ctrl K'

export default function NewTabPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()

  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return readCrmDark()
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CRM_DARK_KEY, dark ? '1' : '0')
    }
  }, [dark])

  const sp = crmPalette(dark)

  // ── Le relais vers la palette ──────────────────────────────────────────────
  // Le champ est un vrai `<input>` et non un bouton déguisé : on veut pouvoir
  // TAPER, pas cliquer d'abord. Mais il ne garde jamais sa valeur — dès la
  // première frappe la palette prend le relais avec ce qui vient d'être tapé,
  // et le champ se vide pour être prêt au retour.
  const champRef = useRef<HTMLInputElement>(null)
  const relayer = useCallback((q: string) => {
    openCrmSearch(q)
    if (champRef.current) champRef.current.value = ''
  }, [])

  return (
    <div style={{
      background: sp.pageBg,
      minHeight: '100vh',
      fontFamily: 'var(--crm-font), system-ui, sans-serif',
      color: sp.ink,
    }}>
      <style>{CRM_KEYFRAMES}</style>
      <div style={{ display: 'flex' }}>
        <CrmWorkspace sp={sp} dark={dark} setDark={setDark}>
          <main style={{
            flex: 1,
            minWidth: 0,
            padding: 'var(--crm-space-7xl) var(--crm-space-7xl) var(--crm-space-7xl) var(--crm-space-lg)',
            display: 'flex',
            justifyContent: 'center',
          }}>
            <div style={{
              width: '100%', maxWidth: COLONNE,
              // Respiration au-dessus du champ, comme la page d'accueil d'un
              // navigateur — mais UN CRAN DE L'ÉCHELLE, pas une valeur choisie à
              // l'œil. Un `clamp()` proportionnel a été essayé puis retiré : il
              // n'est sur aucun barreau, et la marge de manœuvre verticale ne le
              // justifie pas — sur un portable de 900 px la colonne mesure déjà
              // 786 px de haut, un décalage plus large ferait passer le dernier
              // groupe sous le pli.
              marginTop: 'var(--crm-space-7xl)',
            }}>

              {/* ── Le champ ──────────────────────────────────────────────── */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)',
                background: sp.cardBg,
                border: `1px solid ${sp.cardBorder}`,
                borderRadius: 'var(--crm-radius-pill)',
                boxShadow: sp.shadow,
                padding: '0 var(--crm-space-6xl)',
                height: 52,
                marginBottom: 'var(--crm-space-7xl)',
              }}>
                <span style={{ display: 'flex', color: sp.sub, flexShrink: 0 }}>
                  <RailIcon name="search" size={18} />
                </span>
                <input
                  ref={champRef}
                  // Chrome place le curseur dans le champ d'un onglet neuf ; c'est
                  // ce qui permet d'ouvrir un onglet et de taper sans viser.
                  autoFocus
                  type="text"
                  placeholder={t('newTab.searchPlaceholder')}
                  aria-label={t('newTab.searchPlaceholder')}
                  onChange={(e) => { const v = e.target.value; if (v) relayer(v) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') relayer(e.currentTarget.value) }}
                  style={{
                    flex: 1, minWidth: 0, border: 'none', outline: 'none',
                    background: 'transparent', color: sp.ink,
                    fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)',
                  }}
                />
                {/* ⚠ RIEN N'ENSEIGNAIT LE RACCOURCI — mesuré le 7 septembre 2026 :
                    aucune surface du CRM n'affiche « ⌘K », alors que la palette est
                    la première chose que fait un agent pressé. La pastille le dit là
                    où le geste se pose, et elle ne coûte pas un clic.
                    ⚠ `aria-hidden` : c'est un rappel visuel, pas une commande — le
                    champ porte déjà son propre libellé. */}
                <kbd aria-hidden style={{
                  flexShrink: 0, fontFamily: 'inherit',
                  fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.soft,
                  background: sp.kbdBg, border: `1px solid ${sp.cardBorder}`,
                  borderRadius: 'var(--crm-radius-xs)',
                  padding: '0 var(--crm-space-sm)', lineHeight: '18px',
                }}>{RACCOURCI_PALETTE}</kbd>
              </div>

              {/* ── Les destinations ──────────────────────────────────────── */}
              {CRM_SIDEBAR_GROUPS.map((groupe, i) => (
                <section key={groupe.labelKey} style={{
                  // Le dernier groupe ne traîne pas sa gouttière : elle coûtait
                  // 24 px au bas de page, et c'est exactement ce qui manquait
                  // pour tenir en entier sur un portable de 900 px.
                  marginBottom: i === CRM_SIDEBAR_GROUPS.length - 1 ? 0 : 'var(--crm-space-7xl)',
                }}>
                  {/* Sur-titre : la MÊME grammaire que les groupes de la barre
                      latérale (12 px / 600 / sourdine, pas de filet, pas de
                      capitale) — l'agent a déjà appris ce découpage à gauche. */}
                  <div style={{
                    fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub,
                    marginBottom: 'var(--crm-space-lg)',
                  }}>
                    {t(groupe.labelKey)}
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: 'var(--crm-space-2xl)',
                  }}>
                    {groupe.items.map((s) => (
                      <Destination
                        key={s.id}
                        sp={sp}
                        titre={t(s.labelKey)}
                        sousTitre={t(`newTab.hints.${s.id}`)}
                        onClick={() => navigate(s.route)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </main>
        </CrmWorkspace>
      </div>
    </div>
  )
}

/**
 * Une destination — du TEXTE, et rien d'autre.
 *
 * ⛔ ELLE ÉTAIT UNE CARTE : fond, bordure, rayon, ombre, glyphe. Retour de Julien
 * du 7 septembre 2026 — « retire les petits blocs, le plus épuré possible ». Sur
 * onze entrées, onze cadres font onze fois le même bruit : ils ne distinguent
 * rien, puisqu'aucune n'est plus importante qu'une autre, et ils occupent la
 * place que le libellé aurait mieux employée. Une page d'accueil d'onglet n'a
 * qu'un travail — laisser lire onze noms d'un coup d'œil.
 *
 * Le glyphe part avec le cadre, et pour le même motif : la barre latérale porte
 * déjà l'iconographie des sections, à trois cents pixels à gauche. La répéter
 * ici n'ajoute pas un repère, elle ajoute une colonne.
 *
 * ⚠ CE QUI REMPLACE LE CADRE COMME AFFORDANCE : le titre passe à l'accent au
 * survol. C'est l'idiome du lien, il ne coûte pas un pixel de chrome, et il ne
 * contredit pas la règle du 10 août (« l'élément ACTIF porte l'accent ») — rien
 * n'est actif ici, et le survol n'est pas un état, c'est un pointeur.
 *
 * ⚠ La zone CLIQUABLE, elle, reste pleine largeur et garde sa gouttière : sans
 * elle, on viserait deux lignes de texte hautes de 34 px.
 */
function Destination({ sp, titre, sousTitre, onClick }: {
  sp: CrmPalette; titre: string; sousTitre: string; onClick: () => void
}) {
  const [survol, setSurvol] = useState(false)
  const style: CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left',
    background: 'transparent', border: 0, borderRadius: 'var(--crm-radius-sm)',
    padding: 'var(--crm-space-sm)',
    // ⚠ Ramène le bloc à l'aplomb du sur-titre de son groupe : la gouttière de
    // confort ci-dessus le décalerait sinon vers la droite, et la colonne de
    // gauche cesserait d'être une colonne.
    marginLeft: 'calc(-1 * var(--crm-space-sm))',
    cursor: 'pointer', fontFamily: 'inherit',
  }
  return (
    <button
      type="button"
      style={style}
      onClick={onClick}
      onMouseEnter={() => setSurvol(true)}
      onMouseLeave={() => setSurvol(false)}
    >
      <span style={{
        display: 'block', fontSize: 'var(--crm-text-lg)', fontWeight: 600,
        color: survol ? sp.accent : sp.ink,
        marginBottom: 'var(--crm-space-2xs)',
        transition: 'color 120ms ease',
      }}>{titre}</span>
      <span style={{
        display: 'block', fontSize: 'var(--crm-text-md)', color: sp.sub,
        lineHeight: 1.35,
      }}>{sousTitre}</span>
    </button>
  )
}
