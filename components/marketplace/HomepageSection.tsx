'use client'

import Link from 'next/link'
import PropertyCard from '@/components/marketplace/PropertyCard'

interface HomepageSectionProps {
    title: string
    subtitle?: string
    properties: any[]
    lpMap: Map<string, string>
    viewAllHref?: string
    viewAllLabel?: string
}

export default function HomepageSection({
    title,
    subtitle,
    properties,
    lpMap,
    viewAllHref,
    viewAllLabel = 'Ver todos',
}: HomepageSectionProps) {
    if (!properties || properties.length === 0) return null

    return (
        <section className="homepage-section">
            <div className="section-header">
                <div>
                    <h2 className="section-title">{title}</h2>
                    {subtitle && <p className="section-subtitle">{subtitle}</p>}
                </div>
                {viewAllHref && (
                    <Link href={viewAllHref} className="section-view-all">
                        {viewAllLabel} →
                    </Link>
                )}
            </div>
            <div className="properties-grid">
                {properties.map((property: any) => (
                    <PropertyCard
                        key={property.id}
                        property={property}
                        landingPageSlug={lpMap.get(property.id)}
                    />
                ))}
            </div>

            <style jsx>{`
                .homepage-section {
                    margin-bottom: 8px;
                }
                .section-header {
                    display: flex;
                    align-items: baseline;
                    justify-content: space-between;
                    margin-bottom: 16px;
                    gap: 16px;
                }
                .section-title {
                    font-family: 'Inter', sans-serif;
                    font-size: 1.15rem;
                    font-weight: 700;
                    color: var(--text-primary, #1a1a1a);
                    margin: 0;
                    letter-spacing: -0.01em;
                }
                .section-subtitle {
                    font-size: 0.78rem;
                    color: var(--text-muted, #999);
                    margin: 2px 0 0 0;
                    font-weight: 400;
                }
                .section-view-all {
                    font-size: 0.82rem;
                    font-weight: 600;
                    color: var(--gold, #b8945f) !important;
                    white-space: nowrap;
                    transition: opacity 0.2s;
                    flex-shrink: 0;
                }
                .section-view-all:hover {
                    opacity: 0.7;
                }

                @media (min-width: 768px) {
                    .section-title { font-size: 1.3rem; }
                }
            `}</style>
        </section>
    )
}
