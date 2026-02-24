'use client'

import { useState } from 'react'
import { Search, List, Map as MapIcon } from 'lucide-react'

interface SearchViewsProps {
    children: React.ReactNode // The list view
    map: React.ReactNode // The map component
}

export default function SearchViews({ children, map }: SearchViewsProps) {
    const [showMapMobile, setShowMapMobile] = useState(true)

    return (
        <main className="flex flex-1 overflow-hidden relative">

            {/* Left: List View */}
            {/* On mobile: hidden if showMapMobile is true */}
            <div className={`overflow-y-auto border-r border-[#e8e5e0] ${showMapMobile ? 'hidden xl:block' : 'block w-full'} xl:w-[52%] 2xl:w-[48%] xl:min-w-[520px] xl:max-w-[780px]`}>
                <div className="px-6 py-5 md:px-8">
                    {children}
                </div>
            </div>

            {/* Right: Map View */}
            {/* On mobile: block if showMapMobile is true, else hidden */}
            {/* On desktop (xl): always block */}
            <div className={`flex-1 relative ${showMapMobile ? 'block' : 'hidden xl:block'}`}>
                {map}
            </div>

            {/* Mobile Toggle Button */}
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 xl:hidden">
                <button
                    onClick={() => setShowMapMobile(!showMapMobile)}
                    className="flex items-center gap-2 rounded-full bg-[#1a1a1a] px-6 py-3 text-sm font-semibold text-white shadow-lg transition transform hover:scale-105 hover:bg-[#000] active:scale-95"
                >
                    {showMapMobile ? (
                        <>Lista <List size={16} /></>
                    ) : (
                        <>Mapa <MapIcon size={16} /></>
                    )}
                </button>
            </div>

        </main>
    )
}
