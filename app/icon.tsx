import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = {
  width: 64,
  height: 64,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: 'linear-gradient(135deg, #15110d 0%, #2e2419 100%)',
          border: '4px solid #c9a96e',
          borderRadius: '18px',
          color: '#f8ead0',
          display: 'flex',
          fontFamily: 'Georgia, serif',
          fontSize: 28,
          fontWeight: 800,
          height: '100%',
          justifyContent: 'center',
          letterSpacing: -2,
          width: '100%',
        }}
      >
        GP
      </div>
    ),
    size
  )
}
