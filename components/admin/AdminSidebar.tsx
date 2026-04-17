'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
    LayoutDashboard,
    Users,
    FileText,
    Zap,
    Building2,
    BarChart3,
    Filter,
    Wrench,
    ShieldCheck,
    MessageSquareHeart,
    LogOut,
    Bell,
    Megaphone,
    Settings,
    Shield,
    UserCog,
    Loader2,
    Crown,
    Radar,
    Smartphone,
    Send,
    Tag,
    Brain
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// Map module_key to sidebar items
const MODULE_NAV: Record<string, { href: string; icon: any; label: string; section: string; subItems?: { href: string; label: string; icon?: any }[] }> = {
    dashboard: { href: '/admin', icon: LayoutDashboard, label: 'Dashboard', section: 'PRINCIPAL' },
    funnel: { href: '/admin/funnel', icon: Filter, label: 'Funil de Conversão', section: 'PRINCIPAL' },
    leads: { href: '/admin/leads', icon: Users, label: 'Leads', section: 'PRINCIPAL' },
    landing_pages: { href: '/admin/landing-pages', icon: FileText, label: 'Landing Pages', section: 'CONTEÚDO' },
    properties: { href: '/admin/properties', icon: Building2, label: 'Imóveis', section: 'CONTEÚDO' },
    brokers: { href: '/admin/brokers', icon: ShieldCheck, label: 'Corretores IA', section: 'CONTEÚDO' },
    automation: { href: '/admin/automation', icon: Zap, label: 'Automações', section: 'AUTOMAÇÃO' },
    push: { href: '/admin/push', icon: Bell, label: 'Notificações', section: 'AUTOMAÇÃO' },
    ads: { 
        href: '/admin/ads', 
        icon: Megaphone, 
        label: 'Tráfego IA', 
        section: 'AUTOMAÇÃO',
        subItems: [
            { href: '/admin/ads', label: 'Meta Ads' },
            { href: '/admin/ads/google', label: 'Google Ads' }
        ]
    },
    radar: { href: '/admin/radar', icon: Radar, label: 'Radar de Mercado', section: 'AUTOMAÇÃO' },
    whatsapp: { 
        href: '/admin/whatsapp', 
        icon: Smartphone, 
        label: 'WhatsApp Web', 
        section: 'AUTOMAÇÃO',
        subItems: [
            { href: '/admin/whatsapp', label: 'Instâncias' },
            { href: '/admin/whatsapp/agent-config', label: 'Config do Agente' },
            { href: '/admin/whatsapp/campaigns', label: 'Campanhas', icon: Send },
            { href: '/admin/whatsapp/labels', label: 'Etiquetas', icon: Tag },
            { href: '/admin/whatsapp/quick-replies', label: 'Respostas Rápidas', icon: Zap },
        ]
    },
    feedback: { href: '/admin/feedback', icon: MessageSquareHeart, label: 'Feedback', section: 'SISTEMA' },
    maintenance: { href: '/admin/maintenance', icon: Wrench, label: 'Sala de Manutenção', section: 'SISTEMA' },
}

// Section order
const SECTION_ORDER = ['PRINCIPAL', 'CONTEÚDO', 'AUTOMAÇÃO', 'SISTEMA', 'CONFIGURAÇÕES']

export default function AdminSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()
    const [permissions, setPermissions] = useState<string[]>([])
    const [isMaster, setIsMaster] = useState(false)
    const [userName, setUserName] = useState('')
    const [loading, setLoading] = useState(true)
    const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
        '/admin/ads': true // default open if on ads route
    })

    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                const res = await fetch('/api/admin/permissions')
                if (res.ok) {
                    const data = await res.json()
                    setPermissions(data.permissions || [])
                    setIsMaster(data.is_master || false)
                    setUserName(data.user_name || '')
                }
            } catch (err) {
                console.error('Failed to fetch permissions:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchPermissions()
    }, [])
    
    // Ensure submenu is open if we navigate directly to a child route
    useEffect(() => {
        if (pathname.startsWith('/admin/ads')) {
            setExpandedMenus(prev => ({ ...prev, '/admin/ads': true }))
        }
        if (pathname.startsWith('/admin/whatsapp')) {
            setExpandedMenus(prev => ({ ...prev, '/admin/whatsapp': true }))
        }
    }, [pathname])
    
    const toggleSubmenu = (href: string) => {
        setExpandedMenus(prev => ({ ...prev, [href]: !prev[href] }))
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    // Build navigation items based on permissions
    const buildNavSections = () => {
        const sections: Record<string, { href: string; icon: any; label: string; subItems?: { href: string; label: string; icon?: any }[] }[]> = {}

        // If master or permissions loaded: filter by permissions
        const allowedModules = isMaster
            ? Object.keys(MODULE_NAV)
            : permissions

        for (const key of allowedModules) {
            const nav = MODULE_NAV[key]
            if (!nav) continue
            if (!sections[nav.section]) sections[nav.section] = []
            sections[nav.section].push({ href: nav.href, icon: nav.icon, label: nav.label, subItems: nav.subItems })
        }

        // Add settings section for master
        if (isMaster) {
            sections['CONFIGURAÇÕES'] = [
                { href: '/admin/settings/sectors', icon: Shield, label: 'Setores' },
                { href: '/admin/settings/users', icon: UserCog, label: 'Usuários' },
            ]
        }

        return SECTION_ORDER
            .filter(s => sections[s] && sections[s].length > 0)
            .map(s => ({ label: s, items: sections[s] }))
    }

    const navSections = buildNavSections()

    return (
        <aside className="admin-sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <div className="admin-sidebar-logo">
                <h2>Pilger Admin</h2>
                {userName ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isMaster && <Crown size={12} style={{ color: '#f59e0b' }} />}
                        {userName}
                    </span>
                ) : (
                    <span>Painel de Controle</span>
                )}
            </div>

            <nav className="admin-nav">
                {loading ? (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Loader2 size={20} className="spin" style={{ margin: '0 auto' }} />
                    </div>
                ) : (
                    navSections.map((section) => (
                        <div key={section.label}>
                            <div className="admin-nav-section">{section.label}</div>
                            {section.items.map((item) => {
                                const isExpanded = expandedMenus[item.href] || false;
                                return (
                                <div key={item.href}>
                                    <Link
                                        href={item.subItems ? '#' : item.href}
                                        onClick={(e) => {
                                            if (item.subItems) {
                                                e.preventDefault();
                                                toggleSubmenu(item.href);
                                            }
                                        }}
                                        className={`admin-nav-item ${(pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href) && !item.subItems)) ? 'active' : ''}`}
                                    >
                                        <item.icon size={18} />
                                        <span style={{ flex: 1 }}>{item.label}</span>
                                        {item.subItems && (
                                            <span style={{ fontSize: '0.6rem', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                                                ▼
                                            </span>
                                        )}
                                    </Link>
                                    
                                    {/* Sub Items Render */}
                                    {item.subItems && isExpanded && (
                                        <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '28px', marginTop: '4px', marginBottom: '8px', gap: '4px' }}>
                                            {item.subItems.map(subItem => (
                                                <Link
                                                    key={subItem.href}
                                                    href={subItem.href}
                                                    className={`admin-nav-item ${pathname === subItem.href ? 'active text-gold' : ''}`}
                                                    style={{ 
                                                        fontSize: '0.85rem', 
                                                        padding: '6px 12px',
                                                        background: pathname === subItem.href ? 'var(--bg-card)' : 'transparent',
                                                        color: pathname === subItem.href ? 'var(--gold)' : 'var(--text-muted)',
                                                        borderLeft: pathname === subItem.href ? '2px solid var(--gold)' : '2px solid transparent'
                                                    }}
                                                >
                                                    {subItem.label}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )})}
                        </div>
                    ))
                )}
            </nav>

            <div style={{ marginTop: 'auto', padding: '20px', borderTop: '1px solid var(--border-color)' }}>
                <Link
                    href="/admin/minha-conta"
                    className="admin-nav-item"
                    style={{
                        width: '100%',
                        justifyContent: 'flex-start',
                        marginBottom: '8px',
                        color: pathname === '/admin/minha-conta' ? 'var(--gold)' : 'var(--text-primary)',
                        background: pathname === '/admin/minha-conta' ? 'var(--bg-card)' : 'transparent',
                        borderLeft: pathname === '/admin/minha-conta' ? '2px solid var(--gold)' : '2px solid transparent'
                    }}
                >
                    <UserCog size={18} />
                    Minha Conta
                </Link>

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
