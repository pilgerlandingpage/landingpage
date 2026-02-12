'use client'

import { Bed, Bath, Maximize, MapPin, Car, Waves, Star } from 'lucide-react'

interface PropertyDetailsProps {
    bedrooms?: number
    bathrooms?: number
    area?: number
    city?: string
    parking?: number
    amenities?: string[]
    price?: number
}

const amenityIcons: Record<string, React.ReactNode> = {
    piscina: <Waves size={20} />,
    garagem: <Car size={20} />,
    default: <Star size={20} />,
}

export function PropertyInfo({
    bedrooms,
    bathrooms,
    area,
    city,
    parking,
    price,
}: PropertyDetailsProps) {
    return (
        <div className="property-details">
            {bedrooms && (
                <div className="detail-item">
                    <Bed size={24} color="#c9a96e" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <div className="detail-value">{bedrooms}</div>
                    <div className="detail-label">Quartos</div>
                </div>
            )}
            {bathrooms && (
                <div className="detail-item">
                    <Bath size={24} color="#c9a96e" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <div className="detail-value">{bathrooms}</div>
                    <div className="detail-label">Banheiros</div>
                </div>
            )}
            {area && (
                <div className="detail-item">
                    <Maximize size={24} color="#c9a96e" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <div className="detail-value">{area}</div>
                    <div className="detail-label">m²</div>
                </div>
            )}
            {parking && (
                <div className="detail-item">
                    <Car size={24} color="#c9a96e" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <div className="detail-value">{parking}</div>
                    <div className="detail-label">Vagas</div>
                </div>
            )}
            {city && (
                <div className="detail-item">
                    <MapPin size={24} color="#c9a96e" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <div className="detail-value" style={{ fontSize: '1.2rem' }}>{city}</div>
                    <div className="detail-label">Localização</div>
                </div>
            )}
            {price && (
                <div className="detail-item">
                    <div className="detail-value">R$ {(price / 1000000).toFixed(1)}M</div>
                    <div className="detail-label">Valor</div>
                </div>
            )}
        </div>
    )
}

export function AmenitiesGrid({ amenities = [] }: { amenities: string[] }) {
    return (
        <div className="features-grid">
            {amenities.map((amenity, index) => (
                <div key={index} className="feature-card">
                    <div className="feature-icon">
                        {amenityIcons[amenity.toLowerCase()] || amenityIcons.default}
                    </div>
                    <div className="feature-title">{amenity}</div>
                </div>
            ))}
        </div>
    )
}
