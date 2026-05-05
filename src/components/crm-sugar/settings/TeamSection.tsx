// MEGGA CRM Sugar v2 — Settings Team & Roles section (Tier 3.k stub)
// 1:1 port from `crm-screen-settings-step2.jsx` (SettingsTeamSection + helpers + InviteModal).

import { useState, type CSSProperties } from 'react'
import {
  ConfirmModal,
  SectionHeader,
  SetBlackBtn,
  SetCard,
  SetGhostBtn,
  SetIcon,
  SetInput,
  StickySaveBar,
  Toast,
} from './atoms'
import { SET_PALETTE } from './data'

const SET = SET_PALETTE

type RoleId = 'owner' | 'admin' | 'agent' | 'assistant' | 'readonly'

interface RoleDef {
  label: string
  color: string
  desc: string
}

const ROLES: Record<RoleId, RoleDef> = {
  owner: {
    label: 'Propriétaire',
    color: '#7C3AED',
    desc: 'Accès complet, facturation, fermeture du compte.',
  },
  admin: {
    label: 'Admin',
    color: '#0B0C0E',
    desc: 'Gestion équipe, paramètres, tous les biens.',
  },
  agent: {
    label: 'Agent',
    color: '#0041D9',
    desc: 'Création de mandats, biens, contacts.',
  },
  assistant: {
    label: 'Assistant',
    color: '#0F766E',
    desc: 'Lecture + saisie limitée, pas de signature.',
  },
  readonly: {
    label: 'Lecture seule',
    color: '#7A8088',
    desc: 'Consulte uniquement les données partagées.',
  },
}

interface Member {
  id: string
  first: string
  last: string
  email: string
  role: RoleId
  bg: string
  initials: string
  status: 'active'
  joined: string
  lastSeen: string
}

const DEFAULT_TEAM: Member[] = [
  { id: 'u1', first: 'Gregory', last: 'Lyonnet', email: 'gregory@megga.ch', role: 'owner', bg: '#0041D9', initials: 'GL', status: 'active', joined: '2018-03-14', lastSeen: "À l'instant" },
  { id: 'u2', first: 'Élise', last: 'Mercier', email: 'elise@megga.ch', role: 'admin', bg: '#9F1239', initials: 'EM', status: 'active', joined: '2019-09-02', lastSeen: 'Il y a 12 min' },
  { id: 'u3', first: 'Antoine', last: 'Voirol', email: 'antoine@megga.ch', role: 'agent', bg: '#0F766E', initials: 'AV', status: 'active', joined: '2021-06-21', lastSeen: 'Il y a 2 h' },
  { id: 'u4', first: 'Camille', last: 'Bonnard', email: 'camille@megga.ch', role: 'agent', bg: '#7C3AED', initials: 'CB', status: 'active', joined: '2022-01-11', lastSeen: 'Hier' },
  { id: 'u5', first: 'Léa', last: 'Sturm', email: 'lea@megga.ch', role: 'assistant', bg: '#C9A572', initials: 'LS', status: 'active', joined: '2023-04-30', lastSeen: 'Il y a 5 j' },
]

interface Invite {
  id: string
  email: string
  role: RoleId
  sentAt: string
}

const DEFAULT_INVITES: Invite[] = [
  { id: 'i1', email: 'thomas@megga.ch', role: 'agent', sentAt: 'Il y a 2 jours' },
  { id: 'i2', email: 'sophie.k@megga.ch', role: 'assistant', sentAt: 'Il y a 5 heures' },
]

interface RoleBadgeProps {
  role: RoleId
  muted?: boolean
}

function RoleBadge({ role, muted }: RoleBadgeProps) {
  const r = ROLES[role] || ROLES.agent
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 26,
        padding: '0 12px',
        borderRadius: 999,
        background: muted ? SET.cardSubtle : `${r.color}14`,
        color: muted ? SET.muted : r.color,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: -0.1,
      }}
    >
      {role === 'owner' && (
        <SetIcon name="crown" size={11} stroke={muted ? SET.muted : r.color} sw={2} />
      )}
      {r.label}
    </span>
  )
}

const menuItem = (danger?: boolean): CSSProperties => ({
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 500,
  color: danger ? SET.err : SET.ink,
  textAlign: 'left',
})

interface MemberRowProps {
  m: Member
  onChangeRole: (r: RoleId) => void
  onRemove: () => void
  isOwner: boolean
}

function MemberRow({ m, onChangeRole, onRemove, isOwner }: MemberRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px,2.4fr) 1.4fr 1.2fr 1.4fr 36px',
        gap: 14,
        alignItems: 'center',
        padding: '14px 4px',
        borderBottom: `1px solid ${SET.line}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 999,
            background: m.bg,
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 13.5,
            fontWeight: 700,
            letterSpacing: 0.3,
            flexShrink: 0,
          }}
        >
          {m.initials}
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: SET.ink }}>
            {m.first} {m.last}
          </div>
          <div style={{ fontSize: 11.5, color: SET.muted, fontWeight: 500 }}>
            Dans l'équipe depuis{' '}
            {new Date(m.joined).toLocaleDateString('fr-CH', {
              month: 'short',
              year: 'numeric',
            })}
          </div>
        </div>
      </div>
      <span style={{ fontSize: 13, color: SET.inkSoft, fontWeight: 500 }}>
        {m.email}
      </span>
      <div style={{ position: 'relative' }}>
        {isOwner ? (
          <RoleBadge role="owner" />
        ) : (
          <button
            onClick={() => setRoleOpen(o => !o)}
            style={{
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <RoleBadge role={m.role} />
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke={SET.muted}
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        )}
        {roleOpen && !isOwner && (
          <>
            <div
              onClick={() => setRoleOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            />
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                zIndex: 41,
                background: SET.card,
                borderRadius: 14,
                padding: 6,
                minWidth: 220,
                boxShadow: SET.shadowLg,
                animation: 'setFadeUp .15s ease both',
              }}
            >
              {(Object.entries(ROLES) as [RoleId, RoleDef][])
                .filter(([k]) => k !== 'owner')
                .map(([k, r]) => {
                  const isActive = k === m.role
                  return (
                    <button
                      key={k}
                      onClick={() => {
                        onChangeRole(k)
                        setRoleOpen(false)
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: 0,
                        background: isActive ? SET.cardSubtle : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                      onMouseEnter={e => {
                        if (!isActive)
                          e.currentTarget.style.background = SET.cardSubtle
                      }}
                      onMouseLeave={e => {
                        if (!isActive)
                          e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <span
                        style={{
                          marginTop: 4,
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: r.color,
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: SET.ink,
                          }}
                        >
                          {r.label}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: SET.muted,
                            fontWeight: 500,
                            marginTop: 2,
                          }}
                        >
                          {r.desc}
                        </div>
                      </div>
                      {isActive && (
                        <span
                          style={{
                            marginLeft: 'auto',
                            color: SET.ok,
                            fontSize: 14,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  )
                })}
            </div>
          </>
        )}
      </div>
      <span style={{ fontSize: 12.5, color: SET.muted, fontWeight: 500 }}>
        {m.lastSeen}
      </span>
      <div style={{ position: 'relative' }}>
        {!isOwner && (
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              color: SET.muted,
              display: 'grid',
              placeItems: 'center',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = SET.cardSubtle
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <SetIcon name="more" size={18} />
          </button>
        )}
        {menuOpen && (
          <>
            <div
              onClick={() => setMenuOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            />
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                zIndex: 41,
                background: SET.card,
                borderRadius: 12,
                padding: 6,
                minWidth: 180,
                boxShadow: SET.shadowLg,
              }}
            >
              <button style={menuItem()} onClick={() => setMenuOpen(false)}>
                Voir le profil
              </button>
              <button style={menuItem()} onClick={() => setMenuOpen(false)}>
                Réinitialiser mot de passe
              </button>
              <div
                style={{
                  height: 1,
                  background: SET.line,
                  margin: '4px 8px',
                }}
              />
              <button
                style={menuItem(true)}
                onClick={() => {
                  setMenuOpen(false)
                  onRemove()
                }}
              >
                Retirer du compte
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface PendingInviteRowProps {
  inv: Invite
  onResend: () => void
  onCancel: () => void
}

function PendingInviteRow({ inv, onResend, onCancel }: PendingInviteRowProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px,2.4fr) 1.4fr 1.2fr 1.4fr 36px',
        gap: 14,
        alignItems: 'center',
        padding: '14px 4px',
        borderBottom: `1px solid ${SET.line}`,
        background: `linear-gradient(90deg, ${SET.cardSubtle}55 0%, transparent 60%)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 999,
            background: '#fff',
            color: SET.muted,
            display: 'grid',
            placeItems: 'center',
            border: `1.5px dashed ${SET.ghost}`,
          }}
        >
          <SetIcon name="mailSend" size={16} stroke={SET.muted} sw={1.8} />
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: SET.inkSoft }}>
            Invitation envoyée
          </div>
          <div style={{ fontSize: 11.5, color: SET.muted, fontWeight: 500 }}>
            {inv.sentAt}
          </div>
        </div>
      </div>
      <span
        style={{
          fontSize: 13,
          color: SET.inkSoft,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
        }}
      >
        {inv.email}
      </span>
      <span>
        <RoleBadge role={inv.role} muted />
      </span>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 0,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 22,
            padding: '0 10px',
            borderRadius: 999,
            background: `${SET.warn}18`,
            color: SET.warn,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: 0.1,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: SET.warn,
            }}
          />
          En attente
        </span>
        <SetGhostBtn size="sm" onClick={onResend}>
          Renvoyer
        </SetGhostBtn>
      </span>
      <button
        onClick={onCancel}
        title="Annuler l'invitation"
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          color: SET.muted,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <SetIcon name="x" size={16} />
      </button>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: '32px 4px',
        textAlign: 'center',
        fontSize: 13,
        color: SET.muted,
        fontWeight: 500,
      }}
    >
      {label}
    </div>
  )
}

interface UnifiedMembersCardProps {
  team: Member[]
  invites: Invite[]
  updateRole: (id: string, r: RoleId) => void
  setRemoveId: (id: string | null) => void
  resendInvite: (id: string) => void
  cancelInvite: (id: string) => void
}

function UnifiedMembersCard({
  team,
  invites,
  updateRole,
  setRemoveId,
  resendInvite,
  cancelInvite,
}: UnifiedMembersCardProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'pending'>('all')
  const total = team.length + invites.length
  const showActive = filter === 'all' || filter === 'active'
  const showPending = filter === 'all' || filter === 'pending'

  const Pill = ({ id, label, count }: { id: typeof filter; label: string; count: number }) => {
    const on = filter === id
    return (
      <button
        onClick={() => setFilter(id)}
        style={{
          height: 30,
          padding: '0 12px',
          borderRadius: 999,
          border: 0,
          background: on ? SET.black : 'transparent',
          color: on ? '#fff' : SET.inkSoft,
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: on ? 'none' : `inset 0 0 0 1px ${SET.line}`,
          transition: 'all .15s',
        }}
      >
        {label}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '1px 7px',
            borderRadius: 999,
            background: on ? 'rgba(255,255,255,0.18)' : SET.cardSubtle,
            color: on ? '#fff' : SET.muted,
          }}
        >
          {count}
        </span>
      </button>
    )
  }

  return (
    <div
      style={{
        background: SET.card,
        borderRadius: 24,
        boxShadow: SET.shadow,
      }}
    >
      <div style={{ padding: '28px 28px 0' }}>
        <h3
          style={{
            margin: '0 0 4px',
            fontSize: 17,
            fontWeight: 700,
            color: SET.ink,
            letterSpacing: -0.3,
          }}
        >{`Membres de l'équipe · ${total}`}</h3>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: SET.muted,
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          Actifs et invitations en attente. Cliquez sur un rôle pour le modifier.
        </p>
      </div>
      <div style={{ padding: '18px 28px 24px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 4px 14px',
            borderBottom: `1px solid ${SET.line}`,
          }}
        >
          <Pill id="all" label="Tous" count={total} />
          <Pill id="active" label="Actifs" count={team.length} />
          <Pill id="pending" label="En attente" count={invites.length} />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px,2.4fr) 1.4fr 1.2fr 1.4fr 36px',
            gap: 14,
            padding: '12px 4px 10px',
            fontSize: 10.5,
            fontWeight: 700,
            color: SET.muted,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            borderBottom: `1px solid ${SET.line}`,
          }}
        >
          <span>Membre</span>
          <span>Email</span>
          <span>Rôle</span>
          <span>Statut / Activité</span>
          <span></span>
        </div>

        {showActive &&
          team.map(m => (
            <MemberRow
              key={m.id}
              m={m}
              onChangeRole={r => updateRole(m.id, r)}
              onRemove={() => setRemoveId(m.id)}
              isOwner={m.role === 'owner'}
            />
          ))}

        {filter === 'all' && team.length > 0 && invites.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '16px 4px 10px',
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: SET.muted,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <SetIcon name="mailSend" size={12} stroke={SET.muted} sw={2} />
              En attente · {invites.length}
            </div>
            <span style={{ fontSize: 11, color: SET.muted, fontWeight: 500 }}>
              Liens d'invitation valides 7 jours
            </span>
            <div style={{ flex: 1, height: 1, background: SET.line }} />
          </div>
        )}

        {showPending &&
          invites.map(inv => (
            <PendingInviteRow
              key={inv.id}
              inv={inv}
              onResend={() => resendInvite(inv.id)}
              onCancel={() => cancelInvite(inv.id)}
            />
          ))}

        {filter === 'active' && team.length === 0 && (
          <EmptyState label="Aucun membre actif." />
        )}
        {filter === 'pending' && invites.length === 0 && (
          <EmptyState label="Aucune invitation en attente." />
        )}
      </div>
    </div>
  )
}

interface InviteModalProps {
  open: boolean
  onClose: () => void
  onSend: (email: string, role: RoleId) => void
}

function InviteModal({ open, onClose, onSend }: InviteModalProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<RoleId>('agent')
  if (!open) return null
  const valid = /\S+@\S+\.\S+/.test(email)
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(11,12,14,0.40)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        animation: 'setFadeIn .2s ease both',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: SET.card,
          borderRadius: 24,
          padding: 32,
          maxWidth: 520,
          width: '92%',
          boxShadow: '0 40px 80px rgba(11,12,14,0.30)',
          animation: 'setScaleIn .25s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: SET.cardSubtle,
            display: 'grid',
            placeItems: 'center',
            marginBottom: 20,
          }}
        >
          <SetIcon name="mailSend" size={22} stroke={SET.ink} />
        </div>
        <h3
          style={{
            margin: '0 0 8px',
            fontSize: 22,
            fontWeight: 700,
            color: SET.ink,
            letterSpacing: -0.4,
          }}
        >
          Inviter un collaborateur
        </h3>
        <p
          style={{
            margin: '0 0 24px',
            fontSize: 14,
            color: SET.inkSoft,
            lineHeight: 1.55,
          }}
        >
          Un email d'invitation sera envoyé immédiatement. Le lien expire après 7 jours.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SetInput
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="prenom@megga.ch"
            autoFocus
          />

          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: SET.muted,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              Rôle
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}
            >
              {(Object.entries(ROLES) as [RoleId, RoleDef][])
                .filter(([k]) => k !== 'owner')
                .map(([k, r]) => {
                  const active = role === k
                  return (
                    <button
                      key={k}
                      onClick={() => setRole(k)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 14,
                        border: 0,
                        background: active ? SET.black : SET.cardSubtle,
                        color: active ? '#fff' : SET.ink,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                        transition: 'all .15s',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          marginBottom: 3,
                        }}
                      >
                        {r.label}
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 500,
                          color: active ? 'rgba(255,255,255,0.72)' : SET.muted,
                          lineHeight: 1.4,
                        }}
                      >
                        {r.desc}
                      </div>
                    </button>
                  )
                })}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 28,
          }}
        >
          <SetGhostBtn onClick={onClose}>Annuler</SetGhostBtn>
          <SetBlackBtn
            disabled={!valid}
            onClick={() => onSend(email, role)}
            icon={<SetIcon name="mailSend" size={14} stroke="#fff" />}
          >
            Envoyer l'invitation
          </SetBlackBtn>
        </div>
      </div>
    </div>
  )
}

export function TeamSection() {
  const [team, setTeam] = useState<Member[]>(DEFAULT_TEAM)
  const [invites, setInvites] = useState<Invite[]>(DEFAULT_INVITES)
  const [savedTeam, setSavedTeam] = useState<Member[]>(DEFAULT_TEAM)
  const [savedInvites, setSavedInvites] = useState<Invite[]>(DEFAULT_INVITES)

  const dirty =
    JSON.stringify({ team, invites }) !==
    JSON.stringify({ team: savedTeam, invites: savedInvites })

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSavedTeam(team)
      setSavedInvites(invites)
      setSaving(false)
      setToast(true)
      setTimeout(() => setToast(false), 2400)
    }, 700)
  }

  const updateRole = (id: string, role: RoleId) => {
    setTeam(t => t.map(m => (m.id === id ? { ...m, role } : m)))
  }
  const removeMember = (id: string) => {
    setTeam(t => t.filter(m => m.id !== id))
    setRemoveId(null)
  }
  const cancelInvite = (id: string) => {
    setInvites(inv => inv.filter(i => i.id !== id))
  }
  const resendInvite = (_id: string) => {
    setToast(true)
    setTimeout(() => setToast(false), 1800)
  }
  const sendInvite = (email: string, role: RoleId) => {
    setInvites(inv => [
      ...inv,
      { id: 'i' + Date.now(), email, role, sentAt: "À l'instant" },
    ])
    setInviteOpen(false)
  }

  const seats = team.length + invites.length
  const seatLimit = 10

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          paddingBottom: dirty ? 96 : 24,
          animation: 'setFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <SectionHeader
          kicker="Équipe & rôles"
          title="Qui travaille sur votre portefeuille"
          sub="Invitez collaborateurs et assistants, attribuez les permissions adaptées à chacun. Les changements de rôle prennent effet immédiatement."
        />

        <SetCard padding={24}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: SET.muted,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Sièges utilisés
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: SET.ink,
                    letterSpacing: -0.5,
                  }}
                >
                  {seats}
                </span>
                <span style={{ fontSize: 16, fontWeight: 600, color: SET.muted }}>
                  / {seatLimit}
                </span>
              </div>
              <div
                style={{
                  marginTop: 10,
                  height: 6,
                  borderRadius: 999,
                  background: 'rgba(15,23,42,0.08)',
                  overflow: 'hidden',
                  maxWidth: 320,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${(seats / seatLimit) * 100}%`,
                    background: SET.black,
                    borderRadius: 999,
                    transition: 'width .4s',
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: SET.muted,
                  fontWeight: 500,
                  marginTop: 8,
                }}
              >
                Plan Cabinet · {seatLimit - seats} sièges disponibles
              </div>
            </div>
            <SetBlackBtn
              onClick={() => setInviteOpen(true)}
              icon={<SetIcon name="plus" size={14} stroke="#fff" sw={2.4} />}
            >
              Inviter un collaborateur
            </SetBlackBtn>
          </div>
        </SetCard>

        <UnifiedMembersCard
          team={team}
          invites={invites}
          updateRole={updateRole}
          setRemoveId={setRemoveId}
          resendInvite={resendInvite}
          cancelInvite={cancelInvite}
        />

        <SetCard
          title="Permissions par rôle"
          sub="Référence rapide — détaillez les permissions fines depuis Sécurité."
        >
          <div style={{ display: 'grid', gap: 10 }}>
            {(Object.entries(ROLES) as [RoleId, RoleDef][]).map(([key, r]) => (
              <div
                key={key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr',
                  alignItems: 'center',
                  gap: 16,
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: SET.cardSubtle,
                }}
              >
                <RoleBadge role={key} />
                <span
                  style={{
                    fontSize: 13,
                    color: SET.inkSoft,
                    fontWeight: 500,
                    lineHeight: 1.5,
                  }}
                >
                  {r.desc}
                </span>
              </div>
            ))}
          </div>
        </SetCard>
      </div>

      <StickySaveBar
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onCancel={() => dirty && setConfirmOpen(true)}
      />
      <Toast open={toast} label="Équipe mise à jour" />

      {confirmOpen && (
        <ConfirmModal
          title="Annuler les modifications ?"
          desc="Les changements de rôles et invitations seront perdus."
          confirm="Annuler"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setTeam(savedTeam)
            setInvites(savedInvites)
            setConfirmOpen(false)
          }}
        />
      )}

      {removeId !== null && (
        <ConfirmModal
          title={`Retirer ${team.find(m => m.id === removeId)?.first || ''} de l'équipe ?`}
          desc="Cette personne perdra immédiatement l'accès. Ses biens et contacts resteront dans le portefeuille de l'agence."
          danger="Retirer du compte"
          onCancel={() => setRemoveId(null)}
          onConfirm={() => removeMember(removeId)}
        />
      )}

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSend={sendInvite}
      />
    </>
  )
}
