// MEGGA CRM — Console admin · FICHE AGENCE (concept B « la fiche nue », juil. 2026)
// ─────────────────────────────────────────────────────────────────────
// Plein cadre, UNE colonne, zéro card et zéro onglet : le nom, une phrase de
// faits, puis des sections séparées par des filets (Équipe · Usage · Abonnement).
//   • fond = celui de la liste (sp.pageBg) — la fiche remplace le tableau ;
//   • ce que la fiche NE montre pas : contacts, leads, dossiers KYC de
//     l'agence. Elle mesure l'usage de la plateforme, pas le contenu du CRM ;
//   • la suspension vit ici (la liste ne porte que la réactivation).
(function () {
  const { AdmIcon, AdmPill, AdmGhostBtn, AdmSolidBtn, AdmAvatar, AdmConfirm, AdmModal, AdmLabel, AdmChip,
          admTones, admCHF, admNum, admFieldStyle, admFloatSurf } = window;

  const AGD_ROLE = { super_admin: "Super-admin", admin: "Administrateur", manager: "Manager", agent: "Agent", assistant: "Assistant" };
  const AGD_SEATS = { Starter: 2, Pro: 8, Agency: 20, Entreprise: null };
  const AGD_HAIR = (dark) => `1px solid ${dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)"}`;

  // Portefeuille : uniquement des compteurs réels de la table — aucun chiffre
  // synthétique, aucun graphe décoratif.

  const AgdSect = ({ children, right, sp, top = 0 }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: `${top}px 2px 9px` }}>
      <h3 style={{ margin: 0, fontSize: 11.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: sp.sub }}>{children}</h3>
      {right && <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: sp.sub }}>{right}</span>}
    </div>
  );

  const AgdNum = ({ n, l, tone, sp }) => (
    <div style={{ display: "flex", flexDirection: "column", paddingRight: 44 }}>
      <span style={{ fontSize: 29, fontWeight: 800, letterSpacing: -1.3, lineHeight: 1, color: tone || sp.ink, fontVariantNumeric: "tabular-nums" }}>{n}</span>
      <span style={{ marginTop: 7, fontSize: 11.5, fontWeight: 600, color: sp.sub }}>{l}</span>
    </div>
  );

  const AgdKv = ({ k, v, tone, strong, sp, dark }) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 14, minHeight: 38, padding: "6px 2px", borderTop: AGD_HAIR(dark) }}>
      <span style={{ width: 138, flexShrink: 0, fontSize: 11.5, fontWeight: 600, color: sp.sub }}>{k}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: strong || tone ? 700 : 600, color: tone || (strong ? sp.ink : sp.soft), textWrap: "pretty", fontVariantNumeric: "tabular-nums" }}>{v}</span>
    </div>
  );

  const AgdMember = ({ u, first, sp, dark, onOpen }) => {
    const T = admTones(dark);
    const late = u.never ? { txt: "jamais connecté", c: T.warn } : u.suspended ? { txt: "compte suspendu", c: T.err }
      : u.staleDays ? { txt: u.last, c: T.warn } : { txt: u.last, c: sp.sub };
    const open = onOpen && !u.never;
    return (
      <div className={open ? "adm-row" : undefined} onClick={open ? () => onOpen(u) : undefined}
        style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 52, padding: "7px 2px", borderTop: first ? 0 : AGD_HAIR(dark), cursor: open ? "pointer" : "default" }}>
        <AdmAvatar initials={(u.name.split(" ")[0][0] + (u.name.split(" ")[1] || " ")[0]).trim().toUpperCase()} size={30} sp={sp} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: -0.2, color: sp.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</div>
        </div>
        <span style={{ width: 118, flexShrink: 0, fontSize: 12, fontWeight: 600, color: sp.soft }}>{AGD_ROLE[u.role] || u.role}</span>
        <span style={{ width: 124, flexShrink: 0, textAlign: "right", fontSize: 11.5, fontWeight: u.never || u.staleDays ? 700 : 500, color: late.c }}>{late.txt}</span>
        {open && <AdmIcon name="chevronR" size={15} color={sp.ghost || sp.sub} />}
      </div>
    );
  };

  // ─── Invitation d'un membre ─────────────────────────────────────────────
  // MEGGA n'ajoute personne à la main : elle envoie une invitation. Le compte
  // n'existe qu'une fois le lien ouvert (magic link, 7 jours). Sièges saturés
  // → refus net, avec la seule sortie honnête : monter de plan.
  const AgdInviteModal = ({ a, sp, dark, onClose, onSent }) => {
    const F = admFloatSurf(sp, dark), T = admTones(dark);
    const cap = AGD_SEATS[a.plan];
    const full = cap != null && a.agents >= cap;
    const [email, setEmail] = React.useState("");
    const [role, setRole] = React.useState("agent");
    const ok = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim());
    const dupe = (window.ADMIN_USERS || []).some((u) => u.email.toLowerCase() === email.trim().toLowerCase());

    return (
      <AdmModal sp={sp} dark={dark} onClose={onClose} width={500}
        title={"Inviter un membre chez " + a.name}
        subtitle={full ? `Les ${cap} sièges du plan ${a.plan} sont occupés.` : null}
        footer={<>
          <AdmGhostBtn sp={sp} surf={{ card: F.cardSub }} onClick={onClose}>Annuler</AdmGhostBtn>
          <AdmSolidBtn sp={sp} disabled={full || !ok || dupe} onClick={() => onSent({ email: email.trim(), role })}>Envoyer l'invitation</AdmSolidBtn>
        </>}>
        {full ? (
          <div style={{ padding: "16px 18px", borderRadius: 14, background: F.cardSub }}>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500, color: sp.soft, lineHeight: 1.55, textWrap: "pretty" }}>
              Aucune invitation ne peut partir avant de libérer un siège ou de monter de plan — la montée se fait dans Stripe.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            <div>
              <AdmLabel sp={sp}>Adresse e-mail</AdmLabel>
              <input value={email} onChange={(e) => setEmail(e.target.value)} autoFocus
                placeholder={"prenom.nom@" + (a.email ? a.email.split("@")[1] : "agence.ch")} style={admFieldStyle(sp, F, dark)} />
              {dupe && <p style={{ margin: "7px 0 0", fontSize: 11.5, fontWeight: 700, color: T.err }}>Cette adresse a déjà un compte MEGGA.</p>}
            </div>
            <div>
              <AdmLabel sp={sp}>Rôle dans l'agence</AdmLabel>
              <div role="group" aria-label="Rôle" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {["admin", "manager", "agent", "assistant"].map((r) => (
                  <AdmChip key={r} label={AGD_ROLE[r]} on={role === r} onClick={() => setRole(r)} sp={sp} surf={F} />
                ))}
              </div>
            </div>
          </div>
        )}
      </AdmModal>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  const AdmAgencyDetail = ({ a, sp, surf, dark, health, onBack, onSuspend, onReactivate, onInvite, onGoUser }) => {
    const T = admTones(dark);
    const [allTeam, setAllTeam] = React.useState(false);
    const [confirm, setConfirm] = React.useState(false);
    const [inviting, setInviting] = React.useState(false);
    const [sent, setSent] = React.useState([]);
    const [flash, setFlash] = React.useState(null);
    React.useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), typeof flash === "string" ? 4600 : 9000); return () => clearTimeout(t); }, [flash]);
    const suspended = a.status === "suspended";
    // Un membre ouvre sa fiche dans Utilisateurs (drawer) — le détail d'un compte
    // vit là-bas, pas en double ici.
    const openUser = onGoUser ? (u) => onGoUser(u) : null;
    const cap = AGD_SEATS[a.plan];
    const renew = (window.PLN_RENEW || {})[a.id];
    const team = React.useMemo(
      () => (window.ADMIN_USERS || []).filter((x) => x.agencyId === a.id)
        .sort((x, y) => ({ admin: 1, manager: 2, agent: 3, assistant: 4 }[x.role] || 5) - ({ admin: 1, manager: 2, agent: 3, assistant: 4 }[y.role] || 5)),
      [a.id]
    );
    const seeded = allTeam ? team : team.slice(0, 3);
    const dormant = team.filter((x) => x.staleDays || x.never).length;
    const hColor = { ok: T.ok, warn: T.warn, err: T.err, mute: sp.sub }[health.tone] || sp.soft;

    React.useEffect(() => {
      const k = (e) => { if (e.key === "Escape" && !confirm && !inviting) onBack(); };
      document.addEventListener("keydown", k);
      return () => document.removeEventListener("keydown", k);
    }, [onBack, confirm, inviting]);

    return (
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, animation: "admFadeUp .4s cubic-bezier(.2,.8,.2,1) both" }}>
        <button onClick={onBack} className="adm-nav" style={{
          display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start", border: 0, background: "transparent",
          padding: "0 4px 0 0", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: sp.sub,
        }}>
          <span>Agences</span>
          <AdmIcon name="chevronR" size={13} color={sp.sub} />
          <span style={{ color: sp.ink }}>{a.name}</span>
        </button>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, marginTop: 20, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 320 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 38, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1, color: sp.ink }}>{a.name}</h2>
              <AdmPill sp={sp} surf={surf} dark={dark}
                tone={suspended ? "err" : a.sub === "past_due" ? "err" : a.sub === "trialing" ? "cyan" : "ok"}
                label={suspended ? "Suspendue" : a.sub === "past_due" ? "Impayé" : a.sub === "trialing" ? "Essai" : "Active"}
                style={{ height: 24 }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 9, flexShrink: 0 }}>
            <AdmGhostBtn sp={sp} surf={surf} icon="external" onClick={() => onInvite && onInvite("stripe", a)}>Ouvrir dans Stripe</AdmGhostBtn>
            {suspended
              ? <AdmSolidBtn sp={sp} onClick={() => onReactivate(a)}>Réactiver l'agence</AdmSolidBtn>
              : <AdmSolidBtn sp={sp} onClick={() => setInviting(true)}>Inviter un membre</AdmSolidBtn>}
          </div>
        </div>

        {typeof flash === "string" && (
          <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, fontWeight: 700, color: sp.soft }}>
            <AdmIcon name="check" size={15} color={T.ok} />{flash}
          </div>
        )}

        {/* Confirmation d'action de cycle de vie — fond opaque plein, texte blanc */}
        {flash && typeof flash === "object" && (
          <div style={{
            marginTop: 18, display: "flex", alignItems: "center", gap: 12, minHeight: 46, padding: "0 8px 0 16px",
            borderRadius: 14, background: T.warn,
          }}>
            <AdmIcon name="ban" size={16} color="#FFFFFF" />
            <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.4 }}>
              {a.name} est suspendue — {a.agents} accès révoqué{a.agents > 1 ? "s" : ""}, {admNum(a.properties)} annonce{a.properties > 1 ? "s retirées" : " retirée"}, facturation arrêtée.
            </div>
            <button onClick={() => { setFlash(null); onReactivate(a); }} style={{
              height: 30, padding: "0 13px", borderRadius: 999, border: 0, flexShrink: 0, cursor: "pointer",
              fontFamily: "inherit", fontSize: 11.5, fontWeight: 700, color: "#FFFFFF", background: "rgba(255,255,255,0.18)",
            }}>Réactiver</button>
            <button onClick={() => setFlash(null)} aria-label="Fermer" style={{
              width: 28, height: 28, borderRadius: 999, border: 0, flexShrink: 0, cursor: "pointer",
              background: "rgba(255,255,255,0.16)", display: "grid", placeItems: "center",
            }}><AdmIcon name="close" size={13} color="#FFFFFF" /></button>
          </div>
        )}

        <AgdSect sp={sp} top={34}>Équipe</AgdSect>
        {seeded.length === 0
          ? <div style={{ padding: "4px 2px 6px", fontSize: 12.5, fontWeight: 600, color: sp.sub }}>
              {a.agents === 0
                ? "Aucun compte rattaché — le propriétaire n'a pas encore été invité."
                : `${a.agents} compte${a.agents > 1 ? "s" : ""} rattaché${a.agents > 1 ? "s" : ""}, non détaillé${a.agents > 1 ? "s" : ""} dans ce jeu de données.`}
            </div>
          : seeded.map((m, i) => <AgdMember key={m.id} u={m} first={i === 0} sp={sp} dark={dark} onOpen={openUser} />)}
        {team.length > 3 && (
          <div style={{ display: "flex", alignItems: "center", minHeight: 42, borderTop: AGD_HAIR(dark) }}>
            <button onClick={() => setAllTeam(!allTeam)} className="adm-nav" style={{
              border: 0, background: "transparent", padding: "0 2px", cursor: "pointer", fontFamily: "inherit",
              fontSize: 12.5, fontWeight: 700, color: sp.soft,
            }}>{allTeam ? "Réduire la liste"
              : team.length - 3 === 1 ? "Voir le dernier compte" : `Voir les ${team.length - 3} autres comptes`}</button>
          </div>
        )}
        {team.length > 0 && a.agents > team.length && (
          <div style={{ display: "flex", alignItems: "center", minHeight: 42, borderTop: AGD_HAIR(dark) }}>
            <span style={{ padding: "0 2px", fontSize: 12.5, fontWeight: 500, color: sp.sub }}>
              + {a.agents - team.length} compte{a.agents - team.length > 1 ? "s" : ""} non détaillé{a.agents - team.length > 1 ? "s" : ""} dans ce jeu de données
            </span>
          </div>
        )}
        {sent.length > 0 && (<>
          <AgdSect sp={sp} top={22} right="aucun siège occupé avant l'activation">Invitations en attente</AgdSect>
          {sent.map((m, i) => <AgdMember key={m.id} u={m} first={i === 0} sp={sp} dark={dark} />)}
        </>)}

        <AgdSect sp={sp} top={26} right={`dernière activité ${a.last}`}>Portefeuille</AgdSect>
        <div style={{ display: "flex", flexWrap: "wrap", paddingTop: 4 }}>
          <AgdNum n={a.agents} l={`agent${a.agents > 1 ? "s" : ""}${dormant ? " · " + dormant + " dormant" + (dormant > 1 ? "s" : "") : ""}`} sp={sp} />
          <AgdNum n={admNum(a.properties)} l={suspended ? "biens — hors ligne" : "biens en ligne"} tone={suspended ? sp.sub : null} sp={sp} />
          <AgdNum n={a.deals} l="deals en cours" tone={a.deals === 0 ? T.warn : null} sp={sp} />
        </div>

        <AgdSect sp={sp} top={28}>Abonnement</AgdSect>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 48px" }}>
          <AgdKv k="Plan" v={`${a.plan} · ${admCHF(window.PLN_PRICE ? window.PLN_PRICE[a.plan] || a.mrr : a.mrr)} / mois`} strong sp={sp} dark={dark} />
          <AgdKv k="Sièges" v={cap == null ? `${a.agents}` : `${a.agents} sur ${cap}`} tone={cap != null && a.agents >= cap ? T.info : null} sp={sp} dark={dark} />
          <AgdKv k="Renouvellement" v={suspended ? "suspendu — aucun prélèvement" : renew || "—"} sp={sp} dark={dark} />
          <AgdKv k="Paiement" v={a.sub === "past_due" ? "impayé depuis le dernier cycle" : a.sub === "trialing" ? "essai en cours, aucune facture" : "à jour"}
            tone={a.sub === "past_due" ? T.err : null} sp={sp} dark={dark} />
        </div>

        {a.note && (<>
          <AgdSect sp={sp} top={26}>Note interne</AgdSect>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500, color: sp.soft, lineHeight: 1.55, maxWidth: 720, textWrap: "pretty" }}>{a.note}</p>
        </>)}

        {!suspended && (
          <div style={{ display: "flex", alignItems: "center", marginTop: 30, paddingTop: 16, borderTop: AGD_HAIR(dark) }}>
            <button onClick={() => setConfirm(true)} className="adm-nav" style={{
              border: 0, background: "transparent", padding: "0 2px", cursor: "pointer", fontFamily: "inherit",
              fontSize: 12.5, fontWeight: 700, color: T.err,
            }}>Suspendre l'agence</button>
          </div>
        )}

        <AdmConfirm open={confirm} sp={sp} dark={dark}
          title={"Suspendre " + a.name + " ?"}
          message={`${a.agents} agent${a.agents > 1 ? "s perdent" : " perd"} l'accès immédiatement et ${admNum(a.properties)} annonce${a.properties > 1 ? "s sortent" : " sort"} des portails. Le plan cesse d'être facturé ; les données restent intactes.`}
          confirmLabel="Suspendre" onClose={() => setConfirm(false)}
          onConfirm={() => { setConfirm(false); onSuspend(a); setFlash({ kind: "suspended" }); }} />

        {inviting && (
          <AgdInviteModal a={a} sp={sp} dark={dark} onClose={() => setInviting(false)}
            onSent={({ email, role }) => {
              setSent((l) => l.concat({ id: "inv" + Date.now(), name: email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), email, role, never: true, invited: "à l'instant", last: "" }));
              setInviting(false);
              setFlash("Invitation envoyée à " + email + " — lien valable 7 jours.");
            }} />
        )}
      </div>
    );
  };

  Object.assign(window, { AdmAgencyDetail });
})();
