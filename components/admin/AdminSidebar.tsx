'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
    Bell,
    BrainCircuit,
    BriefcaseBusiness,
    Building2,
    CalendarDays,
    ChevronDown,
    Crown,
    FileText,
    FileSearch,
    Filter,
    Home,
    Landmark,
    LayoutDashboard,
    Loader2,
    LogOut,
    Menu,
    Megaphone,
    MessageSquareHeart,
    Newspaper,
    Package,
    Radar,
    Search,
    Send,
    Shield,
    ShieldAlert,
    ShieldCheck,
    ShoppingCart,
    Smartphone,
    Tag,
    UserCog,
    Users,
    Wrench,
    X,
    Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type SubNavLink = { href: string; label: string }
type SubNavGroup = { label: string; children: SubNavLink[] }
type SubNavItem = SubNavLink | SubNavGroup
type NavItem = { href: string; icon: any; label: string; section: string; subItems?: SubNavItem[] }
type UserSector = { id?: string; name?: string; color?: string; icon?: string }

const META_CAMPAIGNS_PATH = '/admin/whatsapp/campaigns'
const META_CHAT_PATH = '/admin/whatsapp/meta-chat'
const META_TEMPLATES_PATH = '/admin/ads/meta-templates'

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
            {
                label: 'Cadastros',
                children: [
                    { href: '/admin/finance/cadastros', label: 'Visao Geral' },
                    { href: '/admin/finance/categorias', label: 'Categorias' },
                    { href: '/admin/finance/pagamentos', label: 'Pagamentos' },
                    { href: '/admin/finance/favorecidos', label: 'Favorecidos' },
                    { href: '/admin/finance/entidades', label: 'Entidades PF/PJ' },
                ],
            },
            {
                label: 'Movimentacoes',
                children: [
                    { href: '/admin/finance/novo-lancamento', label: 'Novo Lancamento' },
                    { href: '/admin/finance/lancamentos', label: 'Lancamentos' },
                    { href: '/admin/finance/contas-a-pagar', label: 'Contas a Pagar' },
                    { href: '/admin/finance/contas-a-receber', label: 'Contas a Receber' },
                ],
            },
            { href: '/admin/finance/comissoes', label: 'Comissoes' },
            {
                label: 'Conciliacao e Fechamento',
                children: [
                    { href: '/admin/finance/conciliacao-bancaria', label: 'Conciliacao Bancaria' },
                    { href: '/admin/finance/fechamento-mensal', label: 'Fechamento Mensal' },
                    { href: '/admin/finance/exportacao-contabil', label: 'Exportacao Contabil' },
                ],
            },
            {
                label: 'Relatorios',
                children: [
                    { href: '/admin/finance/fluxo-caixa', label: 'Fluxo de Caixa' },
                    { href: '/admin/finance/dre-gerencial', label: 'DRE Gerencial' },
                    { href: '/admin/finance/relatorio-corretores', label: 'Relatorio Corretores' },
                ],
            },
            { href: '/admin/finance/manual', label: 'Manual Financeiro' },
        ],
    },
    leads: {
        href: '/admin/leads',
        icon: Users,
        label: 'Leads',
        section: 'COMERCIAL',
        subItems: [
            { href: '/admin/leads', label: 'CRM dos Leads' },
            { href: '/admin/leads/relatorios-atendimento', label: 'Relatorios de Atendimento' },
        ],
    },
    broker_candidates: { href: '/admin/trabalhe-conosco', icon: BriefcaseBusiness, label: 'Trabalhe Conosco', section: 'COMERCIAL' },
    landing_pages: { href: '/admin/landing-pages', icon: FileText, label: 'Landing Pages', section: 'MARKETING' },
    events: {
        href: '/admin/eventos',
        icon: CalendarDays,
        label: 'Eventos',
        section: 'MARKETING',
        subItems: [
            { href: '/admin/eventos', label: 'Agenda e inscritos' },
        ],
    },
    blog: { href: '/admin/blog', icon: Newspaper, label: 'Blog', section: 'MARKETING' },
    news: { href: '/admin/noticias', icon: FileText, label: 'Noticias', section: 'MARKETING' },
    properties: { href: '/admin/properties', icon: Building2, label: 'Imoveis', section: 'OPERACOES' },
    products: { href: '/admin/products', icon: Package, label: 'Produtos Digitais', section: 'PRODUTO DIGITAL' },
    commerce: { href: '/admin/commerce', icon: ShoppingCart, label: 'Ecommerce', section: 'PRODUTO DIGITAL' },
    homepage: { href: '/admin/homepage', icon: Home, label: 'Configurar Homepage', section: 'PRODUTO DIGITAL' },
    brokers: { href: '/admin/brokers', icon: ShieldCheck, label: 'Corretores IA', section: 'COMERCIAL' },
    automation: { href: '/admin/automation', icon: Zap, label: 'Automacoes', section: 'TECNOLOGIA' },
    push: { href: '/admin/push', icon: Bell, label: 'Notificacoes', section: 'MARKETING' },
    ads: {
        href: '/admin/ads',
        icon: Megaphone,
        label: 'Trafego IA',
        section: 'MARKETING',
        subItems: [
            { href: '/admin/ads', label: 'Meta Ads' },
            { href: META_CAMPAIGNS_PATH, label: 'Campanhas Meta WhatsApp' },
            { href: META_CHAT_PATH, label: 'Chat Meta WhatsApp' },
            { href: META_TEMPLATES_PATH, label: 'Templates Meta' },
            { href: '/admin/ads/google', label: 'Google Ads' },
            { href: '/admin/ads/analytics', label: 'Google Analytics' },
            { href: '/admin/ads/organic', label: 'Trafego Organico' },
            { href: '/admin/ads/inbox', label: 'Caixa Meta' },
            { href: '/admin/ads/creatives', label: 'Criativos' },
        ],
    },
    radar: { href: '/admin/radar', icon: Radar, label: 'Radar de Mercado', section: 'INTELIGENCIA' },
    intelligence: { href: '/admin/intelligence', icon: BrainCircuit, label: 'Central de Inteligencia', section: 'INTELIGENCIA' },
    research: { href: '/admin/research', icon: Search, label: 'Pesquisa Profunda IA', section: 'INTELIGENCIA' },
    benchmark_editorial: { href: '/admin/benchmark-editorial', icon: FileSearch, label: 'Benchmark Editorial', section: 'INTELIGENCIA' },
    whatsapp: {
        href: '/admin/whatsapp',
        icon: Smartphone,
        label: 'WhatsApp Web',
        section: 'ATENDIMENTO',
        subItems: [
            { href: '/admin/whatsapp', label: 'Conectados' },
            { href: '/admin/whatsapp/global', label: 'WhatsApp Global' },
            { href: '/admin/whatsapp/agenda', label: 'Agenda' },
            { href: '/admin/whatsapp/labels', label: 'Etiquetas' },
            { href: '/admin/whatsapp/quick-replies', label: 'Respostas Rapidas' },
        ],
    },
    feedback: { href: '/admin/feedback', icon: MessageSquareHeart, label: 'Feedback', section: 'SISTEMA' },
    maintenance: { href: '/admin/maintenance', icon: Wrench, label: 'Sala de Manutencao', section: 'SISTEMA' },
    pilger_ai: {
        href: '/admin/pilger-ai',
        icon: Crown,
        label: 'Pilger AI',
        section: 'PILGER AI',
        subItems: [
            { href: '/admin/pilger-ai', label: 'Visao Geral' },
            { href: '/admin/pilger-ai/organograma', label: 'Mapa Vivo' },
            { href: '/admin/pilger-ai/saude', label: 'Saude dos Agentes' },
            { href: '/admin/pilger-ai/agentes', label: 'Agentes' },
            { href: '/admin/pilger-ai/tarefas', label: 'Tarefas' },
            { href: '/admin/pilger-ai/aprovacoes', label: 'Aprovacoes' },
            { href: '/admin/pilger-ai/eventos', label: 'Eventos e Logs' },
        ],
    },
}

const GENERAL_DASHBOARD_ITEM: NavItem = {
    href: '/admin',
    icon: LayoutDashboard,
    label: 'Dashboard Geral',
    section: 'PRINCIPAL',
}

const ACCESS_AUDIT_ITEM: NavItem = {
    href: '/admin/user-access',
    icon: ShieldAlert,
    label: 'Auditoria de Acessos',
    section: 'CONFIGURACOES',
}

const SECTION_ORDER = ['PRINCIPAL', 'PILGER AI', 'FINANCEIRO', 'MARKETING', 'COMERCIAL', 'OPERACOES', 'INTELIGENCIA', 'ATENDIMENTO', 'PRODUTO DIGITAL', 'TECNOLOGIA', 'SISTEMA', 'CONFIGURACOES']
const SETTINGS_USERS_PERMISSION_KEYS = ['settings_users', 'gestao_de_usuarios', 'usuarios', 'users']
const SETTINGS_SECTORS_PERMISSION_KEYS = ['settings_sectors', 'gestao_de_setores', 'setores', 'sectors']

export default function AdminSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

    const [permissions, setPermissions] = useState<string[]>([])
    const [sectors, setSectors] = useState<UserSector[]>([])
    const [isMaster, setIsMaster] = useState(false)
    const [userName, setUserName] = useState('')
    const [loading, setLoading] = useState(true)
    const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
        '/admin/ads': true,
    })
    const [expandedSubGroups, setExpandedSubGroups] = useState<Record<string, boolean>>({})
    const [mobileOpen, setMobileOpen] = useState(false)
    const [autoCollapse, setAutoCollapse] = useState(true)
    const [forceCollapsedRail, setForceCollapsedRail] = useState(false)

    const subGroupKey = (parentHref: string, groupLabel: string) => `${parentHref}::${groupLabel}`

    const isHrefActive = (href: string) => {
        if (href === '/admin') return pathname === '/admin'
        if (href === '/admin/pilger-ai') return pathname === '/admin/pilger-ai'
        if (href === '/admin/ads') return pathname === href
        if (href === '/admin/whatsapp') return pathname === href
        return pathname === href || pathname.startsWith(`${href}/`)
    }

    const isParentHrefActive = (href: string) => {
        if (href === '/admin/ads') return pathname === href || pathname.startsWith(`${href}/`) || pathname === META_CAMPAIGNS_PATH || pathname === META_CHAT_PATH
        if (href === '/admin/whatsapp') return pathname === href || (pathname.startsWith(`${href}/`) && pathname !== META_CAMPAIGNS_PATH && pathname !== META_CHAT_PATH)
        return isHrefActive(href)
    }

    const toggleSubGroup = (parentHref: string, groupLabel: string) => {
        const key = subGroupKey(parentHref, groupLabel)
        setExpandedSubGroups(prev => ({ ...prev, [key]: !prev[key] }))
    }

    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                const res = await fetch('/api/admin/permissions')
                if (res.ok) {
                    const data = await res.json()
                    setPermissions(data.permissions || [])
                    setSectors(Array.isArray(data.sectors) ? data.sectors : [])
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
        const storedPreference = window.localStorage.getItem('admin-sidebar-auto-collapse')
        if (storedPreference === null) return
        setAutoCollapse(storedPreference === 'true')
    }, [])

    useEffect(() => {
        if (pathname.startsWith('/admin/ads') || pathname === META_CAMPAIGNS_PATH || pathname === META_CHAT_PATH) {
            setExpandedMenus(prev => ({ ...prev, '/admin/ads': true }))
        }
        if (pathname.startsWith('/admin/whatsapp') && pathname !== META_CAMPAIGNS_PATH && pathname !== META_CHAT_PATH) {
            setExpandedMenus(prev => ({ ...prev, '/admin/whatsapp': true }))
        }
        if (pathname.startsWith('/admin/finance')) {
            setExpandedMenus(prev => ({ ...prev, '/admin/finance': true }))

            const financeSubItems = MODULE_NAV.finance.subItems || []
            for (const subItem of financeSubItems) {
                if (!('children' in subItem)) continue

                const hasActiveChild = subItem.children.some(child => isHrefActive(child.href))
                if (!hasActiveChild) continue

                const key = subGroupKey('/admin/finance', subItem.label)
                setExpandedSubGroups(prev => ({ ...prev, [key]: true }))
            }
        }
        if (pathname.startsWith('/admin/leads')) {
            setExpandedMenus(prev => ({ ...prev, '/admin/leads': true }))
        }
        if (pathname.startsWith('/admin/trabalhe-conosco')) {
            setExpandedMenus(prev => ({ ...prev, '/admin/trabalhe-conosco': true }))
        }
        if (pathname.startsWith('/admin/eventos')) {
            setExpandedMenus(prev => ({ ...prev, '/admin/eventos': true }))
        }
        if (pathname.startsWith('/admin/pilger-ai')) {
            setExpandedMenus(prev => ({ ...prev, '/admin/pilger-ai': true }))
        }
    }, [pathname])

    const toggleSubmenu = (href: string) => {
        setExpandedMenus(prev => ({ ...prev, [href]: !prev[href] }))
    }

    const closeMobileMenu = () => setMobileOpen(false)

    const collapseSidebar = () => {
        setAutoCollapse(true)
        setForceCollapsedRail(true)
        window.localStorage.setItem('admin-sidebar-auto-collapse', 'true')
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
        }
    }

    const handleLogout = async () => {
        await fetch('/api/admin/user-access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event_type: 'logout',
                path: pathname,
                referrer: document.referrer,
                search_params: window.location.search,
            }),
        }).catch(() => {})
        await supabase.auth.signOut()
        router.push('/login')
    }

    const buildNavSections = () => {
        const sections: Record<string, { href: string; icon: any; label: string; subItems?: SubNavItem[] }[]> = {}

        const allowedModules = isMaster ? Object.keys(MODULE_NAV) : permissions
        const isDiretoria = sectors.some(sector =>
            String(sector?.name || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .includes('diretoria')
        )
        const canManageSectors = isMaster || SETTINGS_SECTORS_PERMISSION_KEYS.some(key => allowedModules.includes(key))
        const canManageUsers = isMaster || SETTINGS_USERS_PERMISSION_KEYS.some(key => allowedModules.includes(key))
        const canSeeAccessAudit = isMaster || isDiretoria || allowedModules.includes('user_access')

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
            if (key === 'brokers') continue
            const nav = MODULE_NAV[key]
            if (!nav) continue
            if (!sections[nav.section]) sections[nav.section] = []
            sections[nav.section].push({ href: nav.href, icon: nav.icon, label: nav.label, subItems: nav.subItems })
        }

        if (canManageSectors || canManageUsers) {
            sections.CONFIGURACOES = []
            if (canManageSectors) {
                sections.CONFIGURACOES.push({ href: '/admin/settings/sectors', icon: Shield, label: 'Setores' })
            }
            if (canManageUsers) {
                sections.CONFIGURACOES.push({ href: '/admin/settings/users', icon: UserCog, label: 'Usuarios' })
            }
            if (canSeeAccessAudit) {
                sections.CONFIGURACOES.push({
                    href: ACCESS_AUDIT_ITEM.href,
                    icon: ACCESS_AUDIT_ITEM.icon,
                    label: ACCESS_AUDIT_ITEM.label,
                })
            }
        } else if (canSeeAccessAudit) {
            sections.CONFIGURACOES = [{
                href: ACCESS_AUDIT_ITEM.href,
                icon: ACCESS_AUDIT_ITEM.icon,
                label: ACCESS_AUDIT_ITEM.label,
            }]
        }

        return SECTION_ORDER
            .filter(section => sections[section] && sections[section].length > 0)
            .map(section => ({ label: section, items: sections[section] }))
    }

    const navSections = buildNavSections()

    return (
        <>
        <button
            type="button"
            className="admin-mobile-menu-button"
            onClick={() => setMobileOpen(prev => !prev)}
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
        >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        {mobileOpen && <div className="admin-mobile-sidebar-backdrop" onClick={closeMobileMenu} />}
        <aside
            className={`admin-sidebar ${mobileOpen ? 'open' : ''} ${autoCollapse ? 'is-auto-collapsed' : 'is-pinned-open'} ${forceCollapsedRail ? 'is-rail-locked' : ''}`}
            onMouseLeave={() => setForceCollapsedRail(false)}
            style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}
        >
            <button
                type="button"
                className="admin-sidebar-collapse-button"
                onClick={collapseSidebar}
                aria-label="Esconder menu"
                title="Esconder menu"
            >
                <Menu size={16} />
            </button>
            <div className="admin-sidebar-logo">
                <h2>Pilger Admin</h2>
                {userName ? (
                    <span className="admin-sidebar-user-name" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isMaster && <Crown size={12} style={{ color: '#f59e0b' }} />}
                        {userName}
                    </span>
                ) : (
                    <span className="admin-sidebar-user-name">Painel de Controle</span>
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
                                const isParentActive = isParentHrefActive(item.href)

                                return (
                                    <div key={item.href}>
                                        <Link
                                            href={item.href}
                                            onClick={e => {
                                                if (!item.subItems) {
                                                    closeMobileMenu()
                                                    return
                                                }

                                                if (isParentActive) {
                                                    e.preventDefault()
                                                    toggleSubmenu(item.href)
                                                } else {
                                                    setExpandedMenus(prev => ({ ...prev, [item.href]: true }))
                                                    closeMobileMenu()
                                                }
                                            }}
                                            className={`admin-nav-item ${isParentActive ? 'active' : ''}`}
                                            title={item.label}
                                        >
                                            <item.icon size={18} />
                                            <span className="admin-nav-item-label" style={{ flex: 1 }}>{item.label}</span>
                                            {item.subItems && (
                                                <ChevronDown
                                                    className="admin-nav-chevron"
                                                    size={14}
                                                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                                                />
                                            )}
                                        </Link>

                                        {item.subItems && isExpanded && (
                                            <div className="admin-nav-submenu" style={{ display: 'flex', flexDirection: 'column', paddingLeft: '28px', marginTop: '4px', marginBottom: '8px', gap: '4px' }}>
                                                {item.subItems.map((subItem, index) => {
                                                    if ('children' in subItem) {
                                                        const key = subGroupKey(item.href, subItem.label)
                                                        const isGroupExpanded = expandedSubGroups[key] || false
                                                        return (
                                                            <div key={`subgroup-${subItem.label}-${index}`} style={{ marginTop: 6 }}>
                                                                <button
                                                                    className="admin-nav-subgroup-button"
                                                                    type="button"
                                                                    onClick={() => toggleSubGroup(item.href, subItem.label)}
                                                                    style={{
                                                                        width: '100%',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'space-between',
                                                                        background: 'rgba(148, 163, 184, 0.12)',
                                                                        border: '1px solid rgba(148, 163, 184, 0.22)',
                                                                        borderRadius: 8,
                                                                        cursor: 'pointer',
                                                                        textAlign: 'left',
                                                                        padding: '6px 10px 6px 12px',
                                                                        fontSize: '0.73rem',
                                                                        letterSpacing: '0.06em',
                                                                        textTransform: 'uppercase',
                                                                        color: 'var(--text-primary)',
                                                                        fontWeight: 700,
                                                                        margin: '0 0 6px 0',
                                                                    }}
                                                                >
                                                                    <span className="admin-nav-item-label">{subItem.label}</span>
                                                                    <ChevronDown
                                                                        className="admin-nav-chevron"
                                                                        size={12}
                                                                        style={{ transform: isGroupExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                                                                    />
                                                                </button>
                                                                {isGroupExpanded && (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 10 }}>
                                                                        {subItem.children.map(child => {
                                                                            const isChildActive = isHrefActive(child.href)
                                                                            return (
                                                                                <Link
                                                                                    key={child.href}
                                                                                    href={child.href}
                                                                                    onClick={closeMobileMenu}
                                                                                    className={`admin-nav-item ${isChildActive ? 'active text-gold' : ''}`}
                                                                                    title={child.label}
                                                                                    style={{
                                                                                        fontSize: '0.84rem',
                                                                                        padding: '6px 12px',
                                                                                        background: isChildActive ? 'var(--bg-card)' : 'transparent',
                                                                                        color: isChildActive ? 'var(--gold)' : 'var(--text-muted)',
                                                                                        borderLeft: isChildActive ? '2px solid var(--gold)' : '2px solid transparent',
                                                                                    }}
                                                                                >
                                                                                    <span className="admin-nav-item-label">{child.label}</span>
                                                                                </Link>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    }

                                                    const isSubItemActive = isHrefActive(subItem.href)
                                                    return (
                                                        <Link
                                                            key={subItem.href}
                                                            href={subItem.href}
                                                            onClick={closeMobileMenu}
                                                            className={`admin-nav-item ${isSubItemActive ? 'active text-gold' : ''}`}
                                                            title={subItem.label}
                                                            style={{
                                                                fontSize: '0.85rem',
                                                                padding: '6px 12px',
                                                                background: isSubItemActive ? 'var(--bg-card)' : 'rgba(148, 163, 184, 0.1)',
                                                                color: isSubItemActive ? 'var(--gold)' : 'var(--text-primary)',
                                                                borderLeft: isSubItemActive ? '2px solid var(--gold)' : '2px solid rgba(100,116,139,0.22)',
                                                                borderRadius: 8,
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            <span className="admin-nav-item-label">{subItem.label}</span>
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
                    onClick={closeMobileMenu}
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
                    <span className="admin-nav-item-label">Minha Conta</span>
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
                    <span className="admin-nav-item-label">Sair</span>
                </button>
            </div>
        </aside>
        </>
    )
}
