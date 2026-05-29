import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: 'linear-gradient(135deg, #15110d 0%, #3a2d1f 100%)',
          border: '9px solid #c9a96e',
          borderRadius: '42px',
          boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.12)',
          color: '#f8ead0',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Georgia, serif',
          height: '100%',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <div style={{ fontSize: 78, fontWeight: 800, letterSpacing: -6, lineHeight: 1 }}>GP</div>
        <div
          style={{
            color: '#c9a96e',
            fontFamily: 'Arial, sans-serif',
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 2,
            marginTop: 6,
          }}
        >
          LUXURY
        </div>
      </div>
    ),
    size
  )
}
