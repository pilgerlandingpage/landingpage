import { NextResponse } from 'next/server'

type Video = {
  id: string
  title: string
}

const CHANNEL_ID = 'UC8KSmhgPny0GYi3EZGiedcw'
const CHANNEL_VIDEOS_URL = 'https://www.youtube.com/@guilhermepilger/videos'

const FALLBACK_LONG_VIDEOS: Video[] = [
  { id: '4Nq6YetnYE4', title: 'LUXO E PRIVACIDADE TOTAL NA PRAIA DO ESTALEIRO! - VIVENDAS DO ATLANTICO' },
  { id: 'BAx53RCtE40', title: 'PRECO INACREDITAVEL na BRAVA: Apartamento com cara de casa!' },
  { id: 'CzrReU7bKrg', title: 'PAGARIAM R$ 13.000.000 POR ISSO? A VISTA MAIS INCRIVEL DO MUNDO!' },
  { id: '9pJwCWpfUMQ', title: 'O PREDIO E FRENTE MAR, MAS E O PRECO?' },
  { id: 'rjfQsjTqsJk', title: 'Essa mansao em Itapema vai te fazer repensar tudo' },
  { id: 'IqSFRYrAQY8', title: 'Tentei vender uma cobertura de R$22 MILHOES para o Via Infinda' },
]

async function fetchTextWithTimeout(url: string, timeoutMs = 5000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      next: { revalidate: 3600 },
      signal: controller.signal,
    })

    if (!response.ok) return ''
    return response.text()
  } catch {
    return ''
  } finally {
    clearTimeout(timeout)
  }
}

function decodeText(value: string) {
  return value
    .replace(/\\u0026/g, '&')
    .replace(/\\"/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function cleanVideoId(value: string) {
  return value
    .replace(/\\u0026.*$/g, '')
    .replace(/&.*$/g, '')
    .trim()
}

function uniqueVideos(videos: Video[]) {
  const seen = new Set<string>()
  return videos.filter(video => {
    if (!video.id || !video.title || seen.has(video.id)) return false
    seen.add(video.id)
    return true
  })
}

function parseYouTubeRss(xml: string): Video[] {
  return Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g))
    .map(match => {
      const entry = match[1]
      const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] || ''
      const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''
      const link = entry.match(/<link[^>]+href="([^"]+)"/)?.[1] || ''

      return {
        id: cleanVideoId(id),
        title: decodeText(title),
        link,
      }
    })
    .filter(video => video.id && video.title && !video.link.includes('/shorts/'))
    .map(({ id, title }) => ({ id, title }))
}

function parseLongVideosPage(html: string): Video[] {
  const ids = Array.from(html.matchAll(/"url":"\/watch\?v=([^"]+)"/g))
    .map(match => cleanVideoId(match[1]))
    .filter(Boolean)

  return uniqueVideos(Array.from(new Set(ids)).map(id => {
    const videoIndex = html.indexOf(`"videoId":"${id}"`)
    const urlIndex = html.indexOf(`/watch?v=${id}`)
    const start = videoIndex >= 0 ? videoIndex : urlIndex
    const snippet = start >= 0 ? html.slice(start, start + 5000) : ''
    const title = snippet.match(/"title":\{"content":"([^"]+)"/)?.[1]
      || snippet.match(/"title":\{"simpleText":"([^"]+)"/)?.[1]
      || ''

    return {
      id,
      title: decodeText(title),
    }
  }))
}

async function fetchRssLongVideos() {
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`
  const xml = await fetchTextWithTimeout(rssUrl, 4500)

  if (!xml) return []
  return parseYouTubeRss(xml)
}

async function fetchChannelPageLongVideos() {
  const html = await fetchTextWithTimeout(CHANNEL_VIDEOS_URL, 4500)

  if (!html) return []
  return parseLongVideosPage(html)
}

export async function GET() {
  try {
    const [rssResult, pageResult] = await Promise.allSettled([
      fetchRssLongVideos(),
      fetchChannelPageLongVideos(),
    ])
    const rssVideos = rssResult.status === 'fulfilled' ? rssResult.value : []
    const pageVideos = pageResult.status === 'fulfilled' ? pageResult.value : []

    const videos = uniqueVideos([
      ...rssVideos,
      ...pageVideos,
      ...FALLBACK_LONG_VIDEOS,
    ]).slice(0, 10)

    return NextResponse.json({ videos })
  } catch (error) {
    console.error('Error fetching YouTube videos:', error)
    return NextResponse.json({ videos: FALLBACK_LONG_VIDEOS })
  }
}
