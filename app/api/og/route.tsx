import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get('title') || 'Guilherme Pilger'
  const subtitle = request.nextUrl.searchParams.get('subtitle') || 'Imoveis de luxo no litoral catarinense'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 74,
          background: 'linear-gradient(135deg, #17120d 0%, #30271d 55%, #d7b674 100%)',
          color: '#fff8ea',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <strong style={{ fontSize: 34, letterSpacing: 2 }}>GUILHERME PILGER</strong>
            <span style={{ fontSize: 17, letterSpacing: 3, color: '#d7b674', fontFamily: 'Arial, sans-serif', fontWeight: 900 }}>
              CRECI/SC 6772-J
            </span>
          </div>
          <div style={{ display: 'flex', borderRadius: 999, background: '#fff8ea', color: '#17120d', padding: '13px 18px', fontFamily: 'Arial, sans-serif', fontWeight: 900 }}>
            Pilger Luxury Search
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 860 }}>
          <div style={{ display: 'flex', marginBottom: 18, color: '#d7b674', fontFamily: 'Arial, sans-serif', fontSize: 18, letterSpacing: 4, fontWeight: 900, textTransform: 'uppercase' }}>
            Curadoria premium
          </div>
          <div style={{ display: 'flex', fontSize: 78, lineHeight: 0.92, fontWeight: 700 }}>{title}</div>
          <div style={{ display: 'flex', marginTop: 24, fontSize: 27, lineHeight: 1.35, fontFamily: 'Arial, sans-serif', color: 'rgba(255,248,234,.78)' }}>
            {subtitle}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
