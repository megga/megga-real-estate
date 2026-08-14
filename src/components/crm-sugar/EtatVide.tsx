/**
 * L'état VIDE du CRM — un idiome unique, dérivé de la vitrine.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────
 * Mesuré le 16 août 2026 : le CRM écrivait ses états vides bloc par bloc, sans
 * composant partagé, et il en existait au moins TROIS grammaires — souvent dans
 * le même écran.
 *
 *  · « Aujourd'hui · la journée » : pastille ronde de 48 px sur `card`, glyphe
 *    22 px, titre `xl` en 600, corps `md` en 600 sur `sub`, colonne centrée.
 *  · `HlZoneEmpty`, deux blocs plus bas : pastille de 30 px sur fond VERT,
 *    coche, libellé `md` en 600, aligné à gauche.
 *  · Pipeline : carte flottante à ombre, rayon 22, titre `3xl`, corps `md` en
 *    500 sur `ink` (et non `sub`), bouton d'accent.
 *
 * Trois tailles de titre, deux graisses de corps, deux couleurs de corps, deux
 * alignements, et une pastille sur trois qui est colorée.
 *
 * ── CE QUE LA VITRINE FAIT, ET QU'ON REPREND TEL QUEL ────────────────────────
 * `megga-x-additions.css` porte déjà l'idiome du message (`.mx-notice`, point 16)
 * et sa règle est écrite noir sur blanc :
 *
 *     « La gravité passe par la COULEUR DU TITRE et rien d'autre. Pas de
 *       pastille, pas de liseré, pas de fond teinté : aucun n'existe dans la
 *       vitrine, et chacun aurait demandé d'inventer une géométrie que ce
 *       fichier s'interdit. »
 *
 * Les trois états vides du CRM font exactement les trois choses interdites. Et
 * `.mx-idcard` donne la géométrie du bloc centré : colonne, `text-align: center`,
 * et un glyphe dessiné sur `currentColor` — il HÉRITE de l'encre, il ne porte
 * pas la sienne.
 *
 * ── CE QU'ON NE REPREND PAS, ET POURQUOI ─────────────────────────────────────
 * ⛔ PAS LES VALEURS DE LA VITRINE. Ses teintes de système sont réglées pour un
 * canvas `#030303` et elles ÉCHOUENT toutes en encre sur une carte claire —
 * mesuré : jaune 1,67:1 · bleu 2,47 · rouge 3,11 · vert 1,88. La vitrine est
 * mono-thème ; le CRM ne l'est pas. On garde sa RÈGLE et on prend les barreaux
 * que le dépôt possède déjà par thème (`globals.css`, écrits en TRIPLETS RVB —
 * c'est pourquoi une première recherche en hexadécimal ne les avait pas
 * trouvés, et avait failli faire inventer un barreau).
 *
 * Mesures d'arrivée, encre sur la carte de son thème :
 *
 *   registre    clair                 sombre
 *   neutre      #686868  5,57:1       #a3a3a3  7,89:1
 *   à faire     #B45309  5,02:1       #FBBF24 11,93:1
 *   à jour      #047857  5,48:1       #34D399 10,36:1
 *   erreur      #B91C1C  6,47:1       #F87171  7,20:1
 *
 * ⚠ LES SIX VALEURS VIENNENT DE LA MÊME FEUILLE. Une première version prenait
 * le vert SOMBRE chez la vitrine (`MXC_SYSTEM.green400`) et le clair chez
 * `globals.css` : deux sources pour un seul rôle, ce qui rend la paire
 * indéfendable dès qu'une des deux bouge. La garde l'a dit avant l'écran.
 *
 * ⚠ LE REGISTRE « À JOUR » N'EST PAS UNE INVENTION, mais il ne vient pas de la
 * vitrine non plus — elle n'a que « à faire », « on attend » et « refusé ». Il
 * vient du CRM : `HlZoneEmpty` dit déjà « tu es à jour » avec sa coche verte.
 * Le retirer perdrait une information que l'agent reçoit aujourd'hui ; on le
 * garde donc, en le faisant porter par l'encre du titre comme les autres au
 * lieu d'une pastille.
 */
import type { ReactNode } from 'react'
import { crmSugarPalette } from './tokens'

/**
 * Ce que l'écran DIT, pas ce à quoi il ressemble.
 *
 * `neutre` — il n'y a rien, et c'est normal (une liste jamais remplie, un filtre
 * trop étroit). `aFaire` — il n'y a rien parce que l'agent a quelque chose à
 * faire. `aJour` — il n'y a rien parce que tout a été traité, ce qui est une
 * bonne nouvelle et mérite d'être lu comme telle. `erreur` — il n'y a rien parce
 * qu'on n'a PAS PU savoir : c'est un verdict, pas une étape, et la vitrine le
 * dit ainsi (`.mx-notice--refused`, « rouge, et lui seul »). Il entre ici parce
 * que plusieurs surfaces mêlent les trois états dans un seul bloc — « Mes biens »
 * écrit `isError ? … : isLoading ? … : vide` — et qu'on ne peut pas en migrer un
 * sans nommer les autres.
 */
export type RegistreVide = 'neutre' | 'aFaire' | 'aJour' | 'erreur'

/**
 * L'encre du titre par registre et par thème — la seule chose qui change d'un
 * registre à l'autre.
 *
 * ⚠ Les barreaux clairs viennent de `globals.css` (`--color-warning-dark`,
 * `--color-success-dark`), les sombres de la même feuille. Ils ne sont pas lus
 * en CSS ici parce qu'un `var()` ne se mesure pas depuis un test de source : les
 * figer permet à `etat-vide.spec.ts` de vérifier leur contraste, ce qu'une
 * indirection aurait rendu impossible — c'est la leçon de `tones.accent` sur la
 * console, une couleur qui n'existait qu'au rendu.
 */
const ENCRE: Record<RegistreVide, { clair: string; sombre: string }> = {
  neutre: { clair: '#686868', sombre: '#a3a3a3' },
  aFaire: { clair: '#B45309', sombre: '#FBBF24' },
  aJour: { clair: '#047857', sombre: '#34D399' },
  erreur: { clair: '#B91C1C', sombre: '#F87171' },
}

export interface EtatVideProps {
  /** Le glyphe. Il hérite de `currentColor` — ne pas lui donner de couleur. */
  glyphe?: ReactNode
  titre: string
  /**
   * Une phrase, pas un paragraphe : ce qui manque, et quoi faire le cas échéant.
   *
   * ⚠ `ReactNode` et non `string` — certaines surfaces passent par `<Trans>`
   * avec un saut de ligne dans la traduction. Exiger une chaîne aurait laissé
   * ces états vides dehors, ou fait perdre leur mise en ligne.
   */
  corps?: ReactNode
  registre?: RegistreVide
  /** L'appel à l'action, s'il y en a un. Il porte l'accent, comme partout. */
  action?: { libelle: string; onClick: () => void }
  dark: boolean
  /**
   * `bloc` occupe la place qu'on lui laisse et se centre dedans (une colonne, un
   * panneau). `ligne` se pose dans le fil, aligné à gauche, sans glyphe agrandi
   * — c'est le cas de `HlZoneEmpty`, qui vit entre deux cartes.
   */
  forme?: 'bloc' | 'ligne'
}

/**
 * ⚠ AUCUNE OMBRE, AUCUN FOND, AUCUN LISERÉ. Le vide n'est pas un objet posé sur
 * la surface : c'est la surface elle-même qui n'a rien à montrer. Lui donner une
 * carte, comme le Pipeline le fait aujourd'hui, en fait un CONTENU — et un
 * contenu qui dit qu'il n'y a pas de contenu.
 */
export default function EtatVide({
  glyphe, titre, corps, registre = 'neutre', action, dark, forme = 'bloc',
}: EtatVideProps) {
  const sp = crmSugarPalette(dark)
  const encre = ENCRE[registre][dark ? 'sombre' : 'clair']
  const ligne = forme === 'ligne'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: ligne ? 'row' : 'column',
        alignItems: 'center',
        // ⚠ Une LIGNE ne se centre pas dans la place qu'on lui laisse : elle se
        // pose en tête du fil, là où le contenu absent aurait commencé. Vu à
        // l'écran — centrée, elle flottait au milieu d'un bloc vide et se lisait
        // comme un message d'erreur au lieu d'un état.
        justifyContent: ligne ? 'flex-start' : 'center',
        textAlign: ligne ? 'left' : 'center',
        gap: ligne ? 'var(--crm-space-lg)' : 'var(--crm-space-md)',
        padding: ligne ? 'var(--crm-space-lg) var(--crm-space-xl)' : 'var(--crm-space-4xl)',
        ...(ligne ? { alignSelf: 'flex-start' } : { flex: 1, minHeight: 0 }),
      }}
    >
      {glyphe && (
        // `line-height: 0` — sans ça un SVG en flux laisse une bande fantôme
        // sous lui, parce qu'il s'aligne sur la ligne de base du texte. C'est
        // la note de `.mx-idcard__glyph`, reprise telle quelle.
        <span aria-hidden style={{ color: encre, lineHeight: 0, flexShrink: 0 }}>{glyphe}</span>
      )}
      <div>
        <div style={{
          fontSize: ligne ? 'var(--crm-text-md)' : 'var(--crm-text-xl)',
          fontWeight: 500,
          letterSpacing: ligne ? undefined : -0.3,
          color: encre,
        }}>{titre}</div>
        {corps && (
          <div style={{
            fontSize: 'var(--crm-text-md)',
            fontWeight: 400,
            color: sp.sub,
            lineHeight: 1.5,
            marginTop: ligne ? 2 : 'var(--crm-space-xs)',
            // Une mesure de lecture, pas une largeur de boîte : au-delà, l'œil
            // perd la ligne suivante.
            maxWidth: '34ch',
          }}>{corps}</div>
        )}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            style={{
              marginTop: 'var(--crm-space-xl)',
              height: 38, padding: '0 var(--crm-space-4xl)',
              borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer',
              background: sp.accent, color: sp.accentInk,
              fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
            }}
          >{action.libelle}</button>
        )}
      </div>
    </div>
  )
}
