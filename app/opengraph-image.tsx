import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Guilherme Pilger - Imoveis de luxo no litoral catarinense'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #17120d 0%, #2d251b 45%, #f5efe4 100%)',
          color: '#fff8ea',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.14,
            background:
              'linear-gradient(90deg, transparent 0 44%, rgba(255,255,255,.55) 44% 45%, transparent 45% 100%), linear-gradient(0deg, transparent 0 44%, rgba(255,255,255,.45) 44% 45%, transparent 45% 100%)',
            backgroundSize: '92px 92px',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: -70,
            top: -120,
            width: 520,
            height: 520,
            borderRadius: '50%',
            background: 'rgba(201,169,110,.35)',
            filter: 'blur(20px)',
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '72px 78px 62px',
            width: '100%',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  fontSize: 34,
                  letterSpacing: 2,
                  fontWeight: 700,
                  color: '#fff8ea',
                }}
              >
                GUILHERME PILGER
              </div>
              <div
                style={{
                  fontSize: 18,
                  letterSpacing: 3,
                  fontFamily: 'Arial, sans-serif',
                  fontWeight: 800,
                  color: '#d7b674',
                }}
              >
                CRECI/SC 6772-J
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                padding: '12px 18px',
                border: '1px solid rgba(255,248,234,.35)',
                borderRadius: 999,
                fontSize: 18,
                fontFamily: 'Arial, sans-serif',
                fontWeight: 800,
                color: '#17120d',
                background: '#d7b674',
              }}
            >
              Pilger Luxury Search
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 44 }}>
            <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 760 }}>
              <div
                style={{
                  display: 'flex',
                  marginBottom: 18,
                  fontSize: 19,
                  letterSpacing: 4,
                  fontFamily: 'Arial, sans-serif',
                  fontWeight: 900,
                  color: '#d7b674',
                  textTransform: 'uppercase',
                }}
              >
                Curadoria premium em Santa Catarina
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 74,
                  lineHeight: 0.92,
                  fontWeight: 700,
                  letterSpacing: -1,
                  color: '#fff8ea',
                }}
              >
                Imoveis de luxo no litoral catarinense.
              </div>
              <div
                style={{
                  display: 'flex',
                  marginTop: 24,
                  maxWidth: 700,
                  fontSize: 25,
                  lineHeight: 1.35,
                  fontFamily: 'Arial, sans-serif',
                  color: 'rgba(255,248,234,.78)',
                }}
              >
                Balneario Camboriu, Praia Brava, Itapema e os enderecos mais desejados do alto padrao.
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                width: 260,
                padding: 22,
                border: '1px solid rgba(255,248,234,.28)',
                borderRadius: 28,
                background: 'rgba(255,248,234,.10)',
                boxShadow: '0 30px 80px rgba(0,0,0,.24)',
              }}
            >
              {['Frente mar', 'Coberturas', 'Casas alto padrao'].map((item) => (
                <div
                  key={item}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 18,
                    background: 'rgba(255,248,234,.88)',
                    color: '#17120d',
                    fontFamily: 'Arial, sans-serif',
                    fontSize: 18,
                    fontWeight: 900,
                  }}
                >
                  <span>{item}</span>
                  <span style={{ color: '#b8945f' }}>+</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    size
  )
}
