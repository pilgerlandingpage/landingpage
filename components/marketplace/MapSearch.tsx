'use client'

import dynamic from 'next/dynamic'


const PropertyMap = dynamic(
    () => import('./PropertyMap'),
    {
        ssr: false,
        loading: () => <MapSkeleton />
    }
)

function MapSkeleton() {
    return (
        <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center text-gray-400">
            <span className="text-sm">Carregando mapa...</span>
        </div>
    )
}

interface MapSearchProps {
    properties: any[]
}

export default function MapSearch({ properties }: MapSearchProps) {
    return (
        <div className="w-full h-full min-h-[400px] relative overflow-hidden">
            <PropertyMap properties={properties} />
        </div>
    )
}
