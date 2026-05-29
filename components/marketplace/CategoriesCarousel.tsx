'use client'

import Link from 'next/link'
import { Building2, Gem, Mountain, Palmtree, Sparkles, Warehouse } from 'lucide-react'

const CATEGORIES = [
  { icon: <Building2 size={22} />, label: 'Alto Padrao', href: '/busca?type=casa&priceMin=5000000' },
  { icon: <Palmtree size={22} />, label: 'Vista Mar', href: '/busca?tag=vista-mar' },
  { icon: <Palmtree size={22} />, label: 'Frente Mar', href: '/busca?tag=frente-mar' },
  { icon: <Building2 size={22} />, label: 'Coberturas', href: '/busca?subtype=cobertura' },
  { icon: <Gem size={22} />, label: 'Mansoes', href: '/busca?type=casa&priceMin=10000000' },
  { icon: <Warehouse size={22} />, label: 'Condominios', href: '/busca?subtype=condominio' },
  { icon: <Mountain size={22} />, label: 'Terrenos', href: '/busca?type=terreno' },
  { icon: <Sparkles size={22} />, label: 'Lancamentos', href: '/busca?tag=lancamento' },
]

function CategoryItem({ cat, idx }: { cat: typeof CATEGORIES[number]; idx: number }) {
  return (
    <Link
      href={cat.href}
      className={`quick-category-item ${idx === 2 ? 'active' : ''}`}
      aria-label={cat.label}
    >
      <div className="quick-category-icon">{cat.icon}</div>
      <span className="quick-category-label">{cat.label}</span>
    </Link>
  )
}

export default function CategoriesCarousel() {
  return (
    <>
      <div className="quick-categories-grid" aria-label="Pesquisa rapida">
        {CATEGORIES.map((cat, idx) => (
          <CategoryItem key={cat.label} cat={cat} idx={idx} />
        ))}
      </div>

      <style jsx global>{`
        .quick-categories-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0;
          width: 100%;
          max-width: 960px;
          margin: 0 auto;
          padding: 8px 6px 0;
        }

        .quick-category-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          gap: 3px;
          min-width: 0;
          min-height: 54px;
          cursor: pointer;
          color: var(--text-muted, #999);
          padding: 3px 2px 8px;
          border-bottom: 2px solid transparent;
          opacity: 0.55;
          text-decoration: none;
          transition: color 0.2s ease, opacity 0.2s ease, border-color 0.2s ease;
        }

        .quick-category-item:hover,
        .quick-category-item.active {
          color: var(--text-primary, #1a1a1a);
          border-bottom-color: var(--gold, #b8945f);
          opacity: 1;
        }

        .quick-category-item.active .quick-category-icon {
          color: var(--gold, #b8945f);
        }

        .quick-category-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 24px;
        }

        .quick-category-label {
          width: 100%;
          overflow: hidden;
          font-size: clamp(0.55rem, 2.45vw, 0.68rem);
          font-weight: 650;
          line-height: 1.05;
          text-align: center;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        @media (min-width: 768px) {
          .quick-categories-grid {
            grid-template-columns: repeat(8, minmax(0, 1fr));
            padding: 10px 18px 0;
          }

          .quick-category-item {
            min-height: 58px;
            padding-bottom: 10px;
          }

          .quick-category-label {
            font-size: 0.68rem;
          }
        }
      `}</style>
    </>
  )
}
