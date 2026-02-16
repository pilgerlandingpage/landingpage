import * as cheerio from 'cheerio'

export async function scrapePage(url: string) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; PilgerBot/1.0; +http://pilger.com.br)',
            },
        })
        const html = await response.text()
        const $ = cheerio.load(html)

        // Remove unnecessary tags
        $('script').remove()
        $('style').remove()
        $('iframe').remove()
        $('noscript').remove()

        // Extract Title
        const title = $('title').text() || $('h1').first().text()

        // Extract Meta Description
        const description = $('meta[name="description"]').attr('content') || ''

        // Extract Images (get largest ones ideally, for now just first 10)
        const images: string[] = []
        $('img').each((i, el) => {
            const src = $(el).attr('src')
            if (src && src.startsWith('http') && images.length < 10) {
                images.push(src)
            }
        })

        // Get Body Text (clean)
        const bodyText = $('body').text().replace(/\s+/g, ' ').substring(0, 50000)

        // Return a cleaner structure for Gemini
        return {
            title,
            description,
            images,
            html: $.html(), // Full HTML helps Gemini understand structure better than just text
        }
    } catch (error) {
        console.error('Scraping Error:', error)
        throw new Error(`Failed to scrape URL: ${url}`)
    }
}
