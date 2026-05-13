// MEGGA Marketplace — Property X "About" section.
// Pill label · titre centré · 2 colonnes (texte gauche · iPhone mockup centre
// · stats droite). Adapté pour MEGGA : narrative sur la marketplace + KPIs.

import { PX } from '../tokens'
import PxButton, { PxArrowRight } from '../PxButton'
import PxSectionLabel from '../PxSectionLabel'

export default function PxAboutSection() {
  return (
    <section style={{
      padding: `${PX.space.section}px ${PX.space.pageX}px`,
      background: PX.pageBg,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* En-tête centré */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <PxSectionLabel>À propos de MEGGA</PxSectionLabel>
          <h2 style={{
            margin: '16px auto 0',
            maxWidth: 720,
            fontFamily: PX.font.display,
            fontSize: 'clamp(28px, 4vw, 48px)',
            lineHeight: 1.12,
            letterSpacing: -0.8,
            fontWeight: 600,
            color: PX.ink,
          }}>
            La meilleure façon de trouver votre prochain bien
          </h2>
        </div>

        {/* Layout 3 colonnes : texte / iPhone mockup / stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr 1fr',
          gap: 48,
          alignItems: 'center',
        }}>
          {/* Colonne gauche : narrative */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <h3 style={{
                margin: 0,
                fontFamily: PX.font.display,
                fontSize: 20,
                fontWeight: 600,
                color: PX.ink,
                letterSpacing: -0.2,
              }}>
                Une recherche transparente
              </h3>
              <p style={{
                margin: '8px 0 0',
                fontSize: 14.5,
                lineHeight: 1.6,
                color: PX.inkSoft,
              }}>
                33 000 biens à louer, 26 cantons, 4 langues. Filtres précis,
                carte interactive, alertes personnalisées.
              </p>
            </div>
            <div>
              <h3 style={{
                margin: 0,
                fontFamily: PX.font.display,
                fontSize: 20,
                fontWeight: 600,
                color: PX.ink,
                letterSpacing: -0.2,
              }}>
                Des agents certifiés
              </h3>
              <p style={{
                margin: '8px 0 0',
                fontSize: 14.5,
                lineHeight: 1.6,
                color: PX.inkSoft,
              }}>
                Tous les agents MEGGA passent par une vérification KYC complète.
                Vous savez à qui vous parlez.
              </p>
            </div>
            <div style={{ marginTop: 8 }}>
              <PxButton to="/acheter" variant="primary" size="md" trail={<PxArrowRight />}>
                Commencer
              </PxButton>
            </div>
          </div>

          {/* Colonne centre : "iPhone mockup" simplifié (rectangle avec 2 cards) */}
          <div style={{
            position: 'relative',
            height: 480,
            background: PX.surfaceBg,
            borderRadius: 36,
            boxShadow: PX.shadow.card,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflow: 'hidden',
          }}>
            <div style={{
              height: 200,
              borderRadius: PX.radiusImage,
              backgroundImage: `url("https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=900&q=80")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              position: 'relative',
            }}>
              <span style={{
                position: 'absolute', top: 12, left: 12,
                padding: '4px 10px',
                background: PX.surfaceBg,
                borderRadius: PX.radiusPill,
                fontSize: 11.5,
                fontWeight: 600,
                color: PX.ink,
              }}>À louer</span>
            </div>
            <div style={{ padding: '4px 8px' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: PX.ink }}>
                Appartement 4.5 p. · Genève
              </div>
              <div style={{ fontSize: 12.5, color: PX.inkMuted, marginTop: 2 }}>
                Rue du Mont-Blanc · CHF 3'200/mois
              </div>
            </div>
            <div style={{
              height: 200,
              borderRadius: PX.radiusImage,
              backgroundImage: `url("https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=900&q=80")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              marginTop: 4,
              position: 'relative',
            }}>
              <span style={{
                position: 'absolute', top: 12, left: 12,
                padding: '4px 10px',
                background: PX.surfaceBg,
                borderRadius: PX.radiusPill,
                fontSize: 11.5,
                fontWeight: 600,
                color: PX.ink,
              }}>À vendre</span>
            </div>
          </div>

          {/* Colonne droite : stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            <div>
              <div style={{
                fontSize: 13,
                color: PX.inkMuted,
                marginBottom: 8,
                letterSpacing: 0.3,
              }}>Biens disponibles</div>
              <div style={{
                fontFamily: PX.font.display,
                fontSize: 56,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: -1.6,
                color: PX.ink,
                fontVariantNumeric: 'tabular-nums',
              }}>33k+</div>
              <p style={{
                margin: '12px 0 0',
                fontSize: 13.5,
                lineHeight: 1.55,
                color: PX.inkSoft,
                maxWidth: 220,
              }}>
                Mis à jour quotidiennement depuis l'ensemble de la Suisse.
              </p>
            </div>
            <div>
              <div style={{
                fontSize: 13,
                color: PX.inkMuted,
                marginBottom: 8,
                letterSpacing: 0.3,
              }}>Cantons couverts</div>
              <div style={{
                fontFamily: PX.font.display,
                fontSize: 56,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: -1.6,
                color: PX.ink,
                fontVariantNumeric: 'tabular-nums',
              }}>26</div>
              <p style={{
                margin: '12px 0 0',
                fontSize: 13.5,
                lineHeight: 1.55,
                color: PX.inkSoft,
                maxWidth: 220,
              }}>
                Toute la Suisse, de Genève à St-Gall, en 4 langues.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
