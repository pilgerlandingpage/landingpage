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
    Wand2,
    ShieldCheck,
    UserCircle,
    UserCog,
    MessageSquareHeart,
    LogOut,
    UserPlus,
    Bell,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
            { href: '/admin/cloner', icon: Wand2, label: 'Clonador AI' },
            { href: '/admin/properties', icon: Building2, label: 'Imóveis' },
            { href: '/admin/brokers', icon: ShieldCheck, label: 'Corretores' },
            { href: '/admin/agents', icon: UserCog, label: 'Config. AI' },
        ]
    },
    {
        label: 'AUTOMAÇÃO', items: [
            { href: '/admin/automation', icon: Zap, label: 'Automações' },
            { href: '/admin/push', icon: Bell, label: 'Notificações' },
        ]
    },
    {
        label: 'SISTEMA', items: [
            { href: '/admin/feedback', icon: MessageSquareHeart, label: 'Feedback' },
            { href: '/admin/maintenance', icon: Wrench, label: 'Sala de Manutenção' },
            { href: '/admin/settings', icon: Settings, label: 'Configurações' },
            { href: '/admin/users/new', icon: UserPlus, label: 'Novo Usuário' },
        ]
    },
]

export default function AdminSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    return (
        <aside className="admin-sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
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

            <div style={{ marginTop: 'auto', padding: '20px', borderTop: '1px solid var(--border-color)' }}>
                <button
                    onClick={handleLogout}
                    className="admin-nav-item"
                    style={{
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#ff4d4d',
                        justifyContent: 'flex-start'
                    }}
                >
                    <LogOut size={18} />
                    Sair
                </button>
            </div>
        </aside>
    )
}
