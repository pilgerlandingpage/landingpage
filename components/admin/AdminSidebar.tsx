'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
    Bell,
    Building2,
    ChevronDown,
    Crown,
    FileText,
    Filter,
    Landmark,
    LayoutDashboard,
    Loader2,
    LogOut,
    Megaphone,
    MessageSquareHeart,
    Radar,
    Send,
    Shield,
    ShieldCheck,
    Smartphone,
    Tag,
    UserCog,
    Users,
    Wrench,
    Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type SubNavItem = { href: string; label: string }
type NavItem = { href: string; icon: any; label: string; section: string; subItems?: SubNavItem[] }

const MODULE_NAV: Record<string, NavItem> = {
    dashboard: { href: '/admin/marketing', icon: Megaphone, label: 'Dashboard Marketing', section: 'MARKETING' },
    funnel: { href: '/admin/funnel', icon: Filter, label: 'Funil de Conversao', section: 'MARKETING' },
    finance: {
        href: '/admin/finance',
        icon: Landmark,
        label: 'Financeiro',
        section: 'FINANCEIRO',
        subItems: [
            { href: '/admin/finance', label: 'Dashboard' },
            { href: '/admin/finance/cadastros', label: 'Cadastros' },
            { href: '/admin/finance/categorias', label: 'Categorias' },
            { href: '/admin/finance/subcategorias', label: 'Subcategorias' },
            { href: '/admin/finance/pagamentos', label: 'Pagamentos' },
            { href: '/admin/finance/favorecidos', label: 'Favorecidos' },
            { href: '/admin/finance/novo-lancamento', label: 'Novo Lancamento' },
            { href: '/admin/finance/contas-a-pagar', label: 'Contas a Pagar' },
            { href: '/admin/finance/contas-a-receber', label: 'Contas a Receber' },
            { href: '/admin/finance/conciliacao-bancaria', label: 'Conciliacao Bancaria' },
            { href: '/admin/finance/fluxo-caixa', label: 'Fluxo de Caixa' },
            { href: '/admin/finance/dre-gerencial', label: 'DRE Gerencial' },
            { href: '/admin/finance/comissoes', label: 'Comissoes' },
            { href: '/admin/finance/fechamento-mensal', label: 'Fechamento Mensal' },
            { href: '/admin/finance/exportacao-contabil', label: 'Exportacao Contabil' },
            { href: '/admin/finance/lancamentos', label: 'Lancamentos' },
        ],
    },
    leads: {
        href: '/admin/leads',
        icon: Users,
        label: 'Leads',
        section: 'MARKETING',
        subItems: [
            { href: '/admin/leads', label: 'Todos os Leads' },
            { href: '/admin/leads/crm', label: 'CRM do Agente' },
        ],
    },
    landing_pages: { href: '/admin/landing-pages', icon: FileText, label: 'Landing Pages', section: 'MARKETING' },
    properties: { href: '/admin/properties', icon: Building2, label: 'Imoveis', section: 'MARKETING' },
    brokers: { href: '/admin/brokers', icon: ShieldCheck, label: 'Corretores IA', section: 'MARKETING' },
    automation: { href: '/admin/automation', icon: Zap, label: 'Automacoes', section: 'MARKETING' },
    push: { href: '/admin/push', icon: Bell, label: 'Notificacoes', section: 'MARKETING' },
    ads: {
        href: '/admin/ads',
        icon: Megaphone,
        label: 'Trafego IA',
        section: 'MARKETING',
        subItems: [
            { href: '/admin/ads', label: 'Meta Ads' },
            { href: '/admin/ads/google', label: 'Google Ads' },
        ],
    },
    radar: { href: '/admin/radar', icon: Radar, label: 'Radar de Mercado', section: 'MARKETING' },
    whatsapp: {
        href: '/admin/whatsapp',
        icon: Smartphone,
        label: 'WhatsApp Web',
        section: 'MARKETING',
        subItems: [
            { href: '/admin/whatsapp', label: 'Conectados' },
            { href: '/admin/whatsapp/agent-config', label: 'Config do Agente' },
            { href: '/admin/whatsapp/agenda', label: 'Agenda' },
            { href: '/admin/whatsapp/campaigns', label: 'Campanhas' },
            { href: '/admin/whatsapp/labels', label: 'Etiquetas' },
            { href: '/admin/whatsapp/quick-replies', label: 'Respostas Rapidas' },
        ],
    },
    feedback: { href: '/admin/feedback', icon: MessageSquareHeart, label: 'Feedback', section: 'SISTEMA' },
    maintenance: { href: '/admin/maintenance', icon: Wrench, label: 'Sala de Manutencao', section: 'SISTEMA' },
}

const GENERAL_DASHBOARD_ITEM: NavItem = {
    href: '/admin',
    icon: LayoutDashboard,
    label: 'Dashboard Geral',
    section: 'PRINCIPAL',
}

const SECTION_ORDER = ['PRINCIPAL', 'FINANCEIRO', 'MARKETING', 'SISTEMA', 'CONFIGURACOES']

export default function AdminSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

    const [permissions, setPermissions] = useState<string[]>([])
    const [isMaster, setIsMaster] = useState(false)
    const [userName, setUserName] = useState('')
    const [loading, setLoading] = useState(true)
    const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
        '/admin/ads': true,
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

    useEffect(() => {
        if (pathname.startsWith('/admin/ads')) {
            setExpandedMenus(prev => ({ ...prev, '/admin/ads': true }))
        }
        if (pathname.startsWith('/admin/whatsapp')) {
            setExpandedMenus(prev => ({ ...prev, '/admin/whatsapp': true }))
        }
        if (pathname.startsWith('/admin/finance')) {
            setExpandedMenus(prev => ({ ...prev, '/admin/finance': true }))
        }
        if (pathname.startsWith('/admin/leads')) {
            setExpandedMenus(prev => ({ ...prev, '/admin/leads': true }))
        }
    }, [pathname])

    const toggleSubmenu = (href: string) => {
        setExpandedMenus(prev => ({ ...prev, [href]: !prev[href] }))
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const buildNavSections = () => {
        const sections: Record<string, { href: string; icon: any; label: string; subItems?: SubNavItem[] }[]> = {}

        const allowedModules = isMaster ? Object.keys(MODULE_NAV) : permissions

        const canSeeGeneralDashboard = isMaster || allowedModules.includes('dashboard')
        if (canSeeGeneralDashboard) {
            if (!sections[GENERAL_DASHBOARD_ITEM.section]) sections[GENERAL_DASHBOARD_ITEM.section] = []
            sections[GENERAL_DASHBOARD_ITEM.section].push({
                href: GENERAL_DASHBOARD_ITEM.href,
                icon: GENERAL_DASHBOARD_ITEM.icon,
                label: GENERAL_DASHBOARD_ITEM.label,
            })
        }

        for (const key of allowedModules) {
            const nav = MODULE_NAV[key]
            if (!nav) continue
            if (!sections[nav.section]) sections[nav.section] = []
            sections[nav.section].push({ href: nav.href, icon: nav.icon, label: nav.label, subItems: nav.subItems })
        }

        if (isMaster) {
            sections.CONFIGURACOES = [
                { href: '/admin/settings/sectors', icon: Shield, label: 'Setores' },
                { href: '/admin/settings/users', icon: UserCog, label: 'Usuarios' },
            ]
        }

        return SECTION_ORDER
            .filter(section => sections[section] && sections[section].length > 0)
            .map(section => ({ label: section, items: sections[section] }))
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
                    navSections.map(section => (
                        <div key={section.label}>
                            <div className="admin-nav-section">{section.label}</div>
                            {section.items.map(item => {
                                const isExpanded = expandedMenus[item.href] || false
                                const isParentActive = item.href === '/admin'
                                    ? pathname === '/admin'
                                    : pathname === item.href || pathname.startsWith(`${item.href}/`)

                                return (
                                    <div key={item.href}>
                                        <Link
                                            href={item.href}
                                            onClick={e => {
                                                if (!item.subItems) return

                                                if (isParentActive) {
                                                    e.preventDefault()
                                                    toggleSubmenu(item.href)
                                                } else {
                                                    setExpandedMenus(prev => ({ ...prev, [item.href]: true }))
                                                }
                                            }}
                                            className={`admin-nav-item ${isParentActive ? 'active' : ''}`}
                                        >
                                            <item.icon size={18} />
                                            <span style={{ flex: 1 }}>{item.label}</span>
                                            {item.subItems && (
                                                <ChevronDown
                                                    size={14}
                                                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                                                />
                                            )}
                                        </Link>

                                        {item.subItems && isExpanded && (
                                            <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '28px', marginTop: '4px', marginBottom: '8px', gap: '4px' }}>
                                                {item.subItems.map(subItem => {
                                                    const isSubItemActive = pathname === subItem.href
                                                    return (
                                                        <Link
                                                            key={subItem.href}
                                                            href={subItem.href}
                                                            className={`admin-nav-item ${isSubItemActive ? 'active text-gold' : ''}`}
                                                            style={{
                                                                fontSize: '0.85rem',
                                                                padding: '6px 12px',
                                                                background: isSubItemActive ? 'var(--bg-card)' : 'transparent',
                                                                color: isSubItemActive ? 'var(--gold)' : 'var(--text-muted)',
                                                                borderLeft: isSubItemActive ? '2px solid var(--gold)' : '2px solid transparent',
                                                            }}
                                                        >
                                                            {subItem.label}
                                                        </Link>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
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
                        borderLeft: pathname === '/admin/minha-conta' ? '2px solid var(--gold)' : '2px solid transparent',
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
                        justifyContent: 'flex-start',
                    }}
                >
                    <LogOut size={18} />
                    Sair
                </button>
            </div>
        </aside>
    )
}
