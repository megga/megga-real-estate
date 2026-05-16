// MEGGA CRM — Contact detail (split view), Matching screen, Mes biens screen

// ─── Contacts split view ────────────────────────────────────────────
const CRMScreenContacts = ({ t, dense }) => {
  const [selectedId, setSelected] = React.useState("c-001");
  const c = crmContactById(selectedId);
  return (
    <div style={{ display:"flex", height:"100vh" }}>
      {/* Left list */}
      <div style={{
        width: 360, flexShrink: 0, borderRight: `1px solid ${t.border}`,
        background: t.surface, display:"flex", flexDirection:"column",
      }}>
        <div style={{ padding:"18px 18px 12px", borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom: 10 }}>
            <h1 style={{ margin:0, fontSize: 20, fontWeight: 700, color: t.ink, letterSpacing: -0.3 }}>Contacts</h1>
            <span style={{ fontSize: 12, color: t.muted }}>{CRM_CONTACTS.length}</span>
          </div>
          <div style={{
            height: 32, padding:"0 10px", background: t.surface2, border: `1px solid ${t.border}`,
            borderRadius: 8, display:"flex", alignItems:"center", gap: 8, color: t.muted,
          }}>
            <CRMIcon name="search" size={13} />
            <input placeholder="Rechercher…" style={{
              flex:1, background:"transparent", border:0, outline:"none", color: t.ink, fontSize: 12.5, fontFamily:"inherit",
            }} />
          </div>
          <div style={{ display:"flex", gap: 5, marginTop: 10 }}>
            {["Tous","Acheteurs","Vendeurs","À qualifier"].map((tab,i) => (
              <span key={tab} style={{
                padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600,
                background: i === 0 ? t.ink : "transparent", color: i === 0 ? t.surface : t.muted,
                cursor:"pointer", border: i === 0 ? 0 : `1px solid ${t.border}`,
              }}>{tab}</span>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY:"auto" }}>
          {CRM_CONTACTS.map(co => {
            const isSel = co.id === selectedId;
            return (
              <button key={co.id} onClick={() => setSelected(co.id)} style={{
                width:"100%", padding:"12px 18px", display:"grid", gridTemplateColumns:"36px 1fr 36px", gap: 10,
                alignItems:"center", border: 0, background: isSel ? t.primarySoft : "transparent",
                borderLeft: isSel ? `3px solid ${t.primary}` : `3px solid transparent`,
                cursor:"pointer", textAlign:"left", fontFamily:"inherit",
                borderBottom: `1px solid ${t.border}`,
              }}>
                <CRMAvatar contact={co} size={36} t={t} />
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: t.ink, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {co.firstName} {co.lastName}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 10.5, color: t.muted, textTransform:"uppercase", fontWeight: 700, letterSpacing: 0.4 }}>
                      {co.type === "buyer" ? "Acheteur" : co.type === "seller" ? "Vendeur" : co.type}
                    </span>
                    <span style={{ width: 3, height: 3, borderRadius: 999, background: t.muted }} />
                    <span style={{ fontSize: 11, color: t.muted }}>{crmRelative(co.lastActivityAt)}</span>
                  </div>
                </div>
                <CRMScoreRing score={co.score} t={t} size={32} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Right detail */}
      <div style={{ flex: 1, overflowY:"auto", background: t.bg }}>
        <CRMContactDetail contact={c} t={t} dense={dense} />
      </div>
    </div>
  );
};

const CRMContactDetail = ({ contact: c, t, dense }) => {
  const deals = CRM_DEALS.filter(d => d.contactId === c.id);
  const matches = CRM_MATCHES.filter(m => m.contactId === c.id);
  const activity = CRM_ACTIVITY.filter(a => a.contactId === c.id);
  return (
    <div style={{ padding: "24px 32px 60px", maxWidth: 920 }}>
      {/* Hero */}
      <div style={{ display:"flex", gap: 18, alignItems:"flex-start", marginBottom: 18 }}>
        <CRMAvatar contact={c} size={64} t={t} />
        <div style={{ flex: 1 }}>
          <div style={{ display:"flex", alignItems:"center", gap: 10, marginBottom: 4 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: t.ink, letterSpacing: -0.4 }}>
              {c.firstName} {c.lastName}
            </h1>
            <CRMKYCBadge status={c.kyc.status} t={t} />
            <span style={{
              padding:"2px 8px", borderRadius: 999, background: t.primarySoft, color: t.primary,
              fontSize: 10.5, fontWeight: 700, textTransform:"uppercase", letterSpacing: 0.4,
            }}>{c.type === "buyer" ? "Acheteur" : c.type === "seller" ? "Vendeur" : c.type}</span>
          </div>
          <div style={{ display:"flex", gap: 14, fontSize: 13, color: t.muted, alignItems:"center" }}>
            <span style={{ display:"flex", alignItems:"center", gap: 5 }}><CRMIcon name="mail" size={13}/> {c.email}</span>
            <span style={{ display:"flex", alignItems:"center", gap: 5 }}><CRMIcon name="phone" size={13}/> {c.phone}</span>
            <span style={{ display:"flex", alignItems:"center", gap: 5 }}><CRMIcon name="flag" size={13}/> {c.lang.toUpperCase()}</span>
          </div>
          {c.tags && (
            <div style={{ display:"flex", gap: 6, marginTop: 10, flexWrap:"wrap" }}>
              {c.tags.map(tag => (
                <span key={tag} style={{
                  padding:"2px 8px", borderRadius: 999, background: t.surface2,
                  fontSize: 11, color: t.soft, fontWeight: 600, border: `1px solid ${t.border}`,
                }}>{tag}</span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap: 8 }}>
          <CRMScoreRing score={c.score} t={t} size={64} />
          <div style={{ fontSize: 10, color: t.muted, fontWeight: 700, textAlign:"center", letterSpacing: 0.4, textTransform:"uppercase" }}>Score</div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display:"flex", gap: 8, marginBottom: 18 }}>
        <button style={crmBtnPrimaryBlue(t)}>
          <span style={{ display:"inline-flex", alignItems:"center", gap: 6 }}>
            <CRMIcon name="phone" size={13} stroke="#fff" /> Appeler
          </span>
        </button>
        <button style={crmBtnGhost32(t)}>
          <span style={{ display:"inline-flex", alignItems:"center", gap: 6 }}>
            <CRMIcon name="mail" size={13} /> Email
          </span>
        </button>
        <button style={crmBtnGhost32(t)}>
          <span style={{ display:"inline-flex", alignItems:"center", gap: 6 }}>
            <CRMIcon name="cal" size={13} /> Visite
          </span>
        </button>
        <button style={crmBtnGhost32(t)}>
          <span style={{ display:"inline-flex", alignItems:"center", gap: 6 }}>
            <CRMIcon name="docs" size={13} /> Document
          </span>
        </button>
        <span style={{ flex: 1 }}/>
        <button style={crmBtnGhost32(t)}>···</button>
      </div>



      {/* Two col: criteria + deals */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Criteria card */}
        <div style={{ padding: "16px 18px", background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: t.muted, fontWeight: 700, letterSpacing: 0.5, textTransform:"uppercase", marginBottom: 10 }}>
            {c.type === "buyer" ? "Critères de recherche" : "Profil vendeur"}
          </div>
          {c.criteria ? (
            <div style={{ display:"grid", gridTemplateColumns:"110px 1fr", rowGap: 8, fontSize: 13 }}>
              <span style={{ color: t.muted }}>Transaction</span>
              <span style={{ color: t.ink, fontWeight: 600, textTransform:"capitalize" }}>{c.criteria.transaction}</span>
              <span style={{ color: t.muted }}>Type</span>
              <span style={{ color: t.ink, fontWeight: 600, textTransform:"capitalize" }}>{c.criteria.types.join(", ")}</span>
              <span style={{ color: t.muted }}>Lieu</span>
              <span style={{ color: t.ink, fontWeight: 600 }}>{(c.criteria.cities || []).join(", ") || c.criteria.cantons.join(", ")}</span>
              <span style={{ color: t.muted }}>Budget</span>
              <span style={{ color: t.ink, fontWeight: 600, fontVariantNumeric:"tabular-nums" }}>
                {c.criteria.budgetMin ? crmFmtCHF(c.criteria.budgetMin) + " — " : "≤ "}{crmFmtCHF(c.criteria.budgetMax)}
              </span>
              <span style={{ color: t.muted }}>Surface min.</span>
              <span style={{ color: t.ink, fontWeight: 600 }}>{c.criteria.areaMin} m²</span>
              <span style={{ color: t.muted }}>Pièces min.</span>
              <span style={{ color: t.ink, fontWeight: 600 }}>{c.criteria.roomsMin}p</span>
              {c.criteria.mustHave && (
                <>
                  <span style={{ color: t.muted }}>Indispensables</span>
                  <span style={{ color: t.ink, fontWeight: 600 }}>{c.criteria.mustHave.join(" · ")}</span>
                </>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: t.muted }}>Aucun critère renseigné.</div>
          )}
        </div>

        {/* Deals card */}
        <div style={{ padding: "16px 18px", background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: t.muted, fontWeight: 700, letterSpacing: 0.5, textTransform:"uppercase", marginBottom: 10 }}>
            Deals · {deals.length}
          </div>
          {deals.length === 0 && <div style={{ fontSize: 13, color: t.muted }}>Aucun deal en cours.</div>}
          {deals.map(d => {
            const b = d.bienId ? crmBienById(d.bienId) : null;
            return (
              <div key={d.id} style={{ padding: "8px 0", borderTop: `1px solid ${t.border}`, display:"flex", alignItems:"center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{b ? b.title : "Recherche active"}</div>
                  <div style={{ fontSize: 11.5, color: t.muted, marginTop: 2 }}>{crmFmtCHF(d.value)} · {d.probability}%</div>
                </div>
                <CRMStageChip stage={d.stage} t={t} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Matchs */}
      {matches.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.ink }}>Biens correspondants</h3>
            <span style={{ fontSize: 11.5, color: t.muted }}>{matches.length} matchs</span>
          </div>
          <div style={{
            display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap: 10,
          }}>
            {matches.map((m,i) => {
              const b = crmBienById(m.bienId);
              return (
                <div key={i} style={{
                  padding: "12px 14px", background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12,
                  display:"flex", gap: 12, alignItems:"center",
                }}>
                  <CRMScoreRing score={m.score} t={t} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{b.title}</div>
                    <div style={{ fontSize: 11.5, color: t.muted, marginTop: 2 }}>{crmFmtCHF(b.price || b.rent)} · {b.area}m² · {b.rooms}p</div>
                    <div style={{ fontSize: 10.5, color: t.muted, marginTop: 4, fontStyle:"italic" }}>{m.reasons.slice(0,3).join(" · ")}</div>
                  </div>
                  <button style={{ ...crmBtnPrimary(t), height: 26 }}>{m.status === "to-send" ? "Envoyer" : m.status === "sent" ? "Envoyé" : m.status === "viewed" ? "Vu" : "Aimé"}</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity timeline */}
      <div>
        <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: t.ink }}>Historique</h3>
        <div style={{
          background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: "8px 0",
        }}>
          {activity.length === 0 && <div style={{ padding: "16px", fontSize: 13, color: t.muted }}>Aucune activité enregistrée.</div>}
          {activity.map((a, i) => (
            <div key={a.id} style={{
              padding:"10px 18px", display:"flex", gap: 12, alignItems:"flex-start",
              borderBottom: i < activity.length - 1 ? `1px solid ${t.border}` : 0,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, background: t.surface2,
                color: t.soft, display:"grid", placeItems:"center", flexShrink:0,
              }}>
                <CRMIcon name={a.kind === "ai-action" ? "spark" : a.kind === "visit" ? "home" : a.kind === "call" ? "phone" : a.kind === "doc-signed" ? "check" : a.kind === "offer" ? "bolt" : a.kind === "email-open" ? "mail" : "msg"} size={13} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: t.ink, lineHeight: 1.4 }}>{a.text}</div>
                <div style={{ fontSize: 11, color: t.muted, marginTop: 3 }}>{crmRelative(a.at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {c.notes && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ margin:"0 0 10px", fontSize: 14, fontWeight: 700, color: t.ink }}>Notes</h3>
          <div style={{
            background: t.warnSoft, border: `1px solid ${t.warn}33`, borderRadius: 12,
            padding: "14px 16px", fontSize: 13, color: t.soft, lineHeight: 1.5,
          }}>{c.notes}</div>
        </div>
      )}
    </div>
  );
};

// ─── Matching screen ─────────────────────────────────────────────
const CRMScreenMatching = ({ t, dense }) => {
  return (
    <div style={{ padding: "24px 32px 60px" }}>
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: t.ink }}>Matching</h1>
          <div style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>
            Croisement automatique critères acheteurs ↔ caractéristiques biens
          </div>
        </div>
        <button style={crmBtnPrimaryBlue(t)}>
          <span style={{ display:"inline-flex", alignItems:"center", gap: 6 }}>
            <CRMIcon name="spark" size={13} stroke="#fff" /> Lancer le matching
          </span>
        </button>
      </div>

      <div style={{ display:"flex", gap: 6, marginBottom: 18 }}>
        {["Portefeuille","Marché public MEGGA","Inter-agences"].map((tab,i) => (
          <span key={tab} style={{
            padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
            background: i === 0 ? t.surface : "transparent", color: i === 0 ? t.ink : t.muted,
            border: i === 0 ? `1px solid ${t.border}` : `1px solid transparent`,
            cursor:"pointer",
          }}>{tab}</span>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap: 0,
        background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, marginBottom: 18 }}>
        <KpiCellM t={t} label="Total matchs" value={CRM_MATCHES.length} />
        <KpiCellM t={t} label="À envoyer" value={CRM_MATCHES.filter(m => m.status === "to-send").length} accent={t.primary} />
        <KpiCellM t={t} label="Vus / Aimés" value={CRM_MATCHES.filter(m => ["viewed","liked"].includes(m.status)).length} accent={t.ok} />
        <KpiCellM t={t} label="Score moyen" value={Math.round(CRM_MATCHES.reduce((s,m)=>s+m.score,0)/CRM_MATCHES.length)} last />
      </div>

      {/* Matrix */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow:"hidden" }}>
        <div style={{
          display:"grid", gridTemplateColumns:"50px 2fr 2fr 80px 1.6fr 100px",
          padding:"10px 14px", background: t.surface2, borderBottom: `1px solid ${t.border}`,
          fontSize: 10.5, fontWeight: 700, color: t.muted, letterSpacing: 0.4, textTransform:"uppercase",
        }}>
          <span>Score</span>
          <span>Acheteur</span>
          <span>Bien</span>
          <span>Statut</span>
          <span>Raisons (top)</span>
          <span style={{ textAlign:"right" }}>Action</span>
        </div>
        {CRM_MATCHES.sort((a,b) => b.score - a.score).map((m, i) => {
          const c = crmContactById(m.contactId);
          const b = crmBienById(m.bienId);
          const stMap = { "to-send":{label:"À envoyer",color:t.primary}, sent:{label:"Envoyé",color:t.muted}, viewed:{label:"Vu",color:t.warn}, liked:{label:"Aimé",color:t.ok}, rejected:{label:"Rejeté",color:t.danger} };
          const st = stMap[m.status];
          return (
            <div key={i} style={{
              display:"grid", gridTemplateColumns:"50px 2fr 2fr 80px 1.6fr 100px",
              padding:"12px 14px", alignItems:"center",
              borderBottom: i < CRM_MATCHES.length - 1 ? `1px solid ${t.border}` : 0,
            }}>
              <CRMScoreRing score={m.score} t={t} size={36} />
              <div style={{ display:"flex", alignItems:"center", gap: 10, minWidth:0 }}>
                <CRMAvatar contact={c} size={28} t={t} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.firstName} {c.lastName}</div>
                  <div style={{ fontSize: 11, color: t.muted }}>{crmFmtCHF(c.criteria?.budgetMax)}</div>
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{b.title}</div>
                <div style={{ fontSize: 11, color: t.muted }}>{b.ref} · {crmFmtCHF(b.price)}</div>
              </div>
              <span style={{
                padding:"3px 8px", fontSize: 10.5, fontWeight: 700, borderRadius: 999,
                background: st.color + "22", color: st.color,
                textAlign:"center", whiteSpace:"nowrap",
              }}>{st.label}</span>
              <div style={{ display:"flex", gap: 4, flexWrap:"wrap" }}>
                {m.reasons.slice(0,3).map((r,j) => (
                  <span key={j} style={{
                    padding:"2px 7px", fontSize: 10.5, fontWeight: 600,
                    background: t.surface2, border: `1px solid ${t.border}`,
                    color: t.soft, borderRadius: 4,
                  }}>{r}</span>
                ))}
                {m.reasons.length > 3 && <span style={{ fontSize: 10.5, color: t.muted }}>+{m.reasons.length - 3}</span>}
              </div>
              <div style={{ textAlign:"right" }}>
                <button style={{ ...crmBtnPrimary(t), height: 26 }}>{m.status === "to-send" ? "Envoyer" : "Détails"}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const KpiCellM = ({ t, label, value, accent, last }) => (
  <div style={{ padding: "16px 20px", borderRight: last ? 0 : `1px solid ${t.border}` }}>
    <div style={{ fontSize: 11, color: t.muted, fontWeight: 600, letterSpacing: 0.4, textTransform:"uppercase" }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 700, color: accent || t.ink, marginTop: 4, fontVariantNumeric:"tabular-nums" }}>{value}</div>
  </div>
);

// ─── Mes biens screen ──────────────────────────────────────────────
const CRMScreenBiens = ({ t, dense }) => {
  return (
    <div style={{ padding: "24px 32px 60px" }}>
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: t.ink }}>Mes biens</h1>
          <div style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>{CRM_BIENS.length} biens · {CRM_BIENS.filter(b => b.status === "active").length} actifs</div>
        </div>
        <button style={crmBtnPrimaryBlue(t)}>+ Ajouter un bien</button>
      </div>

      <div style={{ display:"flex", gap: 6, marginBottom: 18 }}>
        {[
          { k:"all", label:"Tous", count: CRM_BIENS.length },
          { k:"active", label:"Actifs", count: CRM_BIENS.filter(b => b.status === "active").length },
          { k:"draft", label:"Brouillons", count: CRM_BIENS.filter(b => b.status === "draft").length },
          { k:"reserved", label:"Réservés", count: CRM_BIENS.filter(b => b.status === "reserved").length },
        ].map((tab, i) => (
          <span key={tab.k} style={{
            padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
            background: i === 0 ? t.surface : "transparent", color: i === 0 ? t.ink : t.muted,
            border: i === 0 ? `1px solid ${t.border}` : 0,
            cursor:"pointer", display:"inline-flex", alignItems:"center", gap: 6,
          }}>
            {tab.label}
            <span style={{
              padding:"1px 6px", borderRadius: 999, background: i === 0 ? t.surface2 : "transparent",
              fontSize: 11, color: t.muted,
            }}>{tab.count}</span>
          </span>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap: 14 }}>
        {CRM_BIENS.map(b => <BienCard key={b.id} b={b} t={t} />)}
      </div>
    </div>
  );
};

const BienCard = ({ b, t }) => {
  const statusMap = {
    active:   { label:"Actif",     bg: t.okSoft,    fg: t.ok },
    draft:    { label:"Brouillon", bg: t.surface2,  fg: t.muted },
    reserved: { label:"Réservé",   bg: t.warnSoft,  fg: t.warn },
    sold:     { label:"Vendu",     bg: t.primarySoft, fg: t.primary },
    paused:   { label:"En pause",  bg: t.surface2,  fg: t.muted },
  };
  const s = statusMap[b.status];
  const matchCount = CRM_MATCHES.filter(m => m.bienId === b.id).length;
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow:"hidden",
      cursor:"pointer", boxShadow: t.shadow1,
    }}>
      {/* Image placeholder */}
      <div style={{
        height: 160, background: `linear-gradient(135deg, ${b.accent}22 0%, ${b.accent}08 100%)`,
        position:"relative", display:"grid", placeItems:"center",
        borderBottom: `1px solid ${t.border}`,
      }}>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", color: b.accent, opacity: 0.5 }}>
          <CRMIcon name="home" size={32} stroke={b.accent} />
          <div style={{ fontSize: 10.5, marginTop: 6, fontFamily:"JetBrains Mono, monospace" }}>{b.photoCount} photos</div>
        </div>
        <span style={{
          position:"absolute", top: 10, left: 10,
          padding:"3px 9px", borderRadius: 999, background: s.bg, color: s.fg,
          fontSize: 10.5, fontWeight: 700, textTransform:"uppercase", letterSpacing: 0.3,
        }}>{s.label}</span>
        {b.signedPhotoCount > 0 && (
          <span style={{
            position:"absolute", top: 10, right: 10,
            padding:"3px 8px", borderRadius: 999, background: t.surface, color: t.soft,
            fontSize: 10, fontWeight: 700, border: `1px solid ${t.border}`,
            display:"inline-flex", alignItems:"center", gap: 4,
          }}>
            <span style={{ width:5, height:5, borderRadius:999, background: t.ok }} />
            C2PA
          </span>
        )}
      </div>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, fontVariantNumeric:"tabular-nums", letterSpacing:-0.3 }}>
          {b.price ? crmFmtCHF(b.price) : crmFmtCHF(b.rent) + "/mois"}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: t.ink, marginTop: 4 }}>{b.title}</div>
        <div style={{ fontSize: 11.5, color: t.muted, marginTop: 2 }}>{b.addr}</div>
        <div style={{ display:"flex", gap: 12, marginTop: 10, fontSize: 11.5, color: t.soft }}>
          <span>{b.rooms}p</span>
          <span>·</span>
          <span>{b.beds}ch</span>
          <span>·</span>
          <span>{b.area}m²</span>
        </div>
        <div style={{
          display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap: 10, marginTop: 12,
          paddingTop: 12, borderTop: `1px solid ${t.border}`,
        }}>
          <Stat t={t} label="Vues" value={crmFmtNum(b.stats.views)} />
          <Stat t={t} label="Demandes" value={b.stats.visitRequests} />
          <Stat t={t} label="Matchs" value={matchCount} accent={matchCount > 0 ? t.primary : null} />
        </div>
      </div>
    </div>
  );
};

const Stat = ({ t, label, value, accent }) => (
  <div>
    <div style={{ fontSize: 14, fontWeight: 700, color: accent || t.ink, fontVariantNumeric:"tabular-nums" }}>{value}</div>
    <div style={{ fontSize: 10, color: t.muted, fontWeight: 600, textTransform:"uppercase", letterSpacing: 0.4, marginTop: 1 }}>{label}</div>
  </div>
);

window.CRMScreenContacts = CRMScreenContacts;
window.CRMScreenMatching = CRMScreenMatching;
window.CRMScreenBiens = CRMScreenBiens;
