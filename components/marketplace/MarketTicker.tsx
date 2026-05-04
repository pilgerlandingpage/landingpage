import type { PublicMarketRadarFeed } from '@/lib/market-radar/public-feed'

function ToneMark({ tone }: { tone: 'up' | 'down' | 'neutral' }) {
  return <span className={`market-ticker-mark market-ticker-mark-${tone}`} />
}

function MiniSparkline({ tone }: { tone: 'up' | 'down' | 'neutral' }) {
  // Generate tiny SVG sparkline based on tone
  const points = tone === 'up'
    ? '0,10 4,9 8,11 12,7 16,8 20,5 24,6 28,3'
    : tone === 'down'
    ? '0,3 4,5 8,4 12,7 16,6 20,9 24,8 28,10'
    : '0,6 4,7 8,5 12,7 16,6 20,7 24,5 28,6'

  const color = tone === 'up' ? '#19c37d' : tone === 'down' ? '#ef4444' : '#d7bd82'

  return (
    <svg className="market-ticker-sparkline" viewBox="0 0 28 14" fill="none" preserveAspectRatio="none">
      <polyline points={points} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export default function MarketTicker({ feed }: { feed: PublicMarketRadarFeed }) {
  const dataItems = feed.ticker.length > 0 ? feed.ticker.slice(0, 10) : []

  if (dataItems.length === 0) return null

  // Mix the label into the scrolling items
  const labelObj = { isLabel: true as const }
  const mixedItems: Array<typeof dataItems[0] | typeof labelObj> = []
  
  // Insert a label every 3 items so it appears very frequently
  dataItems.forEach((item, index) => {
    if (index % 3 === 0) {
      mixedItems.push(labelObj)
    }
    mixedItems.push(item)
  })

  // Duplicate items 4x for seamless infinite scroll
  const loopItems = [...mixedItems, ...mixedItems, ...mixedItems, ...mixedItems]

  return (
    <section className="market-ticker-shell" aria-label="Radar Imobiliário">
      <div className="market-ticker-track" aria-hidden="true">
        <div className="market-ticker-loop">
          {loopItems.map((item, i) => {
            if ('isLabel' in item) {
              return (
                <div className="market-ticker-label" key={`label-${i}`}>
                  <span className="market-ticker-pulse" />
                  <span>Radar Imobiliário</span>
                  <strong>{feed.source === 'live' ? 'ao vivo' : 'preview'}</strong>
                </div>
              )
            }
            return (
              <div className="market-ticker-item" key={`${item.label}-${i}`}>
                <ToneMark tone={item.tone} />
                <span className="market-ticker-item-label">{item.label}</span>
                <MiniSparkline tone={item.tone} />
                <strong className={`market-ticker-item-value market-ticker-${item.tone}`}>{item.value}</strong>
              </div>
            )
          })}
        </div>
      </div>
      <div className="market-ticker-fade market-ticker-fade-left" />
      <div className="market-ticker-fade market-ticker-fade-right" />
    </section>
  )
}
