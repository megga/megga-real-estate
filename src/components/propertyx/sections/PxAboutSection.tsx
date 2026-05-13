// MEGGA Marketplace — Property X "About" section.
// Refactor utilisant les atomes (PxSectionLabel, PxButton, PxBadge).

import { PX, PxSectionLabel, PxButton, PxBadge } from '..'

export default function PxAboutSection() {
  return (
    <section style={{
      padding: `${PX.sectionDefault}px 40px`,
      background: PX.neutral100,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <PxSectionLabel>À propos de MEGGA</PxSectionLabel>
          <h2 style={{
            margin: '16px auto 0',
            maxWidth: 720,
            fontFamily: PX.font.display,
            fontSize: 'clamp(28px, 4vw, 48px)',
            lineHeight: 1.12,
            letterSpacing: '-1.4px',
            fontWeight: 500,
            color: PX.neutral700,
          }}>
            La meilleure façon de trouver votre prochain bien
          </h2>
        </div>

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
                fontWeight: 500,
                color: PX.neutral700,
                letterSpacing: '-0.6px',
                lineHeight: 1.25,
              }}>
                Une recherche transparente
              </h3>
              <p style={{
                margin: '8px 0 0',
                fontFamily: PX.font.sans,
                fontSize: 14,
                lineHeight: 1.5,
                letterSpacing: '-0.42px',
                color: PX.neutral500,
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
                fontWeight: 500,
                color: PX.neutral700,
                letterSpacing: '-0.6px',
                lineHeight: 1.25,
              }}>
                Des agents certifiés
              </h3>
              <p style={{
                margin: '8px 0 0',
                fontFamily: PX.font.sans,
                fontSize: 14,
                lineHeight: 1.5,
                letterSpacing: '-0.42px',
                color: PX.neutral500,
              }}>
                Tous les agents MEGGA passent par une vérification KYC complète.
                Vous savez à qui vous parlez.
              </p>
            </div>
            <div style={{ marginTop: 8 }}>
              <PxButton to="/acheter" variant="primary" size="lg">
                Commencer
              </PxButton>
            </div>
          </div>

          {/* Colonne centre : aperçu app */}
          <div style={{
            position: 'relative',
            height: 480,
            background: PX.neutral100,
            borderRadius: 36,
            boxShadow: PX.shadow.regular,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflow: 'hidden',
          }}>
            <div style={{
              height: 200,
              borderRadius: PX.radius.small,
              backgroundImage: `url("https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=900&q=80")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              position: 'relative',
            }}>
              <span style={{ position: 'absolute', top: 12, left: 12 }}>
                <PxBadge variant="invert" size="sm">À louer</PxBadge>
              </span>
            </div>
            <div style={{ padding: '4px 8px' }}>
              <div style={{
                fontFamily: PX.font.sans,
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: '-0.42px',
                color: PX.neutral700,
              }}>
                Appartement 4.5 p. · Genève
              </div>
              <div style={{
                fontFamily: PX.font.sans,
                fontSize: 14,
                fontWeight: 400,
                letterSpacing: '-0.42px',
                color: PX.neutral500,
                marginTop: 2,
              }}>
                Rue du Mont-Blanc · CHF 3'200/mois
              </div>
            </div>
            <div style={{
              height: 200,
              borderRadius: PX.radius.small,
              backgroundImage: `url("https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=900&q=80")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              marginTop: 4,
              position: 'relative',
            }}>
              <span style={{ position: 'absolute', top: 12, left: 12 }}>
                <PxBadge variant="invert" size="sm">À vendre</PxBadge>
              </span>
            </div>
          </div>

          {/* Colonne droite : stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            <div>
              <PxSectionLabel>Biens disponibles</PxSectionLabel>
              <div style={{
                fontFamily: PX.font.display,
                fontSize: 80,
                fontWeight: 500,
                lineHeight: 1.05,
                letterSpacing: '-3px',
                color: PX.neutral700,
                fontVariantNumeric: 'tabular-nums',
                marginTop: 12,
              }}>33k+</div>
              <p style={{
                margin: '12px 0 0',
                fontFamily: PX.font.sans,
                fontSize: 14,
                lineHeight: 1.5,
                letterSpacing: '-0.42px',
                color: PX.neutral500,
                maxWidth: 220,
              }}>
                Mis à jour quotidiennement depuis l'ensemble de la Suisse.
              </p>
            </div>
            <div>
              <PxSectionLabel>Cantons couverts</PxSectionLabel>
              <div style={{
                fontFamily: PX.font.display,
                fontSize: 80,
                fontWeight: 500,
                lineHeight: 1.05,
                letterSpacing: '-3px',
                color: PX.neutral700,
                fontVariantNumeric: 'tabular-nums',
                marginTop: 12,
              }}>26</div>
              <p style={{
                margin: '12px 0 0',
                fontFamily: PX.font.sans,
                fontSize: 14,
                lineHeight: 1.5,
                letterSpacing: '-0.42px',
                color: PX.neutral500,
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
