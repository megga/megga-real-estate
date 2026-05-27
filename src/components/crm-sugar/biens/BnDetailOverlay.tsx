// MEGGA CRM Sugar v2 — Détail bien overlay (full-screen)
// 1:1 port from `crm-screen-biens-sugar.jsx` (BnDetailOverlay).

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import CRMIcon, { type CrmIconName } from '../CRMIcon'
import { crmContactById, type CrmBien } from '../mockData'
import { crmInitials, type SugarPalette } from '../tokens'
import { bnFmtCHF, bnFmtDate, bnRelative, bnStatus } from './helpers'
import { BnPhoto } from './BnPhoto'

// Types pour matches + history affichés dans les onglets "Demandes" et
// "Historique". Les arrays sont vides en attendant le wire backend :
//   - matches  : chip — query contact_matches (ou RPC) by bien_id
//   - history  : chip — query activity_events filter entity_type='property'
//                + entity_id = bien.id (timeline réelle des actions agent)
// L'UI gère déjà l'empty state ("Aucune demande / Aucun événement").
interface BienMatch {
  contactId: string
  bienId: string
  score: number
  status: string
}
interface BienHistoryEntry {
  text: string
  at: string
}

type DetailTab = 'infos' | 'perf' | 'demand' | 'history'

interface BnDetailOverlayProps {
  bien: CrmBien
  onClose: () => void
  sp: SugarPalette
  dark: boolean
}

export function BnDetailOverlay({ bien, onClose, sp, dark }: BnDetailOverlayProps) {
  const owner = bien.ownerContactId ? crmContactById(bien.ownerContactId) : null
  const meta = bnStatus(bien.status)
  const isRent = bien.transaction === 'location'
  const priceLabel = isRent
    ? bien.rent
      ? bnFmtCHF(bien.rent) + '/mois'
      : '—'
    : bien.price
      ? bnFmtCHF(bien.price)
      : '—'
  const ppm2 = bien.price && bien.area ? Math.round(bien.price / bien.area) : null
  // Arrays vides : pas de mock CRM_MATCHES / CRM_BIEN_HISTORY. Wire backend
  // chip — cf. commentaire en haut du fichier.
  const matches: BienMatch[] = []
  const history: BienHistoryEntry[] = []

  const [tab, setTab] = useState<DetailTab>('infos')
  const tabs: { id: DetailTab; label: string; count?: number }[] = [
    { id: 'infos', label: "Vue d'ensemble" },
    { id: 'perf', label: 'Performance', count: bien.stats?.views || 0 },
    { id: 'demand', label: 'Demandes', count: matches.length },
    { id: 'history', label: 'Historique', count: history.length },
  ]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: sp.pageBg,
        overflowY: 'auto',
        animation: 'bnDetailIn .2s ease-out',
      }}
    >
      {/* Top bar */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          padding: '16px 32px',
          background: dark ? 'rgba(15,23,42,0.85)' : 'rgba(238,241,245,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${sp.cardBorder}`,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <button
          onClick={onClose}
          style={{
            height: 36,
            padding: '0 14px',
            borderRadius: 999,
            background: 'transparent',
            border: `1px solid ${sp.cardBorder}`,
            color: sp.ink,
            fontFamily: 'inherit',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M7.5 2.5L4 6l3.5 3.5"
              stroke={sp.ink}
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Retour aux biens
        </button>
        <span
          style={{
            fontSize: 11.5,
            color: sp.sub,
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {bien.ref}
        </span>
        <div style={{ flex: 1 }} />
        <button
          style={{
            height: 36,
            padding: '0 14px',
            borderRadius: 999,
            background: 'transparent',
            border: `1px solid ${sp.cardBorder}`,
            color: sp.ink,
            fontFamily: 'inherit',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <CRMIcon name="file" size={12} stroke={sp.ink} />
          Modifier
        </button>
        <button
          style={{
            height: 36,
            padding: '0 14px',
            borderRadius: 999,
            background: 'transparent',
            border: `1px solid ${sp.cardBorder}`,
            color: '#E53935',
            fontFamily: 'inherit',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Supprimer
        </button>
        <button
          style={{
            height: 36,
            padding: '0 18px',
            borderRadius: 999,
            background: sp.ink,
            color: sp.pageBg,
            border: 0,
            fontFamily: 'inherit',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: sp.focusShadow,
          }}
        >
          {bien.status === 'draft' ? 'Publier' : 'Mettre à jour'}
        </button>
      </header>

      {/* Contenu */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 80px' }}>
        {/* Hero */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            gap: 32,
            marginBottom: 40,
          }}
        >
          <motion.div
            // Shared element target — receives the photo growing from BnRow's
            // 96×72 thumbnail via shared `layoutId`. The overlay mounts when
            // openBien is set; framer-motion measures both bounding boxes and
            // interpolates the photo with spring physics.
            layoutId={`crm-bien-photo-${bien.id}`}
            style={{
              position: 'relative',
              aspectRatio: '4/3',
              borderRadius: 20,
              overflow: 'hidden',
              border: `1px solid ${sp.cardBorder}`,
            }}
          >
            <BnPhoto
              id={bien.id}
              sp={sp}
              w="100%"
              h="100%"
              signed={bien.signedPhotoCount === bien.photoCount}
            />
            {bien.photoCount > 1 && (
              <span
                style={{
                  position: 'absolute',
                  right: 14,
                  bottom: 14,
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: 'rgba(15,23,42,0.7)',
                  color: '#fff',
                  fontSize: 11.5,
                  fontWeight: 600,
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <CRMIcon name="eye" size={12} stroke="#fff" />
                Voir les {bien.photoCount} photos
              </span>
            )}
          </motion.div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 14,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 12px',
                  borderRadius: 999,
                  background: meta.bg,
                  color: meta.color,
                  letterSpacing: 0.3,
                }}
              >
                ● {meta.label}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '4px 12px',
                  borderRadius: 999,
                  background: sp.cardSubBg,
                  color: sp.soft,
                  border: `1px solid ${sp.cardBorder}`,
                }}
              >
                {isRent ? 'Location' : 'Vente'}
              </span>
              {bien.mandat?.type === 'exclusif' && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '4px 12px',
                    borderRadius: 999,
                    background: 'rgba(0,65,217,.12)',
                    color: '#0041D9',
                  }}
                >
                  Mandat exclusif
                </span>
              )}
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 36,
                fontWeight: 800,
                color: sp.ink,
                letterSpacing: -1.2,
                lineHeight: 1.1,
              }}
            >
              {bien.title}
            </h1>
            <div
              style={{
                fontSize: 14,
                color: sp.soft,
                marginTop: 8,
                fontWeight: 500,
              }}
            >
              {bien.addr} · {bien.canton}
            </div>
            <div
              style={{
                fontSize: 40,
                fontWeight: 800,
                color: sp.ink,
                letterSpacing: -1.4,
                marginTop: 24,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {priceLabel}
            </div>
            {ppm2 && (
              <div
                style={{
                  fontSize: 12.5,
                  color: sp.sub,
                  marginTop: 4,
                  fontWeight: 600,
                }}
              >
                CHF {ppm2.toLocaleString('fr-CH').replace(/,/g, "'")}/m²
                {bien.charges && ` · + CHF ${bien.charges} charges`}
              </div>
            )}
            {/* Specs en grille */}
            <div
              style={{
                marginTop: 28,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 16,
                padding: '20px 0',
                borderTop: `1px solid ${sp.cardBorder}`,
                borderBottom: `1px solid ${sp.cardBorder}`,
              }}
            >
              {[
                { l: 'Surface', v: bien.area + ' m²' },
                { l: 'Pièces', v: String(bien.rooms) },
                { l: 'DPE', v: bien.energy || '—' },
                { l: 'Cham.', v: String(bien.beds) },
                { l: 'S. de bain', v: String(bien.baths) },
                { l: 'Année', v: String(bien.year) },
              ].map(s => (
                <div key={s.l}>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: sp.sub,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    {s.l}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      color: sp.ink,
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      marginTop: 4,
                    }}
                  >
                    {s.v}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            borderBottom: `1px solid ${sp.cardBorder}`,
            marginBottom: 28,
          }}
        >
          {tabs.map(tb => {
            const active = tab === tb.id
            return (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                style={{
                  padding: '12px 18px',
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? sp.ink : sp.sub,
                  borderBottom: `2px solid ${active ? sp.ink : 'transparent'}`,
                  marginBottom: -1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {tb.label}
                {tb.count != null && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 7px',
                      borderRadius: 999,
                      background: active ? sp.ink : sp.cardSubBg,
                      color: active ? sp.pageBg : sp.sub,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {tb.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Contenu onglet */}
        {tab === 'infos' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gap: 32,
            }}
          >
            <div>
              <h3
                style={{
                  margin: '0 0 12px',
                  fontSize: 16,
                  fontWeight: 700,
                  color: sp.ink,
                  letterSpacing: -0.3,
                }}
              >
                Mandat
              </h3>
              <div
                style={{
                  padding: '16px 18px',
                  background: sp.cardBg,
                  border: `1px solid ${sp.cardBorder}`,
                  borderRadius: 14,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 14,
                  }}
                >
                  {[
                    { l: 'Type', v: bien.mandat?.type || '—', cap: true },
                    {
                      l: 'Commission',
                      v: bien.mandat?.commission ? bien.mandat.commission + '%' : '—',
                      mono: true,
                    },
                    { l: 'Signé le', v: bnFmtDate(bien.mandat?.signedAt) },
                    { l: 'Expire le', v: bnFmtDate(bien.mandat?.expiresAt) },
                  ].map(item => (
                    <div key={item.l}>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: sp.sub,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: 0.4,
                        }}
                      >
                        {item.l}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          color: sp.ink,
                          fontWeight: item.cap ? 700 : 600,
                          marginTop: 2,
                          textTransform: item.cap ? 'capitalize' : 'none',
                          fontVariantNumeric: item.mono ? 'tabular-nums' : 'normal',
                        }}
                      >
                        {item.v}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <h3
                style={{
                  margin: '24px 0 12px',
                  fontSize: 16,
                  fontWeight: 700,
                  color: sp.ink,
                  letterSpacing: -0.3,
                }}
              >
                Diffusion
              </h3>
              <div
                style={{
                  padding: '6px 10px',
                  background: sp.cardBg,
                  border: `1px solid ${sp.cardBorder}`,
                  borderRadius: 14,
                }}
              >
                {(['MEGGA', 'Homegate', 'ImmoScout', 'Newhome'] as const).map(
                  (p, i, arr) => {
                    const on = (bien.publishedTo || []).includes(p)
                    return (
                      <div
                        key={p}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 8px',
                          borderBottom:
                            i < arr.length - 1 ? `1px solid ${sp.cardBorder}` : 0,
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: on ? '#0E9F6E' : sp.cardBorder,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 13,
                            color: on ? sp.ink : sp.sub,
                            fontWeight: 600,
                            flex: 1,
                          }}
                        >
                          {p}
                        </span>
                        <span
                          style={{
                            fontSize: 11.5,
                            color: sp.sub,
                            fontWeight: 500,
                          }}
                        >
                          {on ? 'Actif' : 'Non publié'}
                        </span>
                      </div>
                    )
                  },
                )}
              </div>
            </div>

            <div>
              <h3
                style={{
                  margin: '0 0 12px',
                  fontSize: 16,
                  fontWeight: 700,
                  color: sp.ink,
                  letterSpacing: -0.3,
                }}
              >
                Vendeur
              </h3>
              {owner ? (
                <div
                  style={{
                    padding: '16px 18px',
                    background: sp.cardBg,
                    border: `1px solid ${sp.cardBorder}`,
                    borderRadius: 14,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 999,
                        background: owner.avatarBg || '#0041D9',
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 700,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      {crmInitials(owner.firstName + ' ' + owner.lastName)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: sp.ink,
                        }}
                      >
                        {owner.firstName} {owner.lastName}
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: sp.sub,
                          marginTop: 2,
                        }}
                      >
                        {owner.email}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      style={{
                        flex: 1,
                        height: 32,
                        borderRadius: 8,
                        background: sp.ink,
                        color: sp.pageBg,
                        border: 0,
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <CRMIcon name="phone" size={11} stroke={sp.pageBg} />
                      Appeler
                    </button>
                    <button
                      style={{
                        flex: 1,
                        height: 32,
                        borderRadius: 8,
                        background: sp.cardSubBg,
                        color: sp.ink,
                        border: `1px solid ${sp.cardBorder}`,
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <CRMIcon name="mail" size={11} stroke={sp.ink} />
                      Email
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '20px',
                    background: sp.cardBg,
                    border: `1px dashed ${sp.cardBorder}`,
                    borderRadius: 14,
                    textAlign: 'center',
                    fontSize: 12.5,
                    color: sp.sub,
                  }}
                >
                  Aucun vendeur rattaché
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'perf' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
            }}
          >
            {(
              [
                { l: 'Vues', v: bien.stats?.views || 0, icon: 'eye', c: '#0041D9' },
                { l: 'Favoris', v: bien.stats?.favorites || 0, icon: 'star', c: '#F59E0B' },
                { l: 'Demandes', v: bien.stats?.visitRequests || 0, icon: 'home', c: '#0E9F6E' },
              ] as { l: string; v: number; icon: CrmIconName; c: string }[]
            ).map(k => (
              <div
                key={k.l}
                style={{
                  padding: '22px 24px',
                  background: sp.cardBg,
                  border: `1px solid ${sp.cardBorder}`,
                  borderRadius: 16,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <CRMIcon name={k.icon} size={13} stroke={k.c} />
                  <span
                    style={{
                      fontSize: 11,
                      color: sp.sub,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    {k.l}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: 800,
                    color: sp.ink,
                    letterSpacing: -1,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                  }}
                >
                  {k.v.toLocaleString('fr-CH').replace(/,/g, "'")}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'demand' && (
          <div
            style={{
              background: sp.cardBg,
              border: `1px solid ${sp.cardBorder}`,
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            {matches.length === 0 ? (
              <div
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  fontSize: 13,
                  color: sp.sub,
                }}
              >
                Aucune demande ni match pour ce bien.
              </div>
            ) : (
              matches.map((m, i) => {
                const c = crmContactById(m.contactId)
                if (!c) return null
                const dot = m.score >= 85 ? '#0E9F6E' : m.score >= 70 ? '#F59E0B' : '#E53935'
                return (
                  <div
                    key={`${m.contactId}-${m.bienId}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 18px',
                      borderBottom:
                        i < matches.length - 1 ? `1px solid ${sp.cardBorder}` : 0,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        background: c.avatarBg || '#0041D9',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {crmInitials(c.firstName + ' ' + c.lastName)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: sp.ink,
                        }}
                      >
                        {c.firstName} {c.lastName}
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: sp.sub,
                          marginTop: 1,
                          textTransform: 'capitalize',
                        }}
                      >
                        {m.status.replace('-', ' ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: dot,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          color: sp.ink,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {m.score}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {tab === 'history' && (
          <div
            style={{
              background: sp.cardBg,
              border: `1px solid ${sp.cardBorder}`,
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            {history.length === 0 ? (
              <div
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  fontSize: 13,
                  color: sp.sub,
                }}
              >
                Aucun événement enregistré.
              </div>
            ) : (
              [...history].reverse().map((a, i, arr) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                    padding: '16px 20px',
                    borderBottom: i < arr.length - 1 ? `1px solid ${sp.cardBorder}` : 0,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: sp.ink,
                      marginTop: 6,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: sp.ink, lineHeight: 1.5 }}>
                      {a.text}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: sp.sub,
                        marginTop: 4,
                        fontWeight: 500,
                      }}
                    >
                      {bnFmtDate(a.at)} · il y a {bnRelative(a.at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      <style>{`
        @keyframes bnDetailIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>,
    document.body,
  )
}
