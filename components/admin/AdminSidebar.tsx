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
    Menu,
    Megaphone,
    MessageSquareHeart,
    Radar,
    Send,
    Shield,
    ShieldAlert,
    ShieldCheck,
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
                ],
            },
            { href: '/admin/finance/manual', label: 'Manual Financeiro' },
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
            { href: '/admin/whatsapp/agent-flow', label: 'Fluxo do Agente' },
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

const ACCESS_AUDIT_ITEM: NavItem = {
    href: '/admin/user-access',
    icon: ShieldAlert,
    label: 'Auditoria de Acessos',
    section: 'CONFIGURACOES',
}

const SECTION_ORDER = ['PRINCIPAL', 'FINANCEIRO', 'MARKETING', 'SISTEMA', 'CONFIGURACOES']
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

    const subGroupKey = (parentHref: string, groupLabel: string) => `${parentHref}::${groupLabel}`

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
        if (pathname.startsWith('/admin/ads')) {
            setExpandedMenus(prev => ({ ...prev, '/admin/ads': true }))
        }
        if (pathname.startsWith('/admin/whatsapp')) {
            setExpandedMenus(prev => ({ ...prev, '/admin/whatsapp': true }))
        }
        if (pathname.startsWith('/admin/finance')) {
            setExpandedMenus(prev => ({ ...prev, '/admin/finance': true }))

            const financeSubItems = MODULE_NAV.finance.subItems || []
            for (const subItem of financeSubItems) {
                if (!('children' in subItem)) continue

                const hasActiveChild = subItem.children.some(child => pathname === child.href || pathname.startsWith(`${child.href}/`))
                if (!hasActiveChild) continue

                const key = subGroupKey('/admin/finance', subItem.label)
                setExpandedSubGroups(prev => ({ ...prev, [key]: true }))
            }
        }
        if (pathname.startsWith('/admin/leads')) {
            setExpandedMenus(prev => ({ ...prev, '/admin/leads': true }))
        }
    }, [pathname])

    const toggleSubmenu = (href: string) => {
        setExpandedMenus(prev => ({ ...prev, [href]: !prev[href] }))
    }

    const closeMobileMenu = () => setMobileOpen(false)

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
        <aside className={`admin-sidebar ${mobileOpen ? 'open' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
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
                                                {item.subItems.map((subItem, index) => {
                                                    if ('children' in subItem) {
                                                        const key = subGroupKey(item.href, subItem.label)
                                                        const isGroupExpanded = expandedSubGroups[key] || false
                                                        return (
                                                            <div key={`subgroup-${subItem.label}-${index}`} style={{ marginTop: 6 }}>
                                                                <button
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
                                                                    <span>{subItem.label}</span>
                                                                    <ChevronDown
                                                                        size={12}
                                                                        style={{ transform: isGroupExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                                                                    />
                                                                </button>
                                                                {isGroupExpanded && (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 10 }}>
                                                                        {subItem.children.map(child => {
                                                                            const isChildActive = pathname === child.href || pathname.startsWith(`${child.href}/`)
                                                                            return (
                                                                                <Link
                                                                                    key={child.href}
                                                                                    href={child.href}
                                                                                    onClick={closeMobileMenu}
                                                                                    className={`admin-nav-item ${isChildActive ? 'active text-gold' : ''}`}
                                                                                    style={{
                                                                                        fontSize: '0.84rem',
                                                                                        padding: '6px 12px',
                                                                                        background: isChildActive ? 'var(--bg-card)' : 'transparent',
                                                                                        color: isChildActive ? 'var(--gold)' : 'var(--text-muted)',
                                                                                        borderLeft: isChildActive ? '2px solid var(--gold)' : '2px solid transparent',
                                                                                    }}
                                                                                >
                                                                                    {child.label}
                                                                                </Link>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    }

                                                    const isSubItemActive = pathname === subItem.href || pathname.startsWith(`${subItem.href}/`)
                                                    return (
                                                        <Link
                                                            key={subItem.href}
                                                            href={subItem.href}
                                                            onClick={closeMobileMenu}
                                                            className={`admin-nav-item ${isSubItemActive ? 'active text-gold' : ''}`}
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
        </>
    )
}
