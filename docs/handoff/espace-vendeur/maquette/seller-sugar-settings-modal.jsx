// MEGGA — Modal Paramètres (côté vendeur) — Sugar Pure
// Sections : Notifications (par e-mail), Disponibilités des visites,
// Langue & contact, Apparence (dark mode). Réutilise SvModalShell.
// Contrôlé : reçoit settings + onChange(key,val) + dark + onDark.

// ─── Contrôles Sugar ──────────────────────────────────────────────────
const SgToggle = ({ on, onChange }) => {
  const SP = window.SELLER_SP;
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on} style={{
      width: 46, height: 28, borderRadius: 999, border: 0, cursor: "pointer",
      padding: 3, flexShrink: 0, position: "relative",
      background: on ? SP.accent : SP.line,
      transition: "background .2s ease", fontFamily: "inherit",
    }}>
      <span style={{
        display: "block", width: 22, height: 22, borderRadius: 999,
        background: on ? SP.onAccent : SP.card,
        boxShadow: "0 2px 5px rgba(0,0,0,0.18)",
        transform: on ? "translateX(18px)" : "translateX(0)",
        transition: "transform .2s cubic-bezier(.2,.8,.2,1)",
      }} />
    </button>
  );
};

const SgToggleRow = ({ label, sub, on, onChange }) => {
  const SP = window.SELLER_SP;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 0" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: SP.ink, letterSpacing: -0.1 }}>{label}</div>
        {sub && <div style={{ fontSize: 12.5, fontWeight: 500, color: SP.muted, marginTop: 2 }}>{sub}</div>}
      </div>
      <SgToggle on={on} onChange={onChange} />
    </div>
  );
};

// Chips multi-sélection
const SgChips = ({ options, values, onToggle }) => {
  const SP = window.SELLER_SP;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const on = values.includes(o.value);
        return (
          <button key={o.value} onClick={() => onToggle(o.value)} style={{
            padding: "8px 15px", borderRadius: 999, border: 0, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
            background: on ? SP.accent : SP.card,
            color: on ? SP.onAccent : SP.inkSoft,
            boxShadow: on ? "none" : `inset 0 0 0 1.5px ${SP.line}`,
            transition: "all .15s ease",
          }}>{o.label}</button>
        );
      })}
    </div>
  );
};

// Segmented single-select (dans un rail cardSubtle)
const SgSegment = ({ options, value, onChange }) => {
  const SP = window.SELLER_SP;
  return (
    <div style={{
      display: "flex", gap: 4, padding: 4, borderRadius: 999, background: SP.cardSubtle,
    }}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} style={{
            flex: 1, padding: "9px 10px", borderRadius: 999, border: 0, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
            background: on ? SP.card : "transparent",
            color: on ? SP.ink : SP.muted,
            boxShadow: on ? SP.shadowSm : "none",
            transition: "all .15s ease",
          }}>{o.label}</button>
        );
      })}
    </div>
  );
};

// Bloc section
const SgSection = ({ icon, title, sub, children, first }) => {
  const SP = window.SELLER_SP;
  return (
    <div style={{
      paddingTop: first ? 0 : 24, marginTop: first ? 0 : 24,
      borderTop: first ? "none" : `1px solid ${SP.hairline}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: sub ? 4 : 16 }}>
        <span style={{
          width: 32, height: 32, borderRadius: 999, flexShrink: 0,
          display: "grid", placeItems: "center", background: SP.cardSubtle, color: SP.ink,
        }}>
          <window.SvIcon name={icon} size={16} stroke={SP.ink} sw={1.7} />
        </span>
        <span style={{ fontSize: 15.5, fontWeight: 700, color: SP.ink, letterSpacing: -0.2, whiteSpace: "nowrap" }}>{title}</span>
      </div>
      {sub && <div style={{ fontSize: 12.5, fontWeight: 500, color: SP.muted, margin: "0 0 12px 43px" }}>{sub}</div>}
      <div style={{ paddingLeft: 43 }}>{children}</div>
    </div>
  );
};

const FieldLabel = ({ children }) => {
  const SP = window.SELLER_SP;
  return <div style={{ fontSize: 12.5, fontWeight: 600, color: SP.inkSoft, margin: "16px 0 9px" }}>{children}</div>;
};

// ─── Modal Paramètres ───────────────────────────────────────────────
const SvSettingsModal = ({ settings, onChange, dark, onDark, onClose }) => {
  const SP = window.SELLER_SP;
  const Shell = window.SvModalShell;

  const toggleDay = (d) => {
    const next = settings.jours.includes(d)
      ? settings.jours.filter((x) => x !== d)
      : [...settings.jours, d];
    onChange("jours", next);
  };
  const toggleSlot = (s) => {
    const next = settings.creneaux.includes(s)
      ? settings.creneaux.filter((x) => x !== s)
      : [...settings.creneaux, s];
    onChange("creneaux", next);
  };

  return (
    <Shell onClose={onClose}>
      <div style={{ marginBottom: 22 }}>
        <span style={{
          display: "inline-block", fontSize: 11.5, fontWeight: 700, color: SP.muted,
          letterSpacing: 1, textTransform: "uppercase", marginBottom: 10,
        }}>Réglages</span>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: SP.ink, letterSpacing: -0.5 }}>
          Paramètres
        </h2>
      </div>

      {/* 1. Notifications */}
      <SgSection icon="mail" title="Notifications" sub="Vous êtes prévenu par e-mail." first>
        <SgToggleRow label="Nouvelle offre reçue"
          on={settings.notifOffre} onChange={(v) => onChange("notifOffre", v)} />
        <SgToggleRow label="Visite planifiée"
          on={settings.notifVisite} onChange={(v) => onChange("notifVisite", v)} />
        <SgToggleRow label="Retour après visite"
          on={settings.notifRetour} onChange={(v) => onChange("notifRetour", v)} />
      </SgSection>

      {/* 2. Disponibilités */}
      <SgSection icon="calendar" title="Disponibilités des visites"
        sub="Quand votre bien peut être visité.">
        <SgChips
          options={[
            { value: "lun", label: "Lun" }, { value: "mar", label: "Mar" },
            { value: "mer", label: "Mer" }, { value: "jeu", label: "Jeu" },
            { value: "ven", label: "Ven" }, { value: "sam", label: "Sam" },
            { value: "dim", label: "Dim" },
          ]}
          values={settings.jours} onToggle={toggleDay} />

        <FieldLabel>Créneaux</FieldLabel>
        <SgChips
          options={[
            { value: "matin", label: "Matin" },
            { value: "apresmidi", label: "Après-midi" },
            { value: "soir", label: "Soir" },
          ]}
          values={settings.creneaux} onToggle={toggleSlot} />

        <FieldLabel>Préavis souhaité</FieldLabel>
        <SgSegment
          options={[
            { value: "jour", label: "Le jour même" },
            { value: "24h", label: "24 h" },
            { value: "48h", label: "48 h" },
          ]}
          value={settings.preavis} onChange={(v) => onChange("preavis", v)} />
      </SgSection>

      {/* 3. Langue & contact */}
      <SgSection icon="globe" title="Langue & contact">
        <FieldLabel>Langue de l'interface</FieldLabel>
        <SgSegment
          options={[
            { value: "fr", label: "FR" }, { value: "de", label: "DE" },
            { value: "en", label: "EN" }, { value: "it", label: "IT" },
          ]}
          value={settings.langue} onChange={(v) => onChange("langue", v)} />

        <FieldLabel>Comment votre agent vous contacte</FieldLabel>
        <SgSegment
          options={[
            { value: "whatsapp", label: "WhatsApp" },
            { value: "tel", label: "Téléphone" },
            { value: "email", label: "E-mail" },
          ]}
          value={settings.canal} onChange={(v) => onChange("canal", v)} />
      </SgSection>

      {/* 4. Apparence */}
      <SgSection icon={dark ? "moon" : "sun"} title="Apparence">
        <SgToggleRow label="Mode sombre" sub="Confort de lecture en faible luminosité"
          on={dark} onChange={onDark} />
      </SgSection>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, marginTop: 30 }}>
        <button onClick={onClose} style={{
          flex: "0 0 auto", minWidth: 120, height: 50, borderRadius: 999, cursor: "pointer",
          border: 0, background: SP.card, color: SP.inkSoft,
          boxShadow: `inset 0 0 0 1.5px ${SP.line}`,
          fontSize: 14.5, fontWeight: 600, fontFamily: "inherit", transition: "background .18s ease",
        }}
        onMouseEnter={e => e.currentTarget.style.background = SP.cardSubtle}
        onMouseLeave={e => e.currentTarget.style.background = SP.card}>
          Annuler
        </button>
        <button onClick={onClose} style={{
          flex: 1, height: 50, borderRadius: 999, border: 0, cursor: "pointer",
          background: SP.accent, color: SP.onAccent,
          fontSize: 14.5, fontWeight: 700, fontFamily: "inherit",
          boxShadow: "0 6px 16px rgba(11,12,14,0.18)",
          transition: "all .18s ease",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = SP.accentHover; e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = SP.accent; e.currentTarget.style.transform = "translateY(0)"; }}>
          Enregistrer
        </button>
      </div>
    </Shell>
  );
};

window.SvSettingsModal = SvSettingsModal;
