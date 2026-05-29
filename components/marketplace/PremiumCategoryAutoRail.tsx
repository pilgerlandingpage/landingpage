'use client'

import { useEffect, useRef } from 'react'

export default function PremiumCategoryAutoRail({ children }: { children: React.ReactNode }) {
    const railRef = useRef<HTMLDivElement>(null)
    const directionRef = useRef(1)
    const pauseUntilRef = useRef(0)

    const pauseAutoScroll = (duration = 4200) => {
        pauseUntilRef.current = Date.now() + duration
    }

    useEffect(() => {
        let frame = 0
        let last = performance.now()

        const tick = (time: number) => {
            const rail = railRef.current
            if (rail && Date.now() > pauseUntilRef.current) {
                const delta = Math.min(time - last, 48)
                const maxScroll = rail.scrollWidth - rail.clientWidth

                if (maxScroll > 2) {
                    if (rail.scrollLeft >= maxScroll - 1) directionRef.current = -1
                    if (rail.scrollLeft <= 1) directionRef.current = 1
                    rail.scrollLeft += directionRef.current * delta * 0.075
                }
            }

            last = time
            frame = requestAnimationFrame(tick)
        }

        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [])

    return (
        <div
            className="premium-category-grid"
            ref={railRef}
            onPointerDown={() => pauseAutoScroll(5200)}
            onTouchStart={() => pauseAutoScroll(5200)}
            onWheel={() => pauseAutoScroll(5200)}
            onFocusCapture={() => pauseAutoScroll(5200)}
        >
            {children}
        </div>
    )
}
