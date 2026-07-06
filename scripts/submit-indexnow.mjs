const DEFAULT_HOST = 'guilhermepilger.ai'
const DEFAULT_KEY = 'cb1faa31259c49d2a40945fee50acd51'
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'

function normalizeUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  return `https://${DEFAULT_HOST}${raw.startsWith('/') ? raw : `/${raw}`}`
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

const args = process.argv.slice(2)
const urls = unique(args.map(normalizeUrl))

if (!urls.length) {
  console.error('Uso: npm run seo:indexnow -- https://guilhermepilger.ai/url-ou-/caminho')
  process.exit(1)
}

const key = process.env.INDEXNOW_KEY || DEFAULT_KEY
const host = process.env.INDEXNOW_HOST || DEFAULT_HOST
const keyLocation = process.env.INDEXNOW_KEY_LOCATION || `https://${host}/${key}.txt`

const response = await fetch(INDEXNOW_ENDPOINT, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
  },
  body: JSON.stringify({
    host,
    key,
    keyLocation,
    urlList: urls,
  }),
})

const text = await response.text()

console.log(JSON.stringify({
  ok: response.ok,
  status: response.status,
  statusText: response.statusText,
  submitted: urls,
  keyLocation,
  response: text || null,
}, null, 2))

if (!response.ok) {
  process.exit(1)
}
