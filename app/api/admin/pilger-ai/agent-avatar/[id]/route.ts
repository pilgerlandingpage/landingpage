import { NextRequest, NextResponse } from 'next/server'

const PALETTES = [
    { bg1: '#17120d', bg2: '#6f5125', suit: '#111111', shirt: '#f7f1e6', accent: '#c9a96e', hair: '#2b1d14', skin: '#d8a06f' },
    { bg1: '#13201c', bg2: '#0f766e', suit: '#17201d', shirt: '#f5efe2', accent: '#34d399', hair: '#15110d', skin: '#b97a57' },
    { bg1: '#19172a', bg2: '#6d28d9', suit: '#151525', shirt: '#f6f0ff', accent: '#c084fc', hair: '#3b2415', skin: '#e0aa7b' },
    { bg1: '#1b1220', bg2: '#be185d', suit: '#181014', shirt: '#fff1f2', accent: '#fb7185', hair: '#1f130d', skin: '#c98761' },
    { bg1: '#111827', bg2: '#1d4ed8', suit: '#111827', shirt: '#eff6ff', accent: '#60a5fa', hair: '#16100c', skin: '#d39a72' },
    { bg1: '#1c1917', bg2: '#92400e', suit: '#1c1917', shirt: '#fff7ed', accent: '#f59e0b', hair: '#2f1a0e', skin: '#a96d4c' },
]

const FEMALE_IDS = new Set([
    'pilger-ai-core',
    'property-triage',
    'property-register',
    'whatsapp-lead-extraction',
    'whatsapp-attendance-coach',
    'whatsapp-rescue-agent',
    'user-first-access-agent',
    'pilger-daily-report',
    'market-radar',
    'blog-intelligence',
    'research-pilger',
])

function hashId(id: string) {
    let hash = 0
    for (let i = 0; i < id.length; i += 1) {
        hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
    }
    return Math.abs(hash)
}

function buildAvatarSvg(id: string) {
    const hash = hashId(id)
    const palette = PALETTES[hash % PALETTES.length]
    const female = FEMALE_IDS.has(id)
    const faceX = 128 + ((hash % 7) - 3)
    const eyeOffset = female ? 19 : 18
    const jaw = female ? 'M90 135 C94 186 111 207 128 207 C145 207 162 186 166 135 C158 110 98 110 90 135Z' : 'M88 132 C92 184 110 212 128 212 C146 212 164 184 168 132 C159 111 97 111 88 132Z'
    const hair = female
        ? `M76 122 C74 82 95 56 128 56 C163 56 184 83 181 128 C178 163 167 185 156 202 C161 154 152 116 128 109 C104 116 95 154 100 202 C88 187 79 160 76 122Z`
        : `M82 118 C82 78 100 58 130 58 C160 58 178 80 175 118 C159 103 126 95 91 114 C88 115 85 117 82 118Z`
    const jacketPath = female
        ? 'M52 246 C60 213 86 194 111 190 L128 224 L145 190 C170 194 196 213 204 246 Z'
        : 'M48 246 C58 211 85 194 110 190 L128 218 L146 190 C171 194 198 211 208 246 Z'
    const mouth = female ? 'M115 159 C122 165 134 165 141 159' : 'M116 162 C123 167 133 167 140 162'

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="Retrato corporativo de agente IA">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.bg1}"/>
      <stop offset="1" stop-color="${palette.bg2}"/>
    </linearGradient>
    <radialGradient id="light" cx="42%" cy="18%" r="72%">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".42"/>
      <stop offset=".42" stop-color="#ffffff" stop-opacity=".12"/>
      <stop offset="1" stop-color="#000000" stop-opacity=".18"/>
    </radialGradient>
    <linearGradient id="suit" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.suit}"/>
      <stop offset="1" stop-color="#050505"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="14" stdDeviation="10" flood-color="#000000" flood-opacity=".34"/>
    </filter>
  </defs>
  <rect width="256" height="256" rx="32" fill="url(#bg)"/>
  <rect width="256" height="256" rx="32" fill="url(#light)"/>
  <circle cx="207" cy="45" r="46" fill="${palette.accent}" opacity=".16"/>
  <circle cx="37" cy="217" r="54" fill="#ffffff" opacity=".08"/>
  <path d="${jacketPath}" fill="url(#suit)" filter="url(#shadow)"/>
  <path d="M108 190 L128 229 L148 190 L139 246 L117 246 Z" fill="${palette.shirt}"/>
  <path d="M122 218 L128 229 L134 218 L132 246 L124 246 Z" fill="${palette.accent}" opacity=".95"/>
  <path d="${hair}" fill="${palette.hair}"/>
  <path d="${jaw}" fill="${palette.skin}" filter="url(#shadow)"/>
  <path d="M91 128 C106 113 151 113 165 128 C157 105 101 105 91 128Z" fill="${palette.hair}" opacity=".85"/>
  <circle cx="${faceX - eyeOffset}" cy="142" r="4" fill="#2b1a12"/>
  <circle cx="${faceX + eyeOffset}" cy="142" r="4" fill="#2b1a12"/>
  <path d="M128 145 C124 154 123 158 130 160" fill="none" stroke="#8c573d" stroke-width="3" stroke-linecap="round" opacity=".58"/>
  <path d="${mouth}" fill="none" stroke="#7a3329" stroke-width="3" stroke-linecap="round"/>
  <path d="M96 132 C105 127 112 127 119 131" fill="none" stroke="${palette.hair}" stroke-width="4" stroke-linecap="round" opacity=".75"/>
  <path d="M137 131 C144 127 153 127 161 132" fill="none" stroke="${palette.hair}" stroke-width="4" stroke-linecap="round" opacity=".75"/>
  <path d="M68 246 C76 220 97 203 114 199" fill="none" stroke="${palette.accent}" stroke-width="2" opacity=".55"/>
  <path d="M188 246 C180 220 159 203 142 199" fill="none" stroke="${palette.accent}" stroke-width="2" opacity=".55"/>
</svg>`
}

export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params
    return new NextResponse(buildAvatarSvg(id || 'agent'), {
        headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
    })
}
