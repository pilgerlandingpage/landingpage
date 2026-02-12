'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard,
    Users,
    FileText,
    Bot,
    Zap,
    Building2,
    Settings,
    BarChart3,
    Filter,
    Wrench,
} from 'lucide-react'

const navItems = [
    {
        label: 'PRINCIPAL', items: [
            { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
            { href: '/admin/funnel', icon: Filter, label: 'Funil de Conversão' },
            { href: '/admin/leads', icon: Users, label: 'Leads' },
        ]
    },
    {
        label: 'CONTEÚDO', items: [
            { href: '/admin/pages', icon: FileText, label: 'Landing Pages' },
            { href: '/admin/properties', icon: Building2, label: 'Imóveis' },
            { href: '/admin/agents', icon: Bot, label: 'Agentes IA' },
        ]
    },
    {
        label: 'AUTOMAÇÃO', items: [
            { href: '/admin/automation', icon: Zap, label: 'Automações' },
        ]
    },
    {
        label: 'SISTEMA', items: [
            { href: '/admin/maintenance', icon: Wrench, label: 'Manutenção' },
            { href: '/admin/settings', icon: Settings, label: 'Configurações' },
        ]
    },
]

export default function AdminSidebar() {
    const pathname = usePathname()

    return (
        <aside className="admin-sidebar">
            <div className="admin-sidebar-logo">
                <h2>Pilger Admin</h2>
                <span>Painel de Controle</span>
            </div>
            <nav className="admin-nav">
                {navItems.map((section) => (
                    <div key={section.label}>
                        <div className="admin-nav-section">{section.label}</div>
                        {section.items.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`admin-nav-item ${pathname === item.href ? 'active' : ''}`}
                            >
                                <item.icon size={18} />
                                {item.label}
                            </Link>
                        ))}
                    </div>
                ))}
            </nav>
        </aside>
    )
}
