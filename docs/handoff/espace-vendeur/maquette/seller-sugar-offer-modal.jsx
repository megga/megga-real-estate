// MEGGA — Modal de validation d'offre (côté vendeur)
// Sugar Pure pur : surface blanche, coins 28px, ombre modale, accent NOIR.
// Flow : 3 choix (Accepter / Contre-offrir / Refuser) → contexte agent → confirmation.
// L'agent reste copilote : rien ne part sans « transmettre à mon agent ».

const SvOfferModal = ({ offer, askingPrice, agent, onClose }) => {
  const SP = window.SELLER_SP;
  const Icon = window.SvIcon;

  const [choice, setChoice] = React.useState(null);      // 'accept' | 'counter' | 'refuse'
  const [counter, setCounter] = React.useState(askingPrice);
  const [sent, setSent] = React.useState(false);

  // Verrou du scroll de fond
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, []);

  const ecart = offer.amount - askingPrice;            // négatif = sous le prix
  const ecartPct = Math.round((ecart / askingPrice) * 1000) / 10;

  const CHOICES = [
    { id: "accept",  title: "Accepter l'offre",  desc: "Vous validez le montant proposé.", tone: SP.forestGreen, icon: "check" },
    { id: "counter", title: "Faire une contre-offre", desc: "Proposez votre prix en retour.", tone: SP.burntOrange, icon: "arrowUpDown" },
    { id: "refuse",  title: "Refuser l'offre",   desc: "Vous déclinez cette proposition.", tone: "#DC2626", icon: "x" },
  ];

  // ─── Écran de confirmation ──────────────────────────────────────────
  if (sent) {
    const msg = {
      accept:  "Votre accord est transmis. Votre agent revient vers vous pour la suite (compromis, notaire).",
      counter: `Votre contre-offre de ${window.sellerFmtCHF(counter)} est transmise à votre agent, qui la présentera à l'acheteur.`,
      refuse:  "Votre refus est transmis à votre agent. Il vous tiendra informé de la suite.",
    }[choice];
    return (
      <SvModalShell onClose={onClose}>
        <div style={{ textAlign: "center", padding: "14px 8px 6px" }}>
          <div style={{
            width: 60, height: 60, borderRadius: 999, margin: "0 auto 22px",
            background: SP.accent, display: "grid", placeItems: "center",
            boxShadow: "0 10px 26px rgba(11,12,14,0.22)",
          }}>
            <Icon name="check" size={28} stroke={SP.onAccent} sw={2.4} />
          </div>
          <h2 style={{ margin: "0 0 12px", fontSize: 23, fontWeight: 700, color: SP.ink, letterSpacing: -0.5 }}>
            C'est transmis
          </h2>
          <p style={{ margin: "0 auto 26px", maxWidth: 380, fontSize: 15, fontWeight: 500, color: SP.inkSoft, lineHeight: 1.55 }}>
            {msg}
          </p>
          <button onClick={onClose} style={blackBtn(SP, false)}
            onMouseEnter={e => Object.assign(e.currentTarget.style, blackBtnHover(SP))}
            onMouseLeave={e => Object.assign(e.currentTarget.style, blackBtn(SP, false))}>
            Revenir à ma vente
          </button>
        </div>
      </SvModalShell>
    );
  }

  // ─── Écran principal ────────────────────────────────────────────────
  const canConfirm = choice && (choice !== "counter" || (counter > 0));

  return (
    <SvModalShell onClose={onClose}>
      {/* En-tête */}
      <div style={{ marginBottom: 24 }}>
        <span style={{
          display: "inline-block", fontSize: 11.5, fontWeight: 700, color: SP.muted,
          letterSpacing: 1, textTransform: "uppercase", marginBottom: 12,
        }}>Offre reçue</span>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: SP.ink, letterSpacing: -0.5 }}>
          Que souhaitez-vous faire ?
        </h2>
      </div>

      {/* Récap offre */}
      <div style={{
        background: SP.cardSubtle, borderRadius: 18, padding: "20px 22px", marginBottom: 24,
        display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: SP.muted, marginBottom: 5 }}>Montant proposé</div>
          <div className="sg-tnum" style={{ fontSize: 30, fontWeight: 700, color: SP.ink, letterSpacing: -0.8, lineHeight: 1 }}>
            {window.sellerFmtCHF(offer.amount)}
          </div>
        </div>
        <div style={{ width: 1, alignSelf: "stretch", background: SP.hairline, margin: "2px 0" }} />
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: SP.muted, marginBottom: 5 }}>Écart au prix affiché</div>
          <div className="sg-tnum" style={{ fontSize: 17, fontWeight: 700, color: SP.inkSoft, letterSpacing: -0.3 }}>
            {ecart >= 0 ? "+" : "−"}{window.sellerFmtCHF(Math.abs(ecart))}
            <span style={{ fontSize: 13.5, fontWeight: 600, color: SP.muted, marginLeft: 7 }}>
              ({ecart >= 0 ? "+" : "−"}{Math.abs(ecartPct)} %)
            </span>
          </div>
        </div>
        <span className="sg-tnum" style={{
          marginLeft: "auto", fontSize: 13, fontWeight: 500, color: SP.muted, whiteSpace: "nowrap",
        }}>{offer.date}</span>
      </div>

      {/* Choix */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {CHOICES.map((c) => {
          const active = choice === c.id;
          return (
            <button key={c.id} onClick={() => setChoice(c.id)} style={{
              textAlign: "left", width: "100%", cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 16,
              padding: "16px 18px", borderRadius: 16, border: 0,
              background: active ? SP.cardSubtle : SP.card,
              boxShadow: active
                ? `0 0 0 2px ${SP.accent} inset, ${SP.shadowSm}`
                : `0 0 0 1.5px ${SP.line} inset`,
              transition: "box-shadow .18s ease, background .18s ease",
            }}>
              <span style={{
                width: 38, height: 38, borderRadius: 999, flexShrink: 0,
                display: "grid", placeItems: "center",
                background: active ? c.tone : SP.cardSubtle,
                color: active ? "#fff" : SP.muted,
                transition: "all .18s ease",
              }}>
                <Icon name={c.icon} size={18} stroke={active ? "#fff" : SP.muted} sw={2} />
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 15.5, fontWeight: 700, color: SP.ink, letterSpacing: -0.2 }}>{c.title}</span>
                <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: SP.muted, marginTop: 2 }}>{c.desc}</span>
              </span>
              <span style={{
                width: 22, height: 22, borderRadius: 999, flexShrink: 0,
                display: "grid", placeItems: "center",
                background: active ? SP.accent : SP.card,
                boxShadow: active ? "none" : `inset 0 0 0 2px ${SP.line}`,
              }}>
                {active && <Icon name="check" size={13} stroke={SP.onAccent} sw={2.6} />}
              </span>
            </button>
          );
        })}
      </div>

      {/* Champ contre-offre */}
      {choice === "counter" && (
        <div className="sg-enter" style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: SP.inkSoft, marginBottom: 8 }}>
            Votre prix souhaité
          </label>
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)",
              fontSize: 15, fontWeight: 600, color: SP.muted, pointerEvents: "none",
            }}>CHF</span>
            <input
              type="text" inputMode="numeric"
              value={counter.toLocaleString("fr-CH").replace(/[\u00A0\u202F\s.,]/g, "'")}
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                setCounter(isNaN(n) ? 0 : n);
              }}
              className="sg-tnum"
              style={{
                width: "100%", height: 52, paddingLeft: 58, paddingRight: 18,
                borderRadius: 12, border: 0, background: SP.cardSubtle,
                boxShadow: `inset 0 0 0 1.5px ${SP.line}`,
                fontSize: 18, fontWeight: 700, color: SP.ink, letterSpacing: -0.4,
                fontFamily: "inherit", outline: "none",
              }}
              onFocus={(e) => e.target.style.boxShadow = `inset 0 0 0 2px ${SP.accent}`}
              onBlur={(e) => e.target.style.boxShadow = `inset 0 0 0 1.5px ${SP.line}`}
            />
          </div>
        </div>
      )}

      {/* Rassurance agent */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "13px 16px",
        borderRadius: 14, background: SP.cardSubtle, marginBottom: 24,
      }}>
        <image-slot id="agent-photo-modal" shape="circle" style={{ width: 34, height: 34, flexShrink: 0 }} placeholder=""></image-slot>
        <span style={{ fontSize: 13.5, fontWeight: 500, color: SP.inkSoft, lineHeight: 1.45 }}>
          {agent.name.split(" ")[0]} valide chaque décision avec vous avant transmission. Rien n'est envoyé sans votre accord.
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={onClose} style={ghostBtn(SP)}
          onMouseEnter={e => e.currentTarget.style.background = SP.cardSubtle}
          onMouseLeave={e => e.currentTarget.style.background = SP.card}>
          Annuler
        </button>
        <button
          disabled={!canConfirm}
          onClick={() => canConfirm && setSent(true)}
          style={blackBtn(SP, !canConfirm)}
          onMouseEnter={e => canConfirm && Object.assign(e.currentTarget.style, blackBtnHover(SP))}
          onMouseLeave={e => canConfirm && Object.assign(e.currentTarget.style, blackBtn(SP, false))}>
          Transmettre à mon agent
        </button>
      </div>
    </SvModalShell>
  );
};

// ─── Coquille de la modal (overlay + carte centrée) ────────────────────
const SvModalShell = ({ children, onClose }) => {
  const SP = window.SELLER_SP;
  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(15,23,42,0.32)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 28, animation: "sgFadeUp .3s ease both",
      }}>
      <div style={{
        position: "relative", width: "100%", maxWidth: 540,
        maxHeight: "calc(100vh - 56px)", overflowY: "auto",
        background: SP.card, borderRadius: 28, padding: "34px 36px 32px",
        boxShadow: "0 40px 100px rgba(15,23,42,0.20), 0 8px 24px rgba(15,23,42,0.10)",
        animation: "sgScaleIn .35s cubic-bezier(.2,.8,.2,1) both",
      }}>
        <button onClick={onClose} aria-label="Fermer" style={{
          position: "absolute", top: 22, right: 22, width: 34, height: 34, borderRadius: 999,
          border: 0, background: SP.cardSubtle, cursor: "pointer",
          display: "grid", placeItems: "center", color: SP.muted,
          transition: "background .18s ease",
        }}
        onMouseEnter={e => e.currentTarget.style.background = SP.closeHover}
        onMouseLeave={e => e.currentTarget.style.background = SP.cardSubtle}>
          <window.SvIcon name="x" size={17} stroke={SP.inkSoft} sw={2} />
        </button>
        {children}
      </div>
    </div>
  );
};

// ─── Styles boutons ─────────────────────────────────────────────────
function blackBtn(SP, disabled) {
  return {
    flex: 1, height: 50, borderRadius: 999, border: 0, cursor: disabled ? "default" : "pointer",
    background: disabled ? SP.disabledBg : SP.accent, color: SP.onAccent,
    fontSize: 14.5, fontWeight: 700, fontFamily: "inherit",
    boxShadow: disabled ? "none" : "0 6px 16px rgba(11,12,14,0.18)",
    transform: "translateY(0)", transition: "all .18s ease",
  };
}
function blackBtnHover(SP) {
  return { background: SP.accentHover, transform: "translateY(-1px)", boxShadow: "0 12px 30px rgba(11,12,14,0.25)" };
}
function ghostBtn(SP) {
  return {
    flex: "0 0 auto", minWidth: 120, height: 50, borderRadius: 999, cursor: "pointer",
    border: 0, background: SP.card, color: SP.inkSoft,
    boxShadow: `inset 0 0 0 1.5px ${SP.line}`,
    fontSize: 14.5, fontWeight: 600, fontFamily: "inherit", transition: "background .18s ease",
  };
}

window.SvOfferModal = SvOfferModal;
window.SvModalShell = SvModalShell;
