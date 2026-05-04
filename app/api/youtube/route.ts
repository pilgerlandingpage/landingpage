import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const channelId = 'UC8KSmhgPny0GYi3EZGiedcw'
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`
    
    const response = await fetch(apiUrl, {
      next: { revalidate: 3600 }
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch YouTube RSS feed via rss2json')
    }
    
    const data = await response.json()
    
    if (data.status !== 'ok') {
      throw new Error('Failed to parse YouTube RSS feed')
    }
    
    const longVideos = data.items.filter((item: any) => !item.link.includes('shorts/'))
    
    const videos = longVideos.slice(0, 10).map((item: any) => {
      // guid format is usually yt:video:VIDEO_ID
      let videoId = ''
      if (item.guid && item.guid.includes('yt:video:')) {
        videoId = item.guid.split('yt:video:')[1]
      } else if (item.link.includes('v=')) {
        videoId = item.link.split('v=')[1].split('&')[0]
      }
      
      return {
        id: videoId || Math.random().toString(36).substr(2, 9), // Fallback ID se falhar
        title: item.title
      }
    })
    
    return NextResponse.json({ videos })
  } catch (error) {
    console.error('Error fetching YouTube videos:', error)
    return NextResponse.json({ error: 'Failed to fetch videos', videos: [] }, { status: 500 })
  }
}
