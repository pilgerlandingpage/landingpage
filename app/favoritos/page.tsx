import type { Metadata } from 'next'
import GlobalHeader from '@/components/layout/GlobalHeader'
import FavoritePropertiesClient from '@/components/marketplace/FavoritePropertiesClient'
import { JsonLd, breadcrumbJsonLd, organizationJsonLd, webPageJsonLd } from '@/lib/seo/json-ld'

export const metadata: Metadata = {
    title: 'Favoritos e comparacao de imoveis',
    description: 'Compare os imoveis favoritos da curadoria Guilherme Pilger e solicite uma leitura especializada.',
    alternates: {
        canonical: '/favoritos',
    },
}

export default function FavoritosPage() {
    const jsonLd = [
        organizationJsonLd(),
        webPageJsonLd({
            path: '/favoritos',
            name: 'Favoritos e comparacao de imoveis',
            description: 'Area para comparar imoveis favoritos e solicitar curadoria especializada.',
            type: 'CollectionPage',
        }),
        breadcrumbJsonLd([
            { name: 'Home', url: '/' },
            { name: 'Favoritos', url: '/favoritos' },
        ]),
    ]

    return (
        <div>
            <GlobalHeader />
            <JsonLd data={jsonLd} />
            <FavoritePropertiesClient />
        </div>
    )
}
